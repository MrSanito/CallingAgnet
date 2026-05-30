"use client";

import { useState, useEffect } from "react";

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Lead Calls Modal (shows ALL calls for a lead)
  const [callsModalOpen, setCallsModalOpen] = useState(false);
  const [callsModalData, setCallsModalData] = useState(null);
  const [callsModalLoading, setCallsModalLoading] = useState(false);

  // Call Detail Modal (shows single call detail with transcript)
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailModalData, setDetailModalData] = useState(null);
  const [detailModalLoading, setDetailModalLoading] = useState(false);
  const [detailTab, setDetailTab] = useState("transcript");

  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    try {
      const res = await fetch("/api/leads");
      const json = await res.json();
      if (json.success) {
        setLeads(json.leads);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  }

  // Open all calls for a lead
  const openLeadCalls = async (leadFullId) => {
    setCallsModalOpen(true);
    setCallsModalLoading(true);
    try {
      const res = await fetch(`/api/lead-calls/${leadFullId}`);
      const json = await res.json();
      if (json.success) setCallsModalData(json);
      else setCallsModalData(null);
    } catch (e) {
      console.error("Failed to load lead calls:", e);
      setCallsModalData(null);
    } finally {
      setCallsModalLoading(false);
    }
  };

  // Open single call detail
  const openCallDetail = async (callId) => {
    setDetailModalOpen(true);
    setDetailModalLoading(true);
    setDetailTab("transcript");
    try {
      const res = await fetch(`/api/call-detail/${callId}`);
      const json = await res.json();
      if (json.success) setDetailModalData(json);
      else setDetailModalData(null);
    } catch (e) {
      console.error("Failed to load call detail:", e);
      setDetailModalData(null);
    } finally {
      setDetailModalLoading(false);
    }
  };

  const filteredLeads = leads.filter(l =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.phone.includes(searchQuery) ||
    l.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.requirement.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-700",
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    orange: "bg-orange-50 text-orange-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-600"
  };

  const statusBadge = (status) => {
    const map = {
      completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700" },
      accepted: { label: "Accepted", cls: "bg-indigo-50 text-indigo-700" },
      pending: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
      active: { label: "Active", cls: "bg-blue-50 text-blue-700" },
      failed: { label: "Failed", cls: "bg-rose-50 text-rose-700" },
      busy: { label: "Busy", cls: "bg-orange-50 text-orange-700" },
      no_answer: { label: "No Answer", cls: "bg-slate-100 text-slate-600" },
      rejected: { label: "Rejected", cls: "bg-rose-50 text-rose-700" },
    };
    const b = map[status] || { label: status || "—", cls: "bg-slate-100 text-slate-500" };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.cls}`}>{b.label}</span>;
  };

  const resolutionBadge = (resolution) => {
    if (!resolution) return <span className="text-slate-300">—</span>;
    const map = {
      trial_setup: { label: "Trial Setup", cls: "bg-emerald-50 text-emerald-700" },
      interested: { label: "Interested", cls: "bg-indigo-50 text-indigo-700" },
      deal_closed: { label: "Deal Closed", cls: "bg-emerald-50 text-emerald-700" },
      follow_up_needed: { label: "Follow Up", cls: "bg-amber-50 text-amber-700" },
      callback_requested: { label: "Callback", cls: "bg-blue-50 text-blue-700" },
      not_interested: { label: "Not Interested", cls: "bg-rose-50 text-rose-700" },
      busy: { label: "Busy", cls: "bg-orange-50 text-orange-700" },
      wrong_number: { label: "Wrong Number", cls: "bg-rose-50 text-rose-700" },
      no_answer: { label: "No Answer", cls: "bg-slate-100 text-slate-600" },
    };
    const b = map[resolution] || { label: resolution, cls: "bg-slate-100 text-slate-500" };
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${b.cls}`}>{b.label}</span>;
  };

  const sentimentIcon = (s) => {
    if (!s) return "—";
    if (s === "positive") return "😊 Positive";
    if (s === "negative") return "😟 Negative";
    return "😐 Neutral";
  };

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 shadow-sm gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            👥 Leads
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50/80 text-indigo-700 border border-indigo-100">
              {leads.length} total
            </span>
          </h1>
          <p className="text-xs text-slate-500">All leads from database · Click any row to view all calls</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
          <button
            onClick={fetchLeads}
            className="border border-slate-200 rounded-lg p-2 bg-white hover:bg-slate-50 transition-colors shadow-sm"
            title="Refresh"
          >
            <span className="text-slate-600 block text-xs">🔄</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="p-6 space-y-6">

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Leads", val: leads.length, icon: "👥", color: "text-indigo-600" },
            { label: "With Calls", val: leads.filter(l => l.totalCalls > 0).length, icon: "📞", color: "text-emerald-600" },
            { label: "Pending", val: leads.filter(l => l.status?.label === "Pending").length, icon: "⏳", color: "text-amber-600" },
            { label: "Completed", val: leads.filter(l => l.status?.label === "Completed").length, icon: "✅", color: "text-emerald-600" }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                <span className="mr-1.5">{stat.icon}</span>{stat.val}
              </p>
            </div>
          ))}
        </div>

        {/* Leads Table */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                All Leads
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{filteredLeads.length} records · Click row to view all calls</p>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-semibold border border-indigo-100">Live DB</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm">Loading leads...</p>
              </div>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm font-medium">{searchQuery ? "No leads match your search" : "No leads recorded yet"}</p>
              <p className="text-xs mt-1">Leads will appear here after being created via API</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">ID</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Name</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Phone</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Shop</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Requirement</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Status</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">Attempts</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">Calls</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Last Call</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Resolution</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Duration</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredLeads.map((row, i) => (
                    <tr
                      key={i}
                      className="hover:bg-indigo-50/40 hover:shadow-sm transition-all cursor-pointer group border-b border-slate-50 last:border-0"
                      onClick={() => openLeadCalls(row.fullId)}
                      title="Click to view all calls for this lead"
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-slate-400">#{row.id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-800">{row.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-slate-600">{row.phone}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-500 truncate max-w-[100px] block">{row.shopName}</span>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="text-slate-500 line-clamp-2 block leading-tight" title={row.requirement}>{row.requirement}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorMap[row.status?.color] || colorMap.slate}`}>
                          {row.status?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex w-5 h-5 rounded-full text-[10px] font-bold items-center justify-center ${
                          row.attempts > 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                        }`}>{row.attempts}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex w-5 h-5 rounded-full text-[10px] font-bold items-center justify-center ${
                          row.totalCalls > 0 ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                        }`}>{row.totalCalls}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.lastCallDate ? (
                          <span className="text-slate-500 whitespace-nowrap text-[10px]">
                            {new Date(row.lastCallDate).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.lastCallResolution ? (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorMap[row.lastCallResolution?.color] || colorMap.slate}`}>
                            {row.lastCallResolution?.label}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono font-bold ${
                          row.lastCallDurationSec > 120 ? "text-emerald-600" :
                          row.lastCallDurationSec > 0 ? "text-amber-600" : "text-slate-400"
                        }`}>{row.lastCallDuration}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-400 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ═══ MODAL 1: Lead Calls List ═══ */}
      {callsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCallsModalOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
              <div>
                {callsModalLoading ? (
                  <div className="h-5 w-48 bg-slate-200 rounded animate-pulse mb-2"></div>
                ) : callsModalData ? (
                  <>
                    <h2 className="text-lg font-bold text-slate-900">{callsModalData.lead.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="font-mono">{callsModalData.lead.phone}</span>
                      {callsModalData.lead.shopName !== "—" && (
                        <><span className="text-slate-300">·</span><span>{callsModalData.lead.shopName}</span></>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-indigo-600">{callsModalData.totalCalls} call{callsModalData.totalCalls !== 1 ? "s" : ""}</span>
                    </p>
                    {callsModalData.lead.requirement !== "—" && (
                      <p className="text-[11px] text-slate-400 mt-1">📋 {callsModalData.lead.requirement}</p>
                    )}
                  </>
                ) : (
                  <h2 className="text-lg font-bold text-slate-900">Lead Calls</h2>
                )}
              </div>
              <button onClick={() => setCallsModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors p-1">✕</button>
            </div>

            {/* Body */}
            {callsModalLoading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm">Loading calls...</p>
                </div>
              </div>
            ) : !callsModalData ? (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
                <p className="text-sm">Failed to load calls.</p>
              </div>
            ) : callsModalData.calls.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-sm font-medium">No calls recorded for this lead</p>
                <p className="text-xs mt-1">Calls will appear here after the AI calls this lead</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-100">
                  {callsModalData.calls.map((call, i) => (
                    <div
                      key={i}
                      className="px-6 py-4 hover:bg-indigo-50/30 cursor-pointer transition-all group"
                      onClick={() => openCallDetail(call.callId)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left: Call info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-700">Call #{i + 1}</span>
                            {statusBadge(call.status)}
                            {resolutionBadge(call.resolution)}
                            {call.hasRecording && (
                              <span className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded-full font-semibold border border-teal-100">🎙 Recording</span>
                            )}
                          </div>
                          {call.summary ? (
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 group-hover:text-indigo-600 transition-colors">{call.summary}</p>
                          ) : (
                            <p className="text-xs text-slate-300 italic">No summary available</p>
                          )}
                          {call.nextAction && (
                            <p className="text-[10px] text-indigo-500 mt-1 font-medium">→ {call.nextAction}</p>
                          )}
                        </div>

                        {/* Right: Meta */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
                          <span className={`font-mono text-xs font-bold ${
                            call.durationSec > 120 ? "text-emerald-600" :
                            call.durationSec > 0 ? "text-amber-600" : "text-slate-400"
                          }`}>{call.duration}</span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {new Date(call.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                          </span>
                          {call.sentiment && (
                            <span className="text-[10px] text-slate-400">{sentimentIcon(call.sentiment)}</span>
                          )}
                          <span className="text-[10px] text-indigo-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">View detail →</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ MODAL 2: Single Call Detail ═══ */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setDetailModalOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => { e.stopPropagation(); setDetailModalOpen(false); }}
                  className="text-slate-400 hover:text-indigo-600 transition-colors text-sm font-bold"
                  title="Back to calls list"
                >← Back</button>
                <div>
                  {detailModalLoading ? (
                    <div className="h-5 w-48 bg-slate-200 rounded animate-pulse"></div>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold text-slate-900">{detailModalData?.call?.name || "Call Detail"}</h2>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="font-mono">{detailModalData?.call?.phone}</span>
                        {detailModalData?.call?.roomId && (
                          <><span className="text-slate-300">·</span><span className="font-mono text-[10px] text-slate-400">{detailModalData.call.roomId}</span></>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors p-1">✕</button>
            </div>

            {detailModalLoading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm">Loading call details...</p>
                </div>
              </div>
            ) : !detailModalData ? (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
                <p className="text-sm">Failed to load call details.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Meta Info Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100">
                  {[
                    { label: "Duration", val: detailModalData.call.duration },
                    { label: "Status", val: detailModalData.call.status?.replace(/_/g, " ") || "—" },
                    { label: "Resolution", val: detailModalData.call.resolution?.replace(/_/g, " ") || "—" },
                    { label: "Sentiment", val: sentimentIcon(detailModalData.call.sentiment) },
                    { label: "Attempts", val: detailModalData.call.attempts },
                    { label: "Language", val: detailModalData.call.agentLanguage || "—" },
                    { label: "Tokens", val: detailModalData.call.tokenUsage ? (detailModalData.call.tokenUsage.totals?.total_tokens || detailModalData.call.tokenUsage.total_tokens || "—") : "—" },
                    { label: "Date", val: detailModalData.call.createdAt ? new Date(detailModalData.call.createdAt).toLocaleString("en-IN") : "—" }
                  ].map((item, i) => (
                    <div key={i}>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 capitalize">{item.val}</p>
                    </div>
                  ))}
                </div>

                {/* AI Summary */}
                {detailModalData.call.summary && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">AI Summary</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{detailModalData.call.summary}</p>
                    {detailModalData.call.nextAction && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-indigo-500">Next Action:</span>
                        <span className="text-xs text-indigo-700 font-medium">{detailModalData.call.nextAction}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Recording Audio Player */}
                {detailModalData.recording?.fileUrl && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">📼 Recording</p>
                    <audio controls className="w-full h-10 rounded-lg" src={detailModalData.recording.fileUrl} />
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                      {detailModalData.recording.duration && <span>⏱ {Math.floor(detailModalData.recording.duration / 60)}:{String(Math.round(detailModalData.recording.duration % 60)).padStart(2, "0")}</span>}
                      {detailModalData.recording.size && <span>📦 {(detailModalData.recording.size / 1024 / 1024).toFixed(1)} MB</span>}
                      <span className="uppercase font-mono">{detailModalData.recording.format}</span>
                      <a href={detailModalData.recording.fileUrl} download target="_blank" rel="noreferrer" className="text-indigo-500 font-semibold hover:underline ml-auto">⬇ Download</a>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="px-6 pt-4">
                  <div className="flex gap-1 border-b border-slate-100 mb-4">
                    {["transcript", "raw"].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setDetailTab(tab)}
                        className={`px-4 py-2 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${
                          detailTab === tab
                            ? "bg-white border-slate-200 text-indigo-600 -mb-px"
                            : "bg-slate-50 border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {tab === "transcript" ? "💬 Transcript" : "📄 Raw Transcript"}
                      </button>
                    ))}
                  </div>

                  {detailTab === "transcript" && (
                    <div className="pb-6">
                      {detailModalData.transcriptLines.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          <p className="text-3xl mb-2">💬</p>
                          <p className="text-sm">No transcript lines saved yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {detailModalData.transcriptLines.map((line, i) => {
                            const isAgent = line.role === "agent" || line.role === "assistant";
                            return (
                              <div key={i} className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}`}>
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                  isAgent ? "bg-indigo-100 text-indigo-600" :
                                  line.role === "system" ? "bg-slate-100 text-slate-500" :
                                  "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {isAgent ? "AI" : line.role === "system" ? "S" : "C"}
                                </div>
                                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                  isAgent ? "bg-indigo-50 text-indigo-900 rounded-tl-sm" :
                                  line.role === "system" ? "bg-slate-100 text-slate-600 text-xs" :
                                  "bg-emerald-50 text-emerald-900 rounded-tr-sm"
                                }`}>
                                  {line.content}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {detailTab === "raw" && (
                    <div className="pb-6">
                      {detailModalData.call.rawTranscript ? (
                        <pre className="bg-slate-950 text-emerald-400 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">{detailModalData.call.rawTranscript}</pre>
                      ) : (
                        <div className="text-center py-10 text-slate-400">
                          <p className="text-3xl mb-2">📄</p>
                          <p className="text-sm">Raw transcript not yet available</p>
                          <p className="text-xs mt-1">Will be saved from the next call onward</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between mt-auto text-xs text-slate-400 font-medium">
        <span>All times are in Asia/Kolkata (IST)</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>Connected to database</span>
        </div>
      </footer>
    </>
  );
}
