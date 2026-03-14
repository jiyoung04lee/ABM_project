import HeroBackground from "@/shared/components/layout/HeroBackground";

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroBackground variant="large">
      <div className="w-full min-h-screen pt-12">
        {children}
      </div>
    </HeroBackground>
  );
}