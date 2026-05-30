"use client";

import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Link from "next/link";

export default function AIAlertsDashboard() {
  const flagChartRef = useRef(null);
  const flagChartInstance = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch alerts from the API
  useEffect(() => {
    async function loadAlerts() {
      try {
        const response = await fetch("/api/alerts");
        const json = await response.json();
        if (json.success && json.alerts.length > 0) {
          setAlerts(json.alerts);
          setSelectedAlertId(json.alerts[0].id);
        }
      } catch (err) {
        console.error("Failed to load alerts from DB:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAlerts();
  }, []);

  const filteredAlerts = alerts.filter(
    row =>
      row.retailer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.flag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      row.snippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeAlert = alerts.find(a => a.id === selectedAlertId) || alerts[0] || {
    retailer: "No alert selected",
    callId: "-",
    duration: "-",
    priority: "Low",
    flag: "-",
    time: "-",
    snippet: "-",
    transcript: [],
    summary: { short: "", issue: "", response: "", cause: "", action: "" },
    history: []
  };

  // Set up chart dynamically based on loaded alerts
  useEffect(() => {
    if (alerts.length > 0 && flagChartRef.current) {
      let priceCount = 0;
      let deliveryCount = 0;
      let inquiryCount = 0;

      alerts.forEach(a => {
        if (a.flag === "Price Discrepancy" || a.flag === "Payment Dispute") {
          priceCount++;
        } else if (a.flag === "Delivery Delay" || a.flag === "Wrong Scheme") {
          deliveryCount++;
        } else {
          inquiryCount++;
        }
      });

      if (flagChartInstance.current) flagChartInstance.current.destroy();
      flagChartInstance.current = new Chart(flagChartRef.current, {
        type: "doughnut",
        data: {
          labels: ["Price Discrepancy", "Delivery & Schemes", "Inquiries & Info"],
          datasets: [{
            data: [priceCount || 12, deliveryCount || 16, inquiryCount || 6],
            backgroundColor: ["#f43f5e", "#f59e0b", "#cbd5e1"],
            borderWidth: 2,
            borderColor: "#ffffff",
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "72%",
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    return () => {
      if (flagChartInstance.current) flagChartInstance.current.destroy();
    };
  }, [alerts]);

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 shadow-sm gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Alerts &amp; Flags Dashboard
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50/80 text-indigo-700 border border-indigo-100">Interactive Preview</span>
          </h1>
          <p className="text-xs text-slate-500">Flags, Transcripts, Call History &amp; AI Summariser (Click an alert to view its details)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white text-xs text-slate-700 font-medium shadow-sm">
            <span>📅</span>
            <span>25 May 2026 - 31 May 2026</span>
          </div>
          {/* Table Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
            />
            <span className="absolute left-2.5 top-2 text-slate-400 text-xs">🔍</span>
          </div>
          {/* Reload Button */}
          <button
            onClick={() => window.location.reload()}
            className="border border-slate-200 rounded-lg p-2 bg-white hover:bg-slate-50 transition-colors shadow-sm"
            title="Refresh Page"
          >
            <span className="text-slate-600 block text-xs">🔄</span>
          </button>
        </div>
      </header>

      {/* Content Area */}
      <div className="p-6 space-y-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Total Alerts", val: "34", desc: "↑ 12.5% vs last week", emoji: "🚩", bg: "bg-red-50", color: "text-red-600" },
            { label: "High Priority", val: "8", desc: "Action Required Immediately", emoji: "⬇️", bg: "bg-orange-50", color: "text-rose-600" },
            { label: "Medium Priority", val: "14", desc: "Awaiting review queue", emoji: "🏳️", bg: "bg-amber-50", color: "text-amber-600" },
            { label: "Low Priority", val: "12", desc: "Minor inquiries / queries", emoji: "📗", bg: "bg-emerald-50", color: "text-emerald-600" },
            { label: "Total Resolved", val: "45", desc: "↑ 94% Resolution efficiency", emoji: "📋", bg: "bg-purple-50", color: "text-purple-600" }
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-4 flex items-start gap-3.5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center text-lg flex-shrink-0`}>
                {stat.emoji}
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{stat.label}</p>
                <p className={`text-2xl font-extrabold ${stat.color === "text-rose-600" ? "text-rose-600" : "text-slate-900"}`}>{stat.val}</p>
                <p className={`text-[10px] ${stat.color === "text-rose-600" ? "text-rose-500" : stat.desc.startsWith("↑") ? "text-emerald-600" : "text-slate-400"} font-semibold flex items-center gap-0.5`}>
                  {stat.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Table & Chart Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Alerts Table */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 text-sm">Alerts / Flags Table</h2>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">Click any row to inspect details</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="table table-xs w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200">
                      <th className="pb-2 font-semibold">Priority</th>
                      <th className="pb-2 font-semibold">Flag Type</th>
                      <th className="pb-2 font-semibold">Retailer / Client</th>
                      <th className="pb-2 font-semibold">Distributor / MR</th>
                      <th className="pb-2 font-semibold">Time</th>
                      <th className="pb-2 font-semibold">AI Summary Snippet</th>
                      <th className="pb-2 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAlerts.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedAlertId(row.id)}
                        className={`hover:bg-slate-50/70 transition-all cursor-pointer ${
                          selectedAlertId === row.id
                            ? "bg-indigo-50/40 border-l-4 border-indigo-600"
                            : ""
                        }`}
                      >
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase ${
                            row.priority === "High"
                              ? "bg-rose-100 text-rose-700"
                              : row.priority === "Medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}>
                            {row.priority}
                          </span>
                        </td>
                        <td className={`py-3 font-semibold ${
                          row.priority === "High" ? "text-rose-600" : row.priority === "Medium" ? "text-amber-600" : "text-emerald-600"
                        }`}>{row.flag}</td>
                        <td className="py-3 font-semibold text-slate-800">{row.retailer}</td>
                        <td className="py-3 text-slate-600">{row.id % 3 === 0 ? "Khandelwal (MR: Sonu)" : row.id % 2 === 0 ? "Mahaveer (MR: Raj)" : "Vardhaman (MR: Amit)"}</td>
                        <td className="py-3 text-slate-400 font-mono text-[10px]">{row.time}</td>
                        <td className="py-3 text-slate-500 max-w-[150px] truncate">{row.snippet}</td>
                        <td className="py-3 text-right">
                          <button className="text-indigo-600 hover:text-indigo-800 font-bold">Inspect</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>{filteredAlerts.length} alerts loaded.</span>
              <button className="text-indigo-600 font-bold hover:underline">View Archived Alerts</button>
            </div>
          </div>

          {/* Doughnut Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-slate-800 text-sm">Alerts by Flag Type</h2>
                <span className="text-[10px] text-slate-400 font-medium">Categorization</span>
              </div>
              
              <div className="relative h-44 flex items-center justify-center">
                <canvas ref={flagChartRef}></canvas>
              </div>
              
              <div className="space-y-2 mt-5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500"></span>
                    <span className="text-slate-600 font-medium">Price Discrepancy</span>
                  </div>
                  <span className="text-slate-800 font-bold">12 (35.3%)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500"></span>
                    <span className="text-slate-600 font-medium">Delivery & Schemes</span>
                  </div>
                  <span className="text-slate-800 font-bold">16 (47.1%)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-slate-300"></span>
                    <span className="text-slate-600 font-medium">Inquiries & Info</span>
                  </div>
                  <span className="text-slate-800 font-bold">6 (17.6%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transcript & AI Summariser */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 text-sm">Transcript &amp; AI Summariser</h2>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-500">📞</span>
                  <span className="font-bold text-slate-700">Call ID: {activeAlert.callId}</span>
                  <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded">Duration: {activeAlert.duration}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Left: Transcript Bubble Log */}
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Transcript Log</p>
                  <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                    {activeAlert.transcript.map((t, idx) => {
                      const isAI = t.role.includes("AI");
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isAI ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                              {t.role}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">{t.time}</span>
                          </div>
                          <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 inline-block max-w-full">
                            {t.text}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: AI Summariser Pane */}
                <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">AI Summariser Insights</p>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase">Short Summary</p>
                      <p className="text-xs text-slate-600 font-medium">{activeAlert.summary.short}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase">Issue Summary</p>
                      <p className="text-xs text-slate-600 font-medium">{activeAlert.summary.issue}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase">Customer Response</p>
                      <p className="text-xs text-slate-600 font-medium">{activeAlert.summary.response}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase">Root Cause (AI)</p>
                      <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">📍 {activeAlert.summary.cause}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-600 uppercase">Action Needed</p>
                      <p className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded border border-indigo-100 mt-1 inline-block">
                        ✅ {activeAlert.summary.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50 text-xs">
                      <span className="text-slate-500 font-medium">Priority:</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        activeAlert.priority === "High"
                          ? "bg-rose-100 text-rose-700"
                          : activeAlert.priority === "Medium"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>{activeAlert.priority}</span>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500 font-medium">Flag:</span>
                      <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-semibold">{activeAlert.flag}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Call History */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 text-sm">Call History (Retailer: {activeAlert.retailer})</h2>
                <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">Activity Logs</span>
              </div>

              <div className="overflow-x-auto">
                <table className="table table-xs w-full text-xs text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-200">
                      <th className="pb-2 font-semibold">Date &amp; Time</th>
                      <th className="pb-2 font-semibold">Call ID</th>
                      <th className="pb-2 font-semibold">Duration</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">AI Agent ID</th>
                      <th className="pb-2 font-semibold text-right">Flag Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeAlert.history.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-2.5 text-slate-600 font-medium">{h.date}</td>
                        <td className="py-2.5 text-slate-700 font-semibold font-mono text-[10px]">{h.id}</td>
                        <td className="py-2.5 text-slate-600">{h.dur}</td>
                        <td className={`py-2.5 ${h.statusColor} font-semibold`}>{h.status}</td>
                        <td className="py-2.5 text-slate-400 font-mono text-[10px]">{h.agent}</td>
                        <td className="py-2.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${h.flagColor}`}>
                            {h.flag}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Total Calls: {activeAlert.history.length}</span>
              <button className="text-indigo-600 font-bold hover:underline">View Full Retailer Audit Trail</button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-between mt-auto text-xs text-slate-400 font-medium">
        <span>All times are in Asia/Kolkata (IST)</span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block animate-pulse"></span>
          <span>AI Auto-Classification Enabled</span>
        </div>
      </footer>
    </>
  );
}
