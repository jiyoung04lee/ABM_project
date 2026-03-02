"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Bell } from "lucide-react";
import api from "@/shared/api/axios";
import { useNotification } from "@/shared/contexts/NotificationContext";

export default function Header() {
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem("access_token");
  });

  const [notificationCount, setNotificationCount] = useState(0);
  const { unreadCount, setUnreadCount } = useNotification();

  const messageCount = 0;

  useEffect(() => {
    if (!isLoggedIn) return;

    (async () => {
      try {
        const res = await api.get("notifications/unread_count/");
        setNotificationCount(res.data.unread_count);
      } catch (err) {
        console.error("알림 개수 불러오기 실패", err);
      }
    })();
  }, [isLoggedIn]);

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

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    (async () => {
      try {
        const res = await api.get("/notifications/unread_count/");
        setUnreadCount(res.data.unread_count);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full bg-white border-b border-[#E5E7EB] z-50 min-w-[1024px]">
      <div className="max-w-[1200px] mx-auto px-6 h-18 flex items-center justify-between">

        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 bg-[#2B7FFF] rounded-2xl flex items-center justify-center text-white font-semibold">
              로고
            </div>
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
              <div className="relative cursor-pointer">
                <Mail className="w-6 h-6 text-gray-600" />
              </div>

              <div
                className="relative cursor-pointer"
                onClick={() => router.push("/notifications")}
              >
                <Bell className="w-6 h-6 text-gray-600" />
                {notificationCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#FB2C36] text-white text-xs px-1.5 rounded-full">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                )}
              </div>

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
            <Link
              href="/login"
              className="px-6 py-2 bg-[#2B7FFF] text-white rounded-xl font-medium"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}