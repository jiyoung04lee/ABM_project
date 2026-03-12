"use client";

import Header from "@/shared/components/layout/Header";
import { usePathname } from "next/navigation";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const hideHeader = pathname !== "/community";

  return (
    <>
      {!hideHeader && <Header />}
      {!hideHeader ? (
        <div className="pt-12">
          {children}
        </div>
      ) : (
        children
      )}
    </>
  );
}