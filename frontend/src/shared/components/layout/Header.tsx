"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Bell, LayoutDashboard } from "lucide-react";
import api from "@/shared/api/axios";
import { useNotification } from "@/shared/contexts/NotificationContext";
import Logo from "@/shared/components/layout/Logo";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { unreadCount, setUnreadCount } = useNotification();
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);

    if (!token) {
      setIsAdmin(false);
      setUnreadCount(0);
      setMessageCount(0);
      return;
    }

    Promise.all([
      api.get("users/me/"),
      api.get("notifications/unread_count/"),
      api.get("messages/messages/unread_count/"),
    ])
      .then(([meRes, notifRes, msgRes]) => {
        setIsAdmin(meRes.data.is_staff === true);
        setUnreadCount(notifRes.data.unread_count ?? 0);
        setMessageCount(msgRes.data.unread_count ?? 0);
      })
      .catch((err) => {
        console.error("Header auth/counts:", err);
      });
  }, [setUnreadCount]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsLoggedIn(false);
    setIsAdmin(false);
    setUnreadCount(0);
    setMessageCount(0);
    window.location.href = "/";
  };

  const menus = [
    { name: "홈", path: "/" },
    { name: "학과정보", path: "/department" },
    { name: "네트워크", path: "/network" },
    { name: "커뮤니티", path: "/community" },
  ];

  return (
    <>
      {/* 모바일 헤더 */}
      <header className="fixed top-0 left-0 w-full bg-white border-b border-[#E5E7EB] z-50 md:hidden">
        <div className="px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center shrink-0">
            <Logo />
          </Link>

          {isLoggedIn ? (
            <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
              <button
                type="button"
                className="relative flex items-center"
                onClick={() => router.push("/messages")}
              >
                <Mail className="w-5 h-5 text-gray-600" />
                {messageCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#FB2C36] text-white text-[10px] rounded-full">
                    {messageCount > 99 ? "99+" : messageCount}
                  </span>
                )}
              </button>

              <span className="text-gray-300">|</span>

              <button
                type="button"
                className="relative flex items-center"
                onClick={() => router.push("/notifications")}
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-[#FB2C36] text-white text-[10px] rounded-full">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <span className="text-gray-300">|</span>

              <Link href="/profile" className="whitespace-nowrap">
                내정보
              </Link>

              <span className="text-gray-300">|</span>

              <button
                type="button"
                onClick={handleLogout}
                className="whitespace-nowrap"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm font-medium">
              <Link
                href="/register"
                className="text-[#2B7FFF] whitespace-nowrap"
              >
                회원가입
              </Link>

              <span className="text-gray-300">|</span>

              <Link
                href="/login"
                className="text-[#2B7FFF] whitespace-nowrap"
              >
                로그인
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* 데스크톱 헤더 */}
      <header className="hidden md:block fixed top-0 left-0 w-full bg-white border-b border-[#E5E7EB] z-50 min-w-[1024px]">
        <div className="max-w-[1200px] mx-auto px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center">
              <Logo />
            </Link>

            <nav className="flex items-center gap-8 text-[18px] font-semibold">
              {menus.map((menu) => {
                const isActive =
                  pathname === menu.path ||
                  (menu.path !== "/" && pathname.startsWith(menu.path));

                return (
                  <Link
                    key={menu.path}
                    href={menu.path}
                    className={`transition ${
                      isActive
                        ? "text-[#2B7FFF]"
                        : "text-gray-700 hover:text-[#2B7FFF]"
                    }`}
                  >
                    {menu.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-6">
            {isLoggedIn ? (
              <>
                <div
                  className="relative cursor-pointer"
                  onClick={() => router.push("/messages")}
                >
                  <Mail className="w-6 h-6 text-gray-600" />
                  {messageCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#FB2C36] text-white text-xs px-1.5 rounded-full">
                      {messageCount > 99 ? "99+" : messageCount}
                    </span>
                  )}
                </div>

                <div
                  className="relative cursor-pointer"
                  onClick={() => router.push("/notifications")}
                >
                  <Bell className="w-6 h-6 text-gray-600" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 bg-[#FB2C36] text-white text-xs px-1.5 rounded-full">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#2563EB] to-[#8B5CF6] text-white rounded-xl font-medium text-sm hover:shadow-md transition-all"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    관리자
                  </Link>
                )}

                <Link
                  href="/profile"
                  className="px-6 py-2 bg-[#2B7FFF] text-white rounded-xl font-medium"
                >
                  내 정보
                </Link>

                <button
                  onClick={handleLogout}
                  className="text-gray-600 font-medium hover:text-gray-900"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/register"
                  className="px-5 py-2 border border-[#2B7FFF] text-[#2B7FFF] rounded-xl font-medium hover:bg-[#EFF6FF] transition-colors"
                >
                  회원가입
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-2 bg-[#2B7FFF] text-white rounded-xl font-medium hover:bg-[#1d4ed8] transition-colors"
                >
                  로그인
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}