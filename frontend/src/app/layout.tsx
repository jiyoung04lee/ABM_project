import "./globals.css";
import Script from "next/script";
import Header from "@/shared/components/layout/Header";
import { NotificationProvider } from "@/shared/contexts/NotificationContext";
import PageViewTracker from "@/shared/components/PageViewTracker";
import AnnouncementBanner from "@/shared/components/AnnouncementBanner";
import type { Metadata } from "next";

const GTM_ID = "GTM-P86CBNT5";

export const metadata: Metadata = {
  title: "AIVE",
  description: "AI빅데이터융합경영학과 학생들을 위한 정보 아카이브",
  icons: {
    icon: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "AIVE",
    description: "AI빅데이터융합경영학과 학생들을 위한 정보 아카이브",
    url: "https://www.abmaive.com",
    siteName: "AIVE",
    images: [
      {
        url: "https://www.abmaive.com/icons/AIVELOGO.png",
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
      <head>
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      </head>
      <body className="min-h-screen">
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        <NotificationProvider>
          <PageViewTracker />
          <Header />
          <AnnouncementBanner />
          <main className="pt-20 md:pt-12">{children}</main>
        </NotificationProvider>
      </body>
    </html>
  );
}