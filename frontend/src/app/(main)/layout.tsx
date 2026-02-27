import Header from "@/shared/components/layout/Header";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header isLoggedIn={false} />
      <main className="pt-20">{children}</main>
    </div>
  );
}
