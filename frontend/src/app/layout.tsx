import "./globals.css";
import Header from "@/shared/components/layout/Header";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-white">
        <Header isLoggedIn={false} />
        <main className="pt-16">
          {children}
        </main>
      </body>
    </html>
  );
}