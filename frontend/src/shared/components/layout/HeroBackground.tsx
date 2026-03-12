"use client";

interface HeroBackgroundProps {
  children: React.ReactNode;
  variant?: "small" | "large";
}

export default function HeroBackground({
  children,
  variant = "large",
}: HeroBackgroundProps) {

  const heightClass =
    variant === "large"
      ? "min-h-screen"
      : "min-h-[400px]";

  return (
    <section
      className={`relative w-full ${heightClass} justify-center overflow-hidden`}
    >
      {/* 배경 그라디언트 */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#DBEAFE] via-[#EEF2FF] to-[#EFF6FF]" />

      {/* 블러 원 1 - 좌측 상단 */}
      <div className="absolute top-0 left-0 w-[358px] h-[358px] bg-[#8EC5FF] rounded-full blur-[128px] opacity-30" />

      {/* 블러 원 2 - 우측 상단 */}
      <div className="absolute top-0 right-0 w-[376px] h-[376px] bg-[#A3B3FF] rounded-full blur-[128px] opacity-30" />

      {/* 블러 원 3 - 하단 중앙 */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[414px] h-[414px] bg-[#51A2FF] rounded-full blur-[128px] opacity-30" />

      {/* 콘텐츠 */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full text-center">
        {children}
      </div>
    </section>
  );
}