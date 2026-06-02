import { Lead, CallHistory, ScheduledCallback } from "../models/mongooseModels.js";
import { callQueue } from "../queues/callQueue.js";
import { parseTranscript } from "./geminiService.js";
import { updateLead, addFollowUp, fetchTodayLeads } from "./crmService.js";

function normalizePhoneNumber(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return digits;
  return null;
}

function cleanName(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  const stripped = trimmed
    .replace(/\s*[-–]\s*\d{10}/g, "")
    .replace(/\s*(call|wife|husband)\s*(no\.?|number)?\s*[-–]?\s*\d*/gi, "")
    .trim();
  if (!stripped || ["unknown", "unkown"].includes(stripped.toLowerCase())) return "";
  return stripped;
}

function cleanShopName(raw) {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (["unknown", "unkown", "home", ""].includes(trimmed.toLowerCase())) return "";
  return trimmed;
}

function buildRelatedDetails(lead) {
  const parts = [];
  if (lead.leadLabelName) parts.push(`Labels: ${lead.leadLabelName}`);
  if (lead.remarks?.trim()) parts.push(`Remarks: ${lead.remarks.trim()}`);
  if (lead.comment?.trim()) {
    const dateMatch = lead.comment.match(/\d{2}\/\w+\/\d{4}/);
    const dateStr = dateMatch ? ` (last contact: ${dateMatch[0]})` : "";
    parts.push(`Last comment${dateStr}: ${lead.comment.trim()}`);
  }
  return parts.join(" | ");
}

function cleanLeadsList(rawLeads) {
  const seen = new Set();
  const cleaned = [];
  for (const lead of rawLeads) {
    const contactNo = normalizePhoneNumber(lead.contactNo);
    if (!contactNo || seen.has(contactNo)) continue;
    seen.add(contactNo);
    cleaned.push({
      RcromId: lead.id,
      name: cleanName(lead.name),
      contactNo,
      shopName: cleanShopName(lead.shopName),
      relatedDetails: buildRelatedDetails(lead),
    });
  }
  return cleaned;
}

/**
 * Saves/updates lead and queues an immediate call
 */
export async function processLeadAndQueueImmediate({ clientName, clientNumber, clientRequirement, clientOtherDetails, shopName, maxAttempts, priority, timezone, preferredCallWindow, tags }, isNewLeadsPath = false) {
  const cleanNumber = normalizePhoneNumber(clientNumber);
  const name = clientName || "Customer";
  const requirement = clientRequirement || "General Follow-up";
  const otherDetails = clientOtherDetails || {};
  const finalShopName = shopName || (otherDetails && otherDetails.shopName) || "";

  // Check if lead already exists
  let lead = await Lead.findOne({ clientNumber: cleanNumber });

  if (lead) {
    lead.clientName = name;
    lead.shopName = finalShopName;
    lead.clientRequirement = requirement;
    lead.clientOtherDetails = { ...lead.clientOtherDetails, ...otherDetails };
    lead.status = "pending";
    lead.totalAttempts = 0;
    
    if (maxAttempts !== undefined) lead.maxAttempts = maxAttempts;
    if (priority !== undefined) lead.priority = priority;
    if (timezone !== undefined) lead.timezone = timezone;
    if (preferredCallWindow !== undefined) lead.preferredCallWindow = preferredCallWindow;
    if (tags !== undefined) lead.tags = tags;

    await lead.save();
    console.log(`[Lead Service] Re-activated existing lead: ${cleanNumber}`);
  } else {
    lead = new Lead({
      clientName: name,
      shopName: finalShopName,
      clientNumber: cleanNumber,
      clientRequirement: requirement,
      clientOtherDetails: otherDetails,
      status: "pending",
      totalAttempts: 0,
      maxAttempts: maxAttempts !== undefined ? maxAttempts : 3,
      priority: priority || 0,
      timezone: timezone || "Asia/Kolkata",
      preferredCallWindow: preferredCallWindow || { start: "09:00", end: "19:00" },
      tags: tags || [],
    });
    await lead.save();
    console.log(`[Lead Service] Created new lead: ${name} (${cleanNumber})`);
  }

  // Queue initial job with attemptNum = 1, delay = 0
  const jobData = {
    leadId: lead._id.toString(),
    clientName: name,
    shopName: finalShopName,
    clientNumber: cleanNumber,
    clientRequirement: requirement,
    clientOtherDetails: otherDetails,
    attemptNum: 1,
  };

  const pathTag = isNewLeadsPath ? "newLeads" : "leads";
  const job = await callQueue.add("initiate-call", jobData, {
    delay: 0,
    jobId: `lead-${lead._id.toString()}-attempt-1-${pathTag}-${Date.now()}`
  });

  console.log(`[Lead Service] Queued immediate job | id=${job.id} | leadId=${lead._id}`);

  return { lead, job };
}

/**
 * Fetches today's CRM followups and queues call jobs after 5 mins delay
 */
export async function fetchAndScheduleTodayFollowup() {
  const today = new Date().toISOString().split("T")[0];
  const url = "https://rcrm-api.rentopus.in/api/external/leads/GetTodaysFollowupByUserId";

  console.log(`[Lead Service] Fetching today's CRM followups for date: ${today}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "accept": "*/*",
      "Content-Type": "application/json",
      "X-API-Key": "Q6HP0ydkWpgp2wCKa3Lnc3zAVQEPlYzbg3JRpKEqz94",
    },
    body: JSON.stringify({ userId: 5, fromDate: today, toDate: today }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`CRM API responded with status ${response.status} — ${errText}`);
  }

  const responseData = await response.json();

  if (!responseData.success || !responseData.data?.length) {
    console.log(`[Lead Service] No leads returned from CRM API`);
    return [];
  }

  const cleanedLeads = cleanLeadsList(responseData.data);
  console.log("\n=================== [CLEANED LEADS] ===================");
  console.log(JSON.stringify(cleanedLeads, null, 2));
  console.log("========================================================\n");

  let scheduledCount = 0;
  const processedNumbers = new Set();

  for (const rawLead of responseData.data) {
    const cleanedLead = cleanedLeads.find((l) => l.RcromId === rawLead.id);
    if (!cleanedLead) continue;

    const { name, contactNo, shopName, relatedDetails } = cleanedLead;
    if (!contactNo) continue;

    if (processedNumbers.has(contactNo)) {
      console.log(`[Lead Service] Skipping duplicate lead for number: ${contactNo}`);
      continue;
    }
    processedNumbers.add(contactNo);

    const clientName = name || "Customer";
    const finalShopName = shopName || "";
    const clientRequirement = relatedDetails || "";

    const clientOtherDetails = {
      crmLeadId: rawLead.id,
      shopName: rawLead.shopName,
      remarks: rawLead.remarks,
      leadStatusId: rawLead.leadStatusId,
      comment: rawLead.comment,
      leadLabelIds: rawLead.leadLabelIds,
      leadLabelName: rawLead.leadLabelName,
      source: "TodayFollowup",
    };

    let lead = await Lead.findOne({ clientNumber: contactNo });

    if (lead) {
      lead.RcromId = rawLead.id;
      lead.clientName = clientName;
      lead.shopName = finalShopName;
      lead.clientRequirement = clientRequirement;
      lead.clientOtherDetails = { ...lead.clientOtherDetails, ...clientOtherDetails };
      lead.status = "pending";
      lead.totalAttempts = 0;
      await lead.save();
      console.log(`[Lead Service] Updated lead: ${clientName} (${contactNo}) RcromId=${rawLead.id}`);
    } else {
      lead = new Lead({
        RcromId: rawLead.id,
        clientName,
        shopName: finalShopName,
        clientNumber: contactNo,
        clientRequirement,
        clientOtherDetails,
        status: "pending",
        totalAttempts: 0,
      });
      await lead.save();
      console.log(`[Lead Service] Saved new lead: ${clientName} (${contactNo}) RcromId=${rawLead.id}`);
    }

    // First 3 → 1 min, next 3 → 7 min, next 3 → 13 min ...
    const delayMinutes = 1 + Math.floor(scheduledCount / 3) * 6;
    const delayMs = delayMinutes * 60 * 1000;

    const jobData = {
      leadId: lead._id.toString(),
      clientName,
      shopName: finalShopName,
      clientNumber: contactNo,
      clientRequirement,
      clientOtherDetails,
      attemptNum: 1,
    };

    const job = await callQueue.add("initiate-call", jobData, {
      delay: delayMs,
      jobId: `lead-${lead._id.toString()}-attempt-1-followup-${Date.now()}`,
    });

    console.log(`[Lead Service] Scheduled call for ${clientName} (${contactNo}) | delay: ${delayMinutes}min | jobId: ${job.id}`);
    scheduledCount++;
  }

  return cleanedLeads;
}


/**
 * Schedules a single immediate or delayed call
 */
export async function scheduleSingleCall({ clientName, clientNumber, clientRequirement, clientOtherDetails, delayMinutes }) {
  const delayMs = (delayMinutes || 0) * 60 * 1000;
  const scheduledAt = new Date(Date.now() + delayMs).toISOString();

  const jobData = {
    clientName,
    clientNumber,
    clientRequirement,
    clientOtherDetails: clientOtherDetails || {},
    attemptCount: 0,
    scheduledAt,
  };

  const jobOptions = delayMs > 0 ? { delay: delayMs } : {};
  const job = await callQueue.add("initiate-call", jobData, jobOptions);

  console.log(`[Lead Service] Single call scheduled | id=${job.id} | client=${clientName} | delay=${delayMinutes}min`);

  return { job, scheduledAt };
}

/**
 * Processes transcript with Gemini and updates lead status & handles followups
 */
export async function resolveCall({ leadId, clientName, clientNumber, clientRequirement, clientOtherDetails, transcript }) {
  // 1. Parse transcript with Gemini
  const resolution = await parseTranscript(transcript, {
    clientName,
    clientRequirement,
    clientOtherDetails,
  });

  // 2. Update lead in CRM
  const crmUpdatePayload = {
    callStatus: resolution.resolution,
    sentiment: resolution.sentiment,
    lastCallSummary: resolution.summary,
    nextAction: resolution.nextAction,
    urgency: resolution.urgency,
    updatedAt: new Date().toISOString(),
  };

  const effectiveLeadId = leadId ?? clientNumber.replace("+", "");
  await updateLead(effectiveLeadId, crmUpdatePayload);

  // 3. Add follow-up in CRM if needed
  const shouldFollowUp = !["not_interested", "deal_closed"].includes(resolution.resolution);
  let followUpJob = null;

  if (shouldFollowUp) {
    const delayMs = resolution.followUpDelayMinutes * 60 * 1000;
    const followUpAt = new Date(Date.now() + delayMs);

    await addFollowUp(effectiveLeadId, {
      followUpAt: followUpAt.toISOString(),
      notes: resolution.nextAction,
      assignedTo: "auto-scheduler",
    });

    // 4. Create ScheduledCallback record
    const scheduledCallback = new ScheduledCallback({
      leadId: effectiveLeadId.length === 24 ? effectiveLeadId : leadId, // use ObjectId if possible
      scheduledFor: followUpAt,
      channel: "call",
      status: "queued",
      reason: "follow_up",
      note: resolution.nextAction
    });
    await scheduledCallback.save();

    // 5. Re-queue call in BullMQ
    followUpJob = await callQueue.add(
      "initiate-call",
      {
        clientName,
        clientNumber,
        clientRequirement,
        clientOtherDetails: clientOtherDetails || {},
        attemptCount: ((clientOtherDetails && clientOtherDetails.attemptCount) ?? 0) + 1,
        scheduledAt: followUpAt.toISOString(),
        previousResolution: resolution.resolution,
      },
      { delay: delayMs }
    );

    console.log(`[Lead Service] Follow-up queued | jobId=${followUpJob.id} | delay=${resolution.followUpDelayMinutes}min`);
  }

  return {
    resolution,
    shouldFollowUp,
    followUpJobId: followUpJob ? followUpJob.id : null,
  };
}

/**
 * Fetches today's leads from CRM and queues them staggering by 20s
 */
export async function fetchAndStaggerTodayLeads() {
  const leads = await fetchTodayLeads();

  if (!leads.length) {
    return [];
  }

  const STAGGER_SECONDS = 20;

  const bulkJobs = leads.map((lead, index) => ({
    name: "initiate-call",
    data: {
      clientName: lead.clientName,
      clientNumber: lead.clientNumber,
      clientRequirement: lead.clientRequirement,
      clientOtherDetails: { ...lead.clientOtherDetails, leadId: lead.id },
      attemptCount: 0,
      scheduledAt: new Date(Date.now() + index * STAGGER_SECONDS * 1000).toISOString(),
    },
    opts: {
      delay: index * STAGGER_SECONDS * 1000,
      jobId: `lead-${lead.id}-${Date.now()}`,
    },
  }));

  const jobs = await callQueue.addBulk(bulkJobs);

  return jobs.map((job, i) => ({
    jobId: job.id,
    clientName: leads[i].clientName,
    clientNumber: leads[i].clientNumber,
    scheduledAt: bulkJobs[i].data.scheduledAt,
  }));
}

/**
 * Fetches all leads stored in the database
 */
export async function getAllLeads() {
  return await Lead.find({}).sort({ createdAt: -1 });
}
