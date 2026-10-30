// Original, stylized Austin-ish skyline (generic shapes: capitol dome, crown-top tower, slim spire, bridge).
export function Skyline({ glow = true }: { glow?: boolean }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a1f45" />
          <stop offset="1" stopColor="#070914" />
        </linearGradient>
        <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb066" />
          <stop offset="1" stopColor="#ff4fa8" />
        </linearGradient>
      </defs>
      {glow && <ellipse cx="200" cy="118" rx="230" ry="40" fill="#bf5700" opacity=".22" />}
      <g fill="url(#sk)">
        <rect x="0" y="86" width="26" height="34" />
        <rect x="22" y="70" width="18" height="50" />
        <rect x="42" y="58" width="22" height="62" />
        {/* crown-top tower */}
        <path d="M70 120 V44 l12 -14 l12 14 V120 Z" />
        <rect x="80" y="18" width="4" height="14" />
        <rect x="98" y="66" width="20" height="54" />
        {/* capitol */}
        <path d="M128 120 V92 h70 v28 Z" />
        <path d="M146 92 v-10 h34 v10 Z" />
        <path d="M150 82 q13 -26 26 0 Z" />
        <rect x="161" y="48" width="4" height="10" />
        <circle cx="163" cy="47" r="2.5" />
        {/* slim tall spire */}
        <path d="M212 120 V30 l9 -8 l9 8 V120 Z" />
        <rect x="236" y="54" width="24" height="66" />
        <path d="M264 120 V40 h20 l6 8 V120 Z" />
        <rect x="294" y="62" width="18" height="58" />
        <path d="M316 120 V50 l14 -10 l14 10 V120 Z" />
        <rect x="348" y="74" width="22" height="46" />
        <rect x="372" y="88" width="28" height="32" />
      </g>
      <g fill="url(#win)" opacity=".75">
        {[78, 86, 218, 224, 270, 276, 322, 330, 48, 56, 240, 250].map((x, i) => (
          <rect key={i} x={x} y={52 + (i % 4) * 12} width="2.5" height="3" />
        ))}
      </g>
      {/* bridge */}
      <path d="M0 112 Q50 100 100 112 Q150 100 200 112 Q250 100 300 112 Q350 100 400 112" stroke="#2ee6d6" strokeOpacity=".45" strokeWidth="1.5" fill="none" />
      <rect x="0" y="112" width="400" height="8" fill="#070914" />
    </svg>
  );
}
