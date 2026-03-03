import "./globals.css";
import Header from "@/shared/components/layout/Header";
import { NotificationProvider } from "@/shared/contexts/NotificationContext";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <NotificationProvider>
          <Header />
          <main className="pt-20">{children}</main>
        </NotificationProvider>
      </body>
    </html>
  );
}