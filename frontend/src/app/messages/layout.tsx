import HeroBackground from "@/shared/components/layout/HeroBackground";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroBackground variant="large">
      <div className="w-full flex justify-center pt-32 pb-20 min-h-screen">
        {children}
      </div>
    </HeroBackground>
  );
}