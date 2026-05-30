"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();

  const isVoiceActive = pathname === "/aivoice";
  const isLeadsActive = pathname === "/leads";
  const isAlertsActive = pathname === "/aialerts" || pathname === "/";

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between flex-shrink-0 border-r border-slate-800 h-screen sticky top-0">
      <div>
        {/* Brand Logo */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-indigo-500/20">
            S
          </div>
          <div>
            <h2 className="font-bold text-sm leading-tight text-white">SalesCRM AI</h2>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Test Server Active
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-4 space-y-1">
          <Link
            href="/aivoice"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isVoiceActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>📞</span>
            AI Voice Dashboard
          </Link>
          <Link
            href="/leads"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isLeadsActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>👥</span>
            Leads
          </Link>
          <Link
            href="/aialerts"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isAlertsActive
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>🚩</span>
            Alerts & Flags
          </Link>
        </nav>
      </div>

      {/* User / Profile Summary */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-400">
          VS
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">Vishal Sharma</p>
          <p className="text-[10px] text-slate-400 truncate">Administrator</p>
        </div>
        <span className="text-[11px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
          OFFLINE
        </span>
      </div>
    </aside>
  );
}
