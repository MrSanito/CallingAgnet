"use client";

import React from "react";

const INDUSTRIES = [
  { label: "Real Estate",        sub: "Lead capture & follow-up",    accent: "#3b82f6", glow: "rgba(59,130,246,0.14)",  emoji: "🏢" },
  { label: "Healthcare",         sub: "Appointments & reminders",    accent: "#10b981", glow: "rgba(16,185,129,0.14)",  emoji: "🏥" },
  { label: "Education",          sub: "Admissions & demo booking",   accent: "#f59e0b", glow: "rgba(245,158,11,0.14)",  emoji: "🎓" },
  { label: "Automotive",         sub: "Service & test drives",       accent: "#ef4444", glow: "rgba(239,68,68,0.14)",   emoji: "🚗" },
  { label: "Financial Services", sub: "Leads & callbacks",           accent: "#8b5cf6", glow: "rgba(139,92,246,0.14)",  emoji: "💹" },
  { label: "Hospitality",        sub: "Reservations & queries",      accent: "#f97316", glow: "rgba(249,115,22,0.14)",  emoji: "🏨" },
  { label: "E-Commerce",         sub: "Support & upsell calls",      accent: "#06b6d4", glow: "rgba(6,182,212,0.14)",   emoji: "🛒" },
  { label: "Insurance",          sub: "Policy & renewals",           accent: "#14b8a6", glow: "rgba(20,184,166,0.14)",  emoji: "🛡️" },
  { label: "Legal Services",     sub: "Intake & consultations",      accent: "#a855f7", glow: "rgba(168,85,247,0.14)",  emoji: "⚖️" },
  { label: "Logistics",          sub: "Tracking & dispatch",         accent: "#fb923c", glow: "rgba(251,146,60,0.14)",  emoji: "🚚" },
  { label: "SaaS & Tech",        sub: "Onboarding & demos",          accent: "#6366f1", glow: "rgba(99,102,241,0.14)",  emoji: "💻" },
  { label: "Recruitment",        sub: "Candidate screening",         accent: "#ec4899", glow: "rgba(236,72,153,0.14)",  emoji: "🧑💼" },
];

const doubled = [...INDUSTRIES, ...INDUSTRIES];

export default function IndustriesCarousel() {
  return (
    <div style={{ position: "relative", overflow: "hidden", padding: "8px 0 16px", width: "100%" }}>
      {/* Left fade */}
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "120px", background: "linear-gradient(to right, #f8fafc 0%, transparent 100%)", zIndex: 10, pointerEvents: "none" }} />
      {/* Right fade */}
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "120px", background: "linear-gradient(to left, #f8fafc 0%, transparent 100%)", zIndex: 10, pointerEvents: "none" }} />

      {/* Track */}
      <div className="industries-track">
        {doubled.map((ind, i) => (
          <div
            key={i}
            className="industry-card"
            style={{ "--accent": ind.accent, "--glow": ind.glow }}
          >
            {/* Top accent line */}
            <div style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: "1px", background: `linear-gradient(to right, transparent, ${ind.accent}, transparent)`, opacity: 0.55 }} />

            {/* Icon */}
            <div style={{ width: "42px", height: "42px", borderRadius: "11px", background: ind.glow, border: `1px solid ${ind.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px", marginBottom: "12px", flexShrink: 0 }}>
              {ind.emoji}
            </div>

            {/* Text */}
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b", margin: "0 0 3px", whiteSpace: "nowrap", lineHeight: 1.3 }}>
              {ind.label}
            </p>
            <p style={{ fontSize: "11px", color: "rgba(100,116,139,0.9)", margin: 0, whiteSpace: "nowrap", lineHeight: 1.4 }}>
              {ind.sub}
            </p>

            {/* Dot */}
            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: ind.accent, boxShadow: `0 0 6px ${ind.accent}`, marginTop: "12px", opacity: 0.85 }} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes industries-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .industries-track {
          display: flex;
          gap: 12px;
          width: max-content;
          animation: industries-scroll 38s linear infinite;
        }
        .industries-track:hover {
          animation-play-state: paused;
        }
        .industry-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 18px 20px;
          min-width: 182px;
          background: rgba(255,255,255,1);
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 14px;
          flex-shrink: 0;
          cursor: default;
          transition: background 0.22s ease, border-color 0.22s ease, transform 0.18s ease;
        }
        .industry-card:hover {
          background: var(--glow);
          border-color: color-mix(in srgb, var(--accent) 35%, transparent);
          transform: translateY(-3px);
        }
        @media (prefers-reduced-motion: reduce) {
          .industries-track { animation: none; }
          .industry-card    { transition: none; }
        }
      `}</style>
    </div>
  );
}
