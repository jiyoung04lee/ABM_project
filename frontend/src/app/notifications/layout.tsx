import HeroBackground from "@/shared/components/layout/HeroBackground";
import Header from "@/shared/components/layout/Header";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroBackground variant="large">
      <div className="w-full min-h-screen">
        <Header />
        <div className="pt-12">{children}</div>
      </div>
    </HeroBackground>
  );
}