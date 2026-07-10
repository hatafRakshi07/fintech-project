import React, { useEffect, useState, useRef } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  drift: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    opacity: Math.random() * 0.6 + 0.2,
    delay: Math.random() * 2,
    duration: Math.random() * 3 + 2,
    drift: (Math.random() - 0.5) * 60,
  }));
}

const PARTICLES = generateParticles(40);

/** SVG peacock feather motif */
function PeacockFeather({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 30 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 78 Q13 60 10 45 Q6 30 2 20 Q8 28 12 40 Q14 50 15 78Z" fill="#d4a017" opacity="0.5"/>
      <path d="M15 78 Q17 60 20 45 Q24 30 28 20 Q22 28 18 40 Q16 50 15 78Z" fill="#d4a017" opacity="0.5"/>
      <path d="M15 78 Q15 55 15 35 Q15 20 15 5" stroke="#d4a017" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="15" cy="18" rx="6" ry="8" fill="#1a3a6b" stroke="#d4a017" strokeWidth="1"/>
      <ellipse cx="15" cy="18" rx="3" ry="4" fill="#00c8a0" opacity="0.8"/>
      <ellipse cx="15" cy="18" rx="1.5" ry="2" fill="#000" opacity="0.9"/>
    </svg>
  );
}

/** Central SKA monogram logo rendered in pure SVG/CSS */
function SKALogo() {
  return (
    <div className="ska-emblem">
      {/* Circular arc border */}
      <svg className="ska-arc" viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="120" cy="120" r="110" stroke="url(#goldGrad)" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.6"/>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="240" y2="240">
            <stop offset="0%" stopColor="#f5c842"/>
            <stop offset="50%" stopColor="#fff8dc"/>
            <stop offset="100%" stopColor="#d4a017"/>
          </linearGradient>
        </defs>
      </svg>

      {/* Krishna silhouette (simplified flute-playing pose) */}
      <svg className="ska-krishna" viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Body */}
        <ellipse cx="60" cy="110" rx="22" ry="28" fill="#1a3a6b" opacity="0.85"/>
        {/* Head */}
        <circle cx="60" cy="70" r="18" fill="#1a3a6b" opacity="0.9"/>
        {/* Crown / Mukut */}
        <path d="M46 55 Q48 40 60 38 Q72 40 74 55" stroke="#d4a017" strokeWidth="2" fill="none"/>
        <line x1="60" y1="38" x2="60" y2="28" stroke="#d4a017" strokeWidth="1.5"/>
        <circle cx="60" cy="26" r="3" fill="#3ac8a0"/>
        {/* Peacock feather on crown */}
        <path d="M60 28 Q65 20 63 12 Q61 18 60 28Z" fill="#d4a017" opacity="0.7"/>
        <ellipse cx="62" cy="13" rx="2.5" ry="3.5" fill="#1a3a6b" stroke="#d4a017" strokeWidth="0.8"/>
        {/* Left arm holding flute */}
        <path d="M42 82 Q32 86 22 84" stroke="#1a3a6b" strokeWidth="8" strokeLinecap="round"/>
        {/* Right arm */}
        <path d="M78 82 Q88 78 95 80" stroke="#1a3a6b" strokeWidth="8" strokeLinecap="round"/>
        {/* Flute */}
        <path d="M30 83 Q52 76 70 80" stroke="#d4a017" strokeWidth="2" strokeLinecap="round"/>
        {/* Lips on flute */}
        <circle cx="60" cy="76" r="2" fill="#d4a017" opacity="0.6"/>
        {/* Yellow dhoti accent */}
        <path d="M40 108 Q60 120 80 108" stroke="#d4a017" strokeWidth="1.5" fill="none" opacity="0.7"/>
        {/* Necklace */}
        <path d="M48 84 Q60 92 72 84" stroke="#fff8dc" strokeWidth="1" fill="none" opacity="0.5"/>
      </svg>

      {/* SKA letters */}
      <div className="ska-letters">
        <span className="ska-s">S</span>
        <span className="ska-k">K</span>
        <span className="ska-a">A</span>
      </div>

      {/* Peacock feathers flanking */}
      <PeacockFeather className="ska-feather ska-feather-left" />
      <PeacockFeather className="ska-feather ska-feather-right" />
    </div>
  );
}

/** Shows real logo image; falls back to SVG emblem if image missing */
function ImageWithFallback({ onLoad }: { onLoad: (loaded: boolean) => void }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  if (imgFailed) {
    onLoad(false);
    return <SKALogo />;
  }
  return (
    <img
      src="/ska-logo.png"
      alt="Shree Krishna Associate"
      className="splash-logo-img"
      draggable={false}
      onLoad={() => onLoad(true)}
      onError={() => { setImgFailed(true); onLoad(false); }}
    />
  );
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const [imgLoaded, setImgLoaded] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timersRef.current.push(setTimeout(() => setPhase("visible"), 300));
    timersRef.current.push(setTimeout(() => setPhase("exit"), 3200));
    timersRef.current.push(setTimeout(() => onDone(), 3900));
    return () => timersRef.current.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div
      className={`splash-root ${phase === "exit" ? "splash-exit" : ""}`}
      aria-hidden="true"
    >
      {/* Gold sparkle particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="splash-particle"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}

      {/* Outer glowing rings */}
      <div className="splash-ring splash-ring-1" />
      <div className="splash-ring splash-ring-2" />
      <div className="splash-ring splash-ring-3" />

      {/* Central content */}
      <div className="splash-center">
        {/* Radial golden glow */}
        <div className="splash-glow" />

        {/* Logo — shows image if present, falls back to SVG emblem */}
        <div className="splash-logo-wrap">
          <ImageWithFallback onLoad={setImgLoaded} />
        </div>

        {/* Company name + tagline — only shown for SVG fallback (image already has text) */}
        {!imgLoaded && (
          <>
            <div className="splash-company-name">
              <span className="splash-initial">S</span>
              <span className="splash-rest">HREE </span>
              <span className="splash-initial">K</span>
              <span className="splash-rest">RISHNA </span>
              <span className="splash-initial">A</span>
              <span className="splash-rest">SSOCIATE</span>
            </div>
            <div className="splash-divider">
              <span className="splash-divider-left" />
              <svg className="splash-lotus" viewBox="0 0 32 32" fill="currentColor" width="18" height="18">
                <path d="M16 4 C13 8 10 10 10 14 C10 17.3 12.7 20 16 20 C19.3 20 22 17.3 22 14 C22 10 19 8 16 4Z" opacity="0.9"/>
                <path d="M10 14 C8 14 6 15 5 17 C7 16 9 15.5 10 14Z" opacity="0.6"/>
                <path d="M22 14 C24 14 26 15 27 17 C25 16 23 15.5 22 14Z" opacity="0.6"/>
                <path d="M14 20 L13 26 L16 24 L19 26 L18 20Z" opacity="0.7"/>
              </svg>
              <span className="splash-divider-right" />
            </div>
            <p className="splash-tagline">
              TRUST &nbsp;|&nbsp; GROWTH &nbsp;|&nbsp; TOGETHER
            </p>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="splash-progress-track">
        <div className="splash-progress-bar" />
      </div>
    </div>
  );
}
