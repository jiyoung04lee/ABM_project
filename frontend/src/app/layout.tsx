import "./globals.css";
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
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}