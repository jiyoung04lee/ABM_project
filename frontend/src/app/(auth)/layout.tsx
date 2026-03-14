export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative -mt-20 min-h-[calc(100vh+80px)] w-full overflow-hidden bg-gradient-to-br from-[#DBEAFE] via-[#EEF2FF] to-[#EFF6FF] flex flex-col items-center justify-center pt-32 pb-20 px-4">
      {/* 배경 블러 요소들 */}
      <div className="absolute top-0 left-0 w-[358px] h-[358px] bg-[#8EC5FF] rounded-full blur-[128px] opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[376px] h-[376px] bg-[#A3B3FF] rounded-full blur-[128px] opacity-30 pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[414px] h-[414px] bg-[#51A2FF] rounded-full blur-[128px] opacity-30 pointer-events-none" />
      
      {/* 실제 컨텐츠 박스 */}
      <div className="relative z-10 w-full flex flex-col items-center">
        {children}
      </div>
    </div>
  );
}