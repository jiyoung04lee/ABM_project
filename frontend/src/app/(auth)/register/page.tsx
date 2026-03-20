"use client";

import Link from "next/link";
import Logo from "@/shared/components/layout/Logo";

export default function RegisterPage() {
  return (
    <>
      <div className="mb-5">
        <LoginLogo className="translate-x-[18px]" />
      </div>

      <h1 className="text-[2rem] font-bold text-gray-900 mb-1.5">회원가입</h1>
      <p className="text-gray-500 text-sm mb-8">
        카카오 계정으로 간편하게 가입할 수 있습니다
      </p>

      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8 text-center">
        <p className="text-gray-600 text-sm mb-6">
          아래 버튼을 누르면 로그인 화면으로 이동합니다.
          <br />
          카카오로 로그인하면 자동으로 회원가입이 진행됩니다.
        </p>
        <Link
          href="/login"
          className="inline-block w-full py-3.5 bg-[#4F6EF7] text-white rounded-xl font-semibold text-base hover:bg-[#3D5CE8] active:bg-[#3351D4] transition"
        >
          카카오로 시작하기
        </Link>
      </div>
    </>
  );
}
