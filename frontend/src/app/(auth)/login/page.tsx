"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/shared/components/layout/Logo";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const KAKAO_REST_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ?? "";

export default function LoginPage() {
  const router = useRouter();

  const handleKakaoLogin = () => {
    if (!KAKAO_REST_KEY) {
      alert("카카오 로그인 설정이 없습니다. NEXT_PUBLIC_KAKAO_REST_API_KEY를 설정해주세요.");
      return;
    }
    const redirectUri =
      typeof window !== "undefined"
        ? `${window.location.origin}/login/kakao-callback`.replace(/\/+$/, "")
        : "";
    const url = new URL("https://kauth.kakao.com/oauth/authorize");
    url.searchParams.set("client_id", KAKAO_REST_KEY);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    window.location.href = url.toString();
  };

  return (
    <>
      <div className="mb-5">
        <Logo />
      </div>

      <h1 className="text-[2rem] font-bold text-gray-900 mb-1.5">로그인</h1>
      <p className="text-gray-500 text-sm mb-8">
        AI빅데이터융합경영학과에 오신 것을 환영합니다
      </p>

      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8">
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleKakaoLogin}
            className="w-full py-3.5 bg-[#FEE500] text-[#191919] rounded-xl font-semibold text-base hover:bg-[#FADA0A] active:bg-[#E6D000] transition flex items-center justify-center gap-2"
          >
            <KakaoIcon />
            카카오로 로그인
          </button>
        </div>

        <p className="text-center text-sm text-gray-400 mt-5">
          카카오 계정으로 간편하게 시작하세요.
        </p>
      </div>
    </>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.966C1.5 6.665 6.201 3 12 3Z" />
    </svg>
  );
}
