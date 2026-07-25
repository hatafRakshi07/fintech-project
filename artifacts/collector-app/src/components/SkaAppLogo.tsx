import React from "react";

export function SkaAppLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const [imgFailed, setImgFailed] = React.useState(false);

  if (!imgFailed) {
    return (
      <img
        src="/ska-logo.png"
        alt="SKA Logo"
        style={{ width: size, height: size }}
        className={`object-contain rounded-lg shadow-sm ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950 border border-amber-500/30 shadow-md ${className}`}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full p-1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" stroke="#f5c842" strokeWidth="2" strokeDasharray="6 3" opacity="0.7" />
        <path d="M35 32 Q40 20 50 18 Q60 20 65 32 Z" fill="#d4a017" opacity="0.8" />
        <circle cx="50" cy="14" r="3" fill="#3ac8a0" />
        <path d="M25 55 L75 52" stroke="#f5c842" strokeWidth="3" strokeLinecap="round" />
        <text x="50" y="76" textAnchor="middle" fill="#fff8dc" fontSize="22" fontWeight="900" fontFamily="sans-serif" letterSpacing="1">
          SKA
        </text>
      </svg>
    </div>
  );
}
