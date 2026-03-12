import "./globals.css";
import Header from "@/shared/components/layout/Header";
import { NotificationProvider } from "@/shared/contexts/NotificationContext";
import PageViewTracker from "@/shared/components/PageViewTracker";
import AnnouncementBanner from "@/shared/components/AnnouncementBanner";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        <NotificationProvider>
          <PageViewTracker />
          <Header />
          <AnnouncementBanner />
          <main className="pt-12">{children}</main>
        </NotificationProvider>
      </body>
    </html>
  );
}