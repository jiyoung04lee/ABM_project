"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Bell, LayoutDashboard } from "lucide-react";
import api from "@/shared/api/axios";
import { useNotification } from "@/shared/contexts/NotificationContext";
import Logo from "@/shared/components/layout/Logo";

export default function Header() {
  const router = useRouter();

  // SSR 단계에서는 항상 로그아웃 상태로 렌더링하고,
  // 클라이언트 마운트 후에만 실제 로그인 여부를 반영한다.
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { unreadCount, setUnreadCount } = useNotification();
  const [messageCount, setMessageCount] = useState(0);
  
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
    if (token) {
      api.get("users/me/")
        .then((res) => setIsAdmin(res.data.is_staff === true))
        .catch(() => setIsAdmin(false));
    }
  }, []);


  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    (async () => {
      try {
        const res = await api.get("notifications/unread_count/");
        setUnreadCount(res.data.unread_count);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    (async () => {
      try {
        const res = await api.get("messages/messages/unread_count/");
        setMessageCount(res.data.unread_count);
      } catch (err) {
        console.error("쪽지 개수 불러오기 실패", err);
      }
    })();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setIsLoggedIn(false);
    window.location.href = "/";
  };

  const menus = [
    { name: "홈", path: "/" },
    { name: "학과정보", path: "/department" },
    { name: "네트워크", path: "/network" },
    { name: "커뮤니티", path: "/community" },
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-white border-b border-[#E5E7EB] z-50 min-w-[1024px]">
      <div className="max-w-[1200px] mx-auto px-6 h-18 flex items-center justify-between">

        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>

          <nav className="flex items-center gap-8 text-[18px] font-semibold">
            {menus.map((menu) => (
              <Link
                key={menu.path}
                href={menu.path}
                className="text-gray-700 hover:text-[#2B7FFF] transition"
              >
                {menu.name}
              </Link>
            ))}
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
  );
}