import "./globals.css";
import Header from "@/shared/components/layout/Header";
import { NotificationProvider } from "@/shared/contexts/NotificationContext";
import PageViewTracker from "@/shared/components/PageViewTracker";
import AnnouncementBanner from "@/shared/components/AnnouncementBanner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIVE",
  description: "AI빅데이터융합경영학과 학생들을 위한 정보 아카이브",
  openGraph: {
    title: "AIVE",
    description: "AI빅데이터융합경영학과 학생들을 위한 정보 아카이브",
    url: "https://www.abmaive.com",
    siteName: "AIVE",
    images: [
      {
        url: "https://www.abmaive.com/images/AIVELOGO.png",
        width: 1200,
        height: 630,
        alt: "AIVE",
      },
    ],
    locale: "ko_KR",
    type: "website",
  },
};

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