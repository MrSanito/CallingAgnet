import Link from "next/link";
import IndustriesCarousel from "@/components/IndustriesCarousel";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center p-8 bg-slate-50 min-h-screen">
      <div className="max-w-4xl w-full flex flex-col items-center space-y-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 p-8 text-center space-y-6">
          {/* Brand Icon */}
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-3xl text-white shadow-lg shadow-indigo-500/25 mx-auto">
            S
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">SalesCRM AI Web Portal</h1>
            <p className="text-sm text-slate-500">Welcome to the interactive preview dashboards. Select a module below to inspect live mock feeds and analytics.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4">
            <Link
              href="/aivoice"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group"
            >
              <div>
                <p className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span>📞</span> AI Voice Dashboard
                </p>
                <p className="text-xs text-slate-400 mt-1">Analytics, call status tracking & retry queue.</p>
              </div>
              <span className="text-slate-400 group-hover:text-indigo-600 transition-colors font-bold text-sm">&rarr;</span>
            </Link>

            <Link
              href="/aialerts"
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 text-left transition-all group"
            >
              <div>
                <p className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <span>🚩</span> Alerts & Flags
                </p>
                <p className="text-xs text-slate-400 mt-1">AI transcript analyser, billing alerts & history.</p>
              </div>
              <span className="text-slate-400 group-hover:text-indigo-600 transition-colors font-bold text-sm">&rarr;</span>
            </Link>
          </div>

          <div className="text-[10px] text-slate-400 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span>Version 0.1.0</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Preview Server Live
            </span>
          </div>
        </div>
        
        {/* Carousel Section */}
        <div className="w-full max-w-full overflow-hidden pt-4">
          <p className="text-center text-sm font-semibold text-slate-500 mb-4 uppercase tracking-wider">Trusted across industries</p>
          <IndustriesCarousel />
        </div>
      </div>
    </div>
  );
}
