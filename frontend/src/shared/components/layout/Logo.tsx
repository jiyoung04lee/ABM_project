export default function Logo() {
  return (
    <svg
      width="140"
      height="44"
      viewBox="0 0 220 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoTextGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style={{ stopColor: "#2563EB", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "#3b82f6", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#4f46e5", stopOpacity: 1 }} />
        </linearGradient>
        <filter id="logoGlow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(0, 8)">
        {/* Glow Effect */}
        <text
          x="0"
          y="42"
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
          fontSize="40"
          fontWeight="900"
          textAnchor="start"
          fill="url(#logoTextGradient)"
          opacity="0.28"
          filter="url(#logoGlow)"
          letterSpacing="-1.5"
        >
          AIVE
        </text>

        {/* Main Text */}
        <text
          x="0"
          y="42"
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
          fontSize="40"
          fontWeight="900"
          textAnchor="start"
          fill="url(#logoTextGradient)"
          letterSpacing="-1.5"
        >
          AIVE
        </text>

        {/* Decorative Dot */}
        <circle cx="78" cy="10" r="2.6" fill="url(#logoTextGradient)">
          <animate
            attributeName="opacity"
            values="1;0.5;1"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}