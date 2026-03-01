"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Mail, Bell } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // TODO: 추후 쪽지/알림 API로 대체
  const messageCount = 0;
  const notificationCount = 0;

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    setIsLoggedIn(!!token);
  }, [pathname]);

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

        {/* 왼쪽 영역 */}
        <div className="flex items-center gap-8">
          
          {/* 로고 */}
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 bg-[#2B7FFF] rounded-2xl flex items-center justify-center text-white font-semibold">
              로고
            </div>
          </Link>

          {/* 메뉴 */}
          <nav className="flex items-center gap-8 text-[18px] font-semibold">
            {menus.map((menu) => {
              const isActive = pathname === menu.path;

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

        {/* 오른쪽 영역 */}
        <div className="flex items-center gap-6">
          {isLoggedIn ? (
            <>
              <div className="relative cursor-pointer">
                <Mail className="w-6 h-6 text-gray-600" />
                {messageCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-[#FB2C36] text-white text-xs px-1.5 rounded-full">
                    {messageCount > 99 ? "99+" : messageCount}
                  </span>
                )}
              </div>

              <div className="relative cursor-pointer">
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