import HeroBackground from "@/shared/components/layout/HeroBackground";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroBackground variant="large">
      <div className="w-full min-h-screen">
        {children}
      </div>
    </HeroBackground>
  );
}