"use client";

import { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import Link from "next/link";

export default function AIVoiceDashboard() {
  const outcomesChartRef = useRef(null);
  const callsOverTimeChartRef = useRef(null);
  const languageChartRef = useRef(null);

  const outcomesChartInstance = useRef(null);
  const callsOverTimeChartInstance = useRef(null);
  const languageChartInstance = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCalls: "—",
    answeredCalls: "—",
    avgDurationStr: "—",
    uniqueLeads: "—",
    issuesFlagged: "—",
    estAiCost: "—",
    tokensLlmStr: "—",
    minutesUsed: "—"
  });

  const [liveActivities, setLiveActivities] = useState([
    { time: "20:46:12", text: "Call #8912 Converted: Shree Medical", status: "CLIENT", color: "text-emerald-600 font-bold" },
    { time: "20:45:05", text: "AI Call Answered: Gupta Pharma", status: "ANSWERED", color: "text-indigo-600 font-bold" },
    { time: "20:42:30", text: "Price Flag Raised: Apex Pharmacy", status: "FLAGGED", color: "text-rose-500 font-bold" },
    { time: "20:39:18", text: "WhatsApp Escalated: City Healthcare", status: "ESCALATED", color: "text-amber-500 font-semibold" },
  ]);

  const [clientList, setClientList] = useState([
    { name: "Shree Medical Store", state: "Maharashtra, IN", val: "₹12,500" },
    { name: "Gupta Pharma", state: "Delhi, IN", val: "₹8,200" },
    { name: "Apex Pharmacy", state: "Karnataka, IN", val: "₹15,400" },
    { name: "Metro Chemists", state: "Gujarat, IN", val: "₹9,800" },
    { name: "City Healthcare", state: "West Bengal, IN", val: "₹22,100" }
  ]);

  const [distributors, setDistributors] = useState([
    { name: "Vardhaman Pharma", calls: 142, issues: 12, rate: "8.4%", color: "text-emerald-600" },
    { name: "Mahaveer Distrib.", calls: 210, issues: 34, rate: "16.2%", color: "text-orange-500" },
    { name: "Khandelwal Med.", calls: 98, issues: 28, rate: "28.5%", color: "text-rose-500" }
  ]);

  const [states, setStates] = useState([
    { name: "Maharashtra", calls: 410, issues: 42, rate: "10.2%", color: "text-indigo-600" },
    { name: "Delhi", calls: 320, issues: 12, rate: "3.7%", color: "text-emerald-600" },
    { name: "Karnataka", calls: 290, issues: 38, rate: "13.1%", color: "text-rose-500" }
  ]);

  const [callLog, setCallLog] = useState([]);

  const [issuesBreakdown, setIssuesBreakdown] = useState([
    { label: "🏷️ Price Discrepancies", pct: 42, text: "42% (37 flags)", color: "bg-rose-500" },
    { label: "🚚 Distributor Delivery Delay", pct: 28, text: "28% (24 flags)", color: "bg-orange-400" },
    { label: "📦 Out of Stock / Damaged Items", pct: 18, text: "18% (16 flags)", color: "bg-amber-400" },
    { label: "📋 Incorrect Scheme Offermatch", pct: 12, text: "12% (10 flags)", color: "bg-indigo-500" }
  ]);

  const [activitySimText, setActivitySimText] = useState("Simulating live calling events...");
  const [isSimActiveText, setIsSimActiveText] = useState(false);

  // Call Detail Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalTab, setModalTab] = useState("transcript"); // transcript | raw

  const openCallDetail = async (callId) => {
    setModalOpen(true);
    setModalLoading(true);
    setModalTab("transcript");
    try {
      const res = await fetch(`/api/call-detail/${callId}`);
      const json = await res.json();
      if (json.success) setModalData(json);
      else setModalData(null);
    } catch (e) {
      console.error("Failed to load call detail:", e);
      setModalData(null);
    } finally {
      setModalLoading(false);
    }
  };

  // Lists for simulation
  const stores = [
    "Royal Chemist", "Balaji Medicine", "Sai Krupa Remedies", 
    "Pioneer Wellness", "Janata Medicos", "Saraswati Pharmacy", 
    "Medicare Point", "Metro Healthways", "Wellness First"
  ];

  const actions = [
    { text: "Call Answered by AI Rep", status: "ANSWERED", color: "text-indigo-600 font-bold" },
    { text: "Call Converted to Client", status: "CLIENT", color: "text-emerald-600 font-bold" },
    { text: "Price Flag Raised", status: "FLAGGED", color: "text-rose-500 font-bold" },
    { text: "WhatsApp Escalated", status: "ESCALATED", color: "text-amber-500 font-semibold" },
    { text: "Call Scheduled Retry", status: "RETRY", color: "text-blue-500 font-bold" }
  ];

  const getFormattedTime = () => {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, "0");
    const mins = String(now.getMinutes()).padStart(2, "0");
    const secs = String(now.getSeconds()).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  const simulateEvent = () => {
    const randomStore = stores[Math.floor(Math.random() * stores.length)];
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    const time = getFormattedTime();
    const callNum = Math.floor(Math.random() * 2000) + 8000;

    const newActivity = {
      time,
      text: `Call #${callNum} ${randomAction.text}: ${randomStore}`,
      status: randomAction.status,
      color: randomAction.color,
    };

    setLiveActivities(prev => [newActivity, ...prev.slice(0, 5)]);

    setActivitySimText(`Simulated call activity at ${time}`);
    setIsSimActiveText(true);

    setTimeout(() => {
      setActivitySimText("Simulating live calling events...");
      setIsSimActiveText(false);
    }, 2500);
  };

  const buildCharts = (chartsData) => {
    if (!chartsData) return;

    // 1. Call Outcomes Chart
    if (outcomesChartRef.current) {
      if (outcomesChartInstance.current) outcomesChartInstance.current.destroy();
      outcomesChartInstance.current = new Chart(outcomesChartRef.current, {
        type: "doughnut",
        data: {
          labels: chartsData.outcomes?.labels || ["Clients (Converted)", "Other Active Leads"],
          datasets: [{
            data: chartsData.outcomes?.data || [542, 1300],
            backgroundColor: ["#6366f1", "#e2e8f0"],
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

    // 2. Calls Over Time Chart
    if (callsOverTimeChartRef.current) {
      if (callsOverTimeChartInstance.current) callsOverTimeChartInstance.current.destroy();
      const ctx = callsOverTimeChartRef.current.getContext("2d");
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, "rgba(99, 102, 241, 0.35)");
      gradient.addColorStop(1, "rgba(99, 102, 241, 0.00)");

      callsOverTimeChartInstance.current = new Chart(callsOverTimeChartRef.current, {
        type: "line",
        data: {
          labels: chartsData.callsOverTime?.labels || ["May 21", "May 22", "May 23", "May 24", "May 25", "May 26", "May 27"],
          datasets: [{
            label: "Calls Answered",
            data: chartsData.callsOverTime?.data || [180, 210, 195, 245, 220, 275, 295],
            borderColor: "#6366f1",
            borderWidth: 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#6366f1",
            pointHoverRadius: 7
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              grid: { color: "#f1f5f9" },
              ticks: {
                color: "#94a3b8",
                font: { family: "Outfit", size: 11 }
              }
            },
            x: {
              grid: { display: false },
              ticks: {
                color: "#94a3b8",
                font: { family: "Outfit", size: 11 }
              }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // 3. Language Mix Chart
    if (languageChartRef.current) {
      if (languageChartInstance.current) languageChartInstance.current.destroy();
      languageChartInstance.current = new Chart(languageChartRef.current, {
        type: "pie",
        data: {
          labels: chartsData.languages?.labels || ["Hindi", "English", "Marathi", "Others"],
          datasets: [{
            data: chartsData.languages?.data || [60, 25, 10, 5],
            backgroundColor: ["#4f46e5", "#10b981", "#f59e0b", "#cbd5e1"],
            borderWidth: 1.5,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  };

  // Setup simulation interval & fetch real MongoDB metrics
  useEffect(() => {
    const interval = setInterval(simulateEvent, 10000);

    async function loadMetrics() {
      try {
        const response = await fetch("/api/dashboard-metrics");
        const json = await response.json();
        if (json.success) {
          setStats({
            totalCalls: json.stats.totalCalls,
            answeredCalls: json.stats.answeredCalls,
            avgDurationStr: json.stats.avgDurationStr,
            uniqueLeads: json.stats.uniqueLeads,
            issuesFlagged: json.stats.issuesFlagged,
            estAiCost: json.stats.estAiCost,
            tokensLlmStr: json.stats.tokensLlmStr,
            minutesUsed: json.stats.minutesUsed
          });
          setLiveActivities(json.liveActivities);
          setClientList(json.clientList);
          setDistributors(json.distributors);
          setStates(json.states);
          setIssuesBreakdown(json.issuesBreakdown);
          setCallLog(json.callLog || []);
          buildCharts(json.charts);
        } else {
          console.error("Dashboard API error:", json.error);
        }
      } catch (err) {
        console.error("Failed to load DB metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();

    return () => {
      clearInterval(interval);
      if (outcomesChartInstance.current) outcomesChartInstance.current.destroy();
      if (callsOverTimeChartInstance.current) callsOverTimeChartInstance.current.destroy();
      if (languageChartInstance.current) languageChartInstance.current.destroy();
    };
  }, []);

  const filteredDistributors = distributors.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStates = states.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between sticky top-0 z-10 shadow-sm gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            AI Voice Dashboard
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-indigo-50/80 text-indigo-700 border border-indigo-100">Local Test Mode</span>
          </h1>
          <p className="text-xs text-slate-500">Performance, Usage, Analytics &amp; Operations Overview (Simulated Data)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white text-xs text-slate-700 font-medium shadow-sm">
            <span>📅</span>
            <span>Last 7 Days (May 2026)</span>
          </div>
          {/* Table Search Bar */}
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search tables..." 
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
        {/* Warning Alert Box */}
        <div className="alert bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-800 shadow-sm">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="flex-1">
            <h3 className="font-semibold text-sm leading-tight">Production Environment Bypass</h3>
            <p className="text-xs text-amber-700 mt-1">This HTML sandbox bypasses Next.js page loaders and reads from hardcoded high-fidelity mock data. It is specifically built for debugging dashboard modules independent of backend crashes or database locks.</p>
          </div>
          <button 
            onClick={(e) => e.currentTarget.closest(".alert").remove()} 
            className="btn btn-ghost btn-xs text-amber-500 hover:text-amber-700 px-2 py-1 hover:bg-amber-100 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: "Total Calls", val: stats.totalCalls, desc: "↑ 12.4% vs last week", emoji: "📞", bg: "bg-purple-50", color: "text-purple-600" },
            { label: "Answered", val: stats.answeredCalls, desc: "↑ 87.9% Ans. rate", emoji: "📲", bg: "bg-emerald-50", color: "text-emerald-600" },
            { label: "Avg. Duration", val: stats.avgDurationStr, desc: "↓ -12s vs last week", emoji: "⏱️", bg: "bg-orange-50", color: "text-orange-600" },
            { label: "Unique Leads", val: stats.uniqueLeads, desc: "↑ 4.8% Active growth", emoji: "👤", bg: "bg-blue-50", color: "text-blue-600" },
            { label: "Issues Flagged", val: stats.issuesFlagged, desc: "↑ 8.2% Flag rate", emoji: "🚩", bg: "bg-rose-50", color: "text-rose-600" },
            { label: "Est. AI Cost", val: stats.estAiCost, desc: "Avg. ₹5 / call", emoji: "₹", bg: "bg-red-50", color: "text-rose-600" },
            { label: "Tokens (LLM)", val: stats.tokensLlmStr, desc: "↑ 18.2% Context density", emoji: "💬", bg: "bg-teal-50", color: "text-teal-600" },
            { label: "Minutes Used", val: stats.minutesUsed, desc: "↑ 9.6% Usage load", emoji: "⏱️", bg: "bg-yellow-50", color: "text-yellow-600" },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-3.5 flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-8 h-8 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center text-sm font-bold`}>
                {stat.emoji}
              </div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">{stat.label}</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{stat.val}</p>
              <p className={`text-[10px] ${stat.desc.startsWith("↓") ? "text-rose-500" : stat.desc.startsWith("Avg") ? "text-slate-500" : "text-emerald-600"} font-semibold flex items-center gap-0.5`}>
                {stat.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Middle Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Call Outcomes & Customers List */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-800 text-sm">Call Outcomes / Leads</h2>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">Active Pipeline</span>
              </div>
              <div className="relative h-44 flex items-center justify-center">
                <canvas ref={outcomesChartRef}></canvas>
              </div>
              
              <div className="space-y-2 mt-4">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-500"></span>
                    <span className="text-slate-600 font-medium">Clients (Answered & Converted)</span>
                  </div>
                  <span className="text-slate-800 font-bold">{stats.answeredCalls}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-slate-200"></span>
                    <span className="text-slate-600 font-medium">Other Active Leads</span>
                  </div>
                  <span className="text-slate-800 font-semibold">{parseInt(stats.uniqueLeads) - parseInt(stats.answeredCalls) || 0}</span>
                </div>
              </div>
            </div>

            {/* Customer Leads */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700">Top Converted Clients</span>
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-medium">Stage: Client</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {clientList.map((client, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{client.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{client.state}</p>
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">{client.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calls Over Time Chart */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 text-sm">Calls Over Time (Last 7 Days)</h2>
              <select className="select select-bordered select-xs text-[10px] font-semibold border border-slate-200 rounded-lg px-2.5 py-1 text-slate-600 bg-white shadow-sm focus:outline-none max-w-xs">
                <option>Daily Trend</option>
                <option>Hourly Trend</option>
              </select>
            </div>
            <div className="h-80 relative flex items-center justify-center">
              <canvas ref={callsOverTimeChartRef}></canvas>
            </div>
          </div>


        </div>



        {/* Call Log Section */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                Call Log
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{callLog.length} records · Last 100 calls from database</p>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full font-semibold border border-indigo-100">Live DB</span>
          </div>

          {callLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm font-medium">No calls recorded yet</p>
              <p className="text-xs mt-1">Call data will appear here after the first AI call completes</p>
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
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Duration</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Status</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Sentiment</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 text-center">Tries</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Tokens</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Summary</th>
                    <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {callLog.map((row, i) => {
                    const colorMap = {
                      emerald: "bg-emerald-50 text-emerald-700",
                      indigo: "bg-indigo-50 text-indigo-700",
                      rose: "bg-rose-50 text-rose-700",
                      amber: "bg-amber-50 text-amber-700",
                      orange: "bg-orange-50 text-orange-700",
                      blue: "bg-blue-50 text-blue-700",
                      slate: "bg-slate-100 text-slate-600"
                    };
                    return (
                      <tr
                        key={i}
                        className="hover:bg-indigo-50/40 hover:shadow-sm transition-all cursor-pointer group border-b border-slate-50 last:border-0"
                        onClick={() => openCallDetail(row.fullId)}
                        title="Click to view call detail"
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
                        <td className="px-4 py-3">
                          <span className={`font-mono font-bold ${
                            row.durationSec > 120 ? "text-emerald-600" :
                            row.durationSec > 0 ? "text-amber-600" : "text-slate-400"
                          }`}>{row.duration}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorMap[row.status?.color] || colorMap.slate}`}>
                            {row.status?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.sentiment ? (
                            <span className={`text-[10px] font-semibold ${
                              row.sentiment.color === "emerald" ? "text-emerald-600" :
                              row.sentiment.color === "rose" ? "text-rose-500" : "text-slate-500"
                            }`}>
                              {row.sentiment.color === "emerald" ? "😊" : row.sentiment.color === "rose" ? "😟" : "😐"} {row.sentiment.label}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                            row.attempts > 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>{row.attempts}</span>
                        </td>
                        <td className="px-4 py-3">
                          {row.tokens ? (
                            <span className="font-mono text-[10px] text-teal-600 font-semibold">{parseInt(row.tokens).toLocaleString()}</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          {row.summary ? (
                            <span className="text-slate-500 leading-tight line-clamp-2 block group-hover:text-indigo-600 transition-colors">{row.summary}</span>
                          ) : (
                            <span className="text-indigo-400 font-medium group-hover:text-indigo-600 transition-colors">View detail →</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 whitespace-nowrap">{row.date}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Call Detail Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
              <div>
                {modalLoading ? (
                  <div className="h-5 w-48 bg-slate-200 rounded animate-pulse mb-2"></div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-900">{modalData?.call?.name || "Call Detail"}</h2>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{modalData?.call?.phone}</span>
                      {modalData?.call?.shopName && modalData.call.shopName !== "—" && (
                        <><span className="text-slate-300">·</span><span>{modalData.call.shopName}</span></>
                      )}
                      {modalData?.call?.roomId && (
                        <><span className="text-slate-300">·</span><span className="font-mono text-[10px] text-slate-400">{modalData.call.roomId}</span></>
                      )}
                    </p>
                  </>
                )}
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold transition-colors p-1">✕</button>
            </div>

            {modalLoading ? (
              <div className="flex-1 flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm">Loading call details...</p>
                </div>
              </div>
            ) : !modalData ? (
              <div className="flex-1 flex items-center justify-center py-20 text-slate-400">
                <p className="text-sm">Failed to load call details.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Meta Info Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100">
                  {[
                    { label: "Duration", val: modalData.call.duration },
                    { label: "Status", val: modalData.call.status?.replace(/_/g, " ") || "—" },
                    { label: "Sentiment", val: modalData.call.sentiment ? (modalData.call.sentiment === "positive" ? "😊 Positive" : modalData.call.sentiment === "negative" ? "😟 Negative" : "😐 Neutral") : "—" },
                    { label: "Attempts", val: modalData.call.attempts },
                    { label: "Language", val: modalData.call.agentLanguage || "—" },
                    { label: "Tokens", val: modalData.call.tokenUsage ? (modalData.call.tokenUsage.totals?.total_tokens || modalData.call.tokenUsage.total_tokens || "—") : "—" },
                    { label: "Date", val: modalData.call.createdAt ? new Date(modalData.call.createdAt).toLocaleString("en-IN") : "—" }
                  ].map((item, i) => (
                    <div key={i}>
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5 capitalize">{item.val}</p>
                    </div>
                  ))}
                </div>

                {/* AI Summary */}
                {modalData.call.summary && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">AI Summary</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{modalData.call.summary}</p>
                    {modalData.call.nextAction && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-indigo-500">Next Action:</span>
                        <span className="text-xs text-indigo-700 font-medium">{modalData.call.nextAction}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Recording Audio Player */}
                {["answered", "completed", "accepted", "transferred"].includes(modalData.call.status) && modalData.recording?.fileUrl && (
                  <div className="px-6 py-4 border-b border-slate-100">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">📼 Recording</p>
                    <audio
                      controls
                      className="w-full h-10 rounded-lg"
                      src={modalData.recording.fileUrl}
                    />
                    <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
                      {modalData.recording.duration && <span>⏱ {Math.floor(modalData.recording.duration / 60)}:{String(Math.round(modalData.recording.duration % 60)).padStart(2, "0")}</span>}
                      {modalData.recording.size && <span>📦 {(modalData.recording.size / 1024 / 1024).toFixed(1)} MB</span>}
                      <span className="uppercase font-mono">{modalData.recording.format}</span>
                      <a href={modalData.recording.fileUrl} download target="_blank" rel="noreferrer" className="text-indigo-500 font-semibold hover:underline ml-auto">⬇ Download</a>
                    </div>
                  </div>
                )}

                {/* Tabs: Transcript / Raw */}
                {["answered", "completed", "accepted", "transferred"].includes(modalData.call.status) && (
                <div className="px-6 pt-4">
                  <div className="flex gap-1 border-b border-slate-100 mb-4">
                    {["transcript", "raw"].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setModalTab(tab)}
                        className={`px-4 py-2 text-xs font-semibold rounded-t-lg border border-b-0 transition-colors ${
                          modalTab === tab
                            ? "bg-white border-slate-200 text-indigo-600 -mb-px"
                            : "bg-slate-50 border-transparent text-slate-400 hover:text-slate-600"
                        }`}
                      >
                        {tab === "transcript" ? "💬 Transcript" : "📄 Raw Transcript"}
                      </button>
                    ))}
                  </div>

                  {/* Parsed Transcript */}
                  {modalTab === "transcript" && (
                    <div className="pb-6">
                      {modalData.transcriptLines.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                          <p className="text-3xl mb-2">💬</p>
                          <p className="text-sm">No transcript lines saved yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {modalData.transcriptLines.map((line, i) => {
                            const isAgent = line.role === "agent" || line.role === "assistant";
                            return (
                              <div key={i} className={`flex gap-3 ${isAgent ? "" : "flex-row-reverse"}` }>
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

                  {/* Raw Transcript */}
                  {modalTab === "raw" && (
                    <div className="pb-6">
                      {modalData.call.rawTranscript ? (
                        <pre className="bg-slate-950 text-emerald-400 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">{modalData.call.rawTranscript}</pre>
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
                )}
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
          <span>Auto-syncing simulation logs</span>
        </div>
      </footer>
    </>
  );
}
