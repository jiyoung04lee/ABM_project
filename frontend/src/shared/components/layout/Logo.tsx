export default function Logo() {
  return (
    <svg
      width="220"
      height="70"
      viewBox="0 0 400 200"
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
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 전체 로고를 살짝 아래로 내리기 위해 그룹에 transform 적용 */}
      <g transform="translate(0, 20)">
        {/* Glow Effect */}
        <text
          x="200"
          y="110"
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
          fontSize="80"
          fontWeight="900"
          textAnchor="middle"
          fill="url(#logoTextGradient)"
          opacity="0.3"
          filter="url(#logoGlow)"
          letterSpacing="-2"
        >
          AIVE
        </text>

        {/* Main Text */}
        <text
          x="200"
          y="110"
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
          fontSize="80"
          fontWeight="900"
          textAnchor="middle"
          fill="url(#logoTextGradient)"
          letterSpacing="-2"
        >
          AIVE
        </text>

        {/* Decorative Dot */}
        <circle cx="200" cy="45" r="4" fill="url(#logoTextGradient)">
          <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
        </circle>
      </g>

    </svg>
  );
}
