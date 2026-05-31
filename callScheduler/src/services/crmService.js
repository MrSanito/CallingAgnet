// src/services/crmService.js
// Fake Rentopus CRM service. Replace console.logs with real axios calls later.

/**
 * PUT /api/updateLead/?id=:leadId
 * Updates a lead in the CRM after call resolution.
 */
async function updateLead(leadId, updatePayload) {
  console.log(
    `[CRM]  PUT /api/updateLead/?id=${leadId} | payload=${JSON.stringify(updatePayload)}`
  );

  // TODO: replace with real HTTP call
  // await axios.put(`${process.env.CRM_BASE_URL}/api/updateLead/?id=${leadId}`, updatePayload, {
  //   headers: { Authorization: `Bearer ${process.env.CRM_API_KEY}` },
  // });

  return { success: true, leadId, updated: updatePayload };
}

/**
 * POST /api/addfollowup/leadId=:leadId
 * Adds a follow-up entry for a lead.
 */
async function addFollowUp(leadId, followUpPayload) {
  console.log(
    `[CRM]  POST /api/addfollowup/leadId=${leadId} | payload=${JSON.stringify(followUpPayload)}`
  );

  // TODO: replace with real HTTP call
  // await axios.post(`${process.env.CRM_BASE_URL}/api/addfollowup/leadId=${leadId}`, followUpPayload, {
  //   headers: { Authorization: `Bearer ${process.env.CRM_API_KEY}` },
  // });

  return { success: true, leadId, followUp: followUpPayload };
}

/**
 * GET /api/LeadList
 * Fetches today's leads from the CRM.
 * Returns dummy data until wired to real CRM.
 */
async function fetchTodayLeads() {
  console.log(`[CRM]  GET /api/LeadList | fetching today's leads...`);

  // TODO: replace with real HTTP call
  // const { data } = await axios.get(`${process.env.CRM_BASE_URL}/api/LeadList`, {
  //   headers: { Authorization: `Bearer ${process.env.CRM_API_KEY}` },
  // });
  // return data;

  // --- DUMMY DATA ---
  const dummyLeads = [
    {
      id: 1,
      clientName: "Vishal Patel",
      clientNumber: "+916353778872",
      clientRequirement: "2BHK flat in Ahmedabad, budget 50L",
      clientOtherDetails: { source: "website", priority: "high", createdAt: new Date().toISOString() },
    },
    {
      id: 2,
      clientName: "Ravi Shah",
      clientNumber: "+919876543210",
      clientRequirement: "3BHK in Surat near VIP Road, budget 80L",
      clientOtherDetails: { source: "referral", priority: "medium", createdAt: new Date().toISOString() },
    },
    {
      id: 3,
      clientName: "Priya Mehta",
      clientNumber: "+917654321098",
      clientRequirement: "1BHK for investment in Vadodara, budget 25L",
      clientOtherDetails: { source: "IVR", priority: "low", createdAt: new Date().toISOString() },
    },
  ];

  console.log(`[CRM]  GET /api/LeadList | fetched ${dummyLeads.length} leads`);
  return dummyLeads;
}

/**
 * Saves VideoSDK Room details to DB
 * @param {string|number} leadId - Lead ID
 * @param {object} roomData - VideoSDK created room response object
 */
async function saveVideoSdkRoom(leadId, roomData) {
  console.log(`[DB]   ✅ Saved VideoSDK Room to DB for Lead: ${leadId}`);
  console.log(`[DB]   VideoSDK room ID: ${roomData.roomId} (SDK database ID: ${roomData.id})`);
  
  // TODO: Replace with real database query (e.g. Prisma or direct SQL save)
  // await db.leadRooms.create({ data: { leadId, roomId: roomData.roomId, videoSdkId: roomData.id, rawResponse: roomData } });

  return { success: true };
}

export { updateLead, addFollowUp, fetchTodayLeads, saveVideoSdkRoom };

/**
 * POST /api/external/leads/UpdateLeadStatusLabelbyId
 * Updates a lead's status and labels in Rentopus CRM.
 */
export async function updateLeadStatusAndLabels(crmLeadId, labelIds, leadStatusId) {
  const apiKey = process.env.RCRM_API_KEY || "Q6HP0ydkWpgp2wCKa3Lnc3zAVQEPlYzbg3JRpKEqz94";
  const url = "https://rcrm-api.rentopus.in/api/external/leads/UpdateLeadStatusLabelbyId";

  console.log(`[CRM Service] Updating CRM Lead ${crmLeadId} status to ${leadStatusId} and labels ${JSON.stringify(labelIds)}`);

  try {
    // API CALL COMMENTED OUT BY USER REQUEST
    /*
    const response = await fetch(url, {
      method: "POST",
      headers: {
      //   "accept": "",
      //   "Content-Type": "application/json",
      //   "X-API-Key": apiKey
      // },
      body: JSON.stringify({
        LeadId: Number(crmLeadId),
        LabelIds: labelIds.map(Number),
        LeadStatusId: Number(leadStatusId)
      })
    });

    const text = await response.text();
    console.log(`[CRM Service] UpdateLeadStatusLabelbyId Response: Status=${response.status} | Body=${text}`);
    return { success: response.ok, status: response.status, body: text };
    */

    console.log(`[CRM Service] (MOCK SUCCESS) UpdateLeadStatusLabelbyId for Lead ${crmLeadId}`);
    return { success: true, mocked: true };
  } catch (err) {
    console.error(`[CRM Service] ❌ Failed to update CRM lead status/labels:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * POST /api/external/leads/AddFolloupbyLeadId
 * Adds a follow-up entry with optional audio recording to the Rentopus CRM.
 */
export async function addFollowUpWithAudio(crmLeadId, comment, nextFollowupDate, audioUrl = null) {
  const apiKey = process.env.RCRM_API_KEY || "Q6HP0ydkWpgp2wCKa3Lnc3zAVQEPlYzbg3JRpKEqz94";
  const url = "https://rcrm-api.rentopus.in/api/external/leads/AddFolloupbyLeadId";

  console.log(`[CRM Service] Adding follow-up for CRM Lead ${crmLeadId} | nextFollowup=${nextFollowupDate} | audioUrl=${audioUrl}`);

  try {
    const formData = new FormData();
    formData.append("LeadId", crmLeadId.toString());
    formData.append("Comment", comment || "Call summary/details uploaded");
    formData.append("NextFollowup", nextFollowupDate);

    if (audioUrl) {
      console.log(`[CRM Service] Downloading audio from URL: ${audioUrl}`);
      // Commented out to save local bandwidth during mock:
      /*
      const audioResponse = await fetch(audioUrl);
      if (audioResponse.ok) {
        const audioBuffer = await audioResponse.arrayBuffer();
        const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
        formData.append("AudioFile", audioBlob, "recording.mp3");
        console.log(`[CRM Service] Audio recording downloaded and attached.`);
      } else {
        console.warn(`[CRM Service] ⚠️ Failed to download audio from ${audioUrl}. Proceeding without audio file.`);
      }
      */
      console.log(`[CRM Service] (MOCKED) Audio recording download skipped.`);
    }

    // API CALL COMMENTED OUT BY USER REQUEST
    /*
    const response = await fetch(url, {
      method: "POST",
      headers: {
    //     "accept": "",
    //     "X-API-Key": apiKey
    //   },
    //   body: formData
    // });

    const text = await response.text();
    console.log(`[CRM Service] AddFolloupbyLeadId Response: Status=${response.status} | Body=${text}`);
    return { success: response.ok, status: response.status, body: text };
    */

    console.log(`[CRM Service] (MOCK SUCCESS) AddFolloupbyLeadId for Lead ${crmLeadId}`);
    return { success: true, mocked: true };
  } catch (err) {
    console.error(`[CRM Service] ❌ Failed to add CRM follow-up:`, err.message);
    return { success: false, error: err.message };
  }
}
