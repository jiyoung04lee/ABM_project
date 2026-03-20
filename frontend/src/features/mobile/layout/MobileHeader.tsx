"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, Menu } from "lucide-react";

interface Props {
  title?: string;
  showBack?: boolean;
  showMenu?: boolean;
}

export default function MobileHeader({
  title = "AIVE",
  showBack = false,
  showMenu = true,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const isHome = pathname === "/";

  return (
    <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-slate-200 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {showBack && !isHome ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/" className="text-base font-bold tracking-tight text-slate-900">
              AIVE
            </Link>
          )}

          {title && !isHome && (
            <span className="text-sm font-semibold text-slate-700">{title}</span>
          )}
        </div>

        {showMenu ? (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="메뉴"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>
    </header>
  );
}