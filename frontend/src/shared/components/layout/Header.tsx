"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

interface HeaderProps {
  isLoggedIn?: boolean;
}

export default function Header({ isLoggedIn = true }: HeaderProps) {
  const pathname = usePathname();

  const menus = [
    { name: "홈", path: "/" },
    { name: "학과정보", path: "/department" },
    { name: "네트워크", path: "/network" },
    { name: "커뮤니티", path: "/community" },
  ];

  return (
    <header className="fixed top-0 left-0 w-full bg-white border-b border-[#E5E7EB] z-50 min-w-[1024px]">
      <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center justify-between">

        {/* 왼쪽 영역 */}
        <div className="flex items-center gap-14">
          
          {/* 로고 */}
          <Link href="/" className="flex items-center">
            <div className="w-10 h-10 bg-[#2B7FFF] rounded-2xl flex items-center justify-center text-white font-semibold">
              로고
            </div>
          </Link>

          {/* 메뉴 */}
          <nav className="flex items-center gap-12 text-[18px] font-semibold">
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
              <div className="relative">
                <Image
                  src="/icons/email.svg"
                  alt="email"
                  width={24}
                  height={24}
                />
                <span className="absolute -top-2 -right-2 bg-[#FB2C36] text-white text-xs px-1.5 rounded-full">
                  5
                </span>
              </div>

              <div className="relative">
                <Image
                  src="/icons/bell.svg"
                  alt="bell"
                  width={24}
                  height={24}
                />
                <span className="absolute -top-2 -right-2 bg-[#FB2C36] text-white text-xs px-1.5 rounded-full">
                  99+
                </span>
              </div>

              <Link
                href="/mypage"
                className="px-6 py-2 bg-[#2B7FFF] text-white rounded-xl font-medium"
              >
                내 정보
              </Link>

              <button className="text-gray-600 font-medium">
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