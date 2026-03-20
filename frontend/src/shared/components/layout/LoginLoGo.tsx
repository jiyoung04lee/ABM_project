"use client";

import { useId } from "react";

type LoginLogoProps = {
  width?: number;
  height?: number;
  className?: string;
};

export default function LoginLogo({
  width = 140,
  height = 70,
  className = "",
}: LoginLogoProps) {
  const id = useId();
  const gradientId = `loginLogoTextGradient-${id}`;
  const glowId = `loginLogoGlow-${id}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="AIVE logo"
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" stopOpacity="1" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="1" />
        </linearGradient>

        <filter id={glowId}>
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(0, 8)">
        <text
          x="0"
          y="34"
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
          fontSize="40"
          fontWeight="900"
          textAnchor="start"
          fill={`url(#${gradientId})`}
          opacity="0.28"
          filter={`url(#${glowId})`}
          letterSpacing="-1.5"
        >
          AIVE
        </text>

        <text
          x="0"
          y="34"
          fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, Arial, sans-serif"
          fontSize="40"
          fontWeight="900"
          textAnchor="start"
          fill={`url(#${gradientId})`}
          letterSpacing="-1.5"
        >
          AIVE
        </text>

        <circle cx="78" cy="2.5" r="2.6" fill={`url(#${gradientId})`}>
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