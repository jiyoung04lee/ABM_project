"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import LoginLogo from "@/shared/components/layout/LoginLoGo";
import {
  API_BASE,
  ONBOARDING_SIGNUP_STORAGE_KEY,
  ONBOARDING_NONCE_STORAGE_KEY,
} from "@/shared/api/api";


function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorDetail, setErrorDetail] = useState<string>("");

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      return;
    }

    if (!code) {
      setStatus("error");
      return;
    }

    const redirectUri =
      typeof window !== "undefined"
        ? `${window.location.origin}/login/kakao-callback`.replace(/\/+$/, "")
        : "";

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/kakao/login/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, redirect_uri: redirectUri }),
        });
        const data = await res.json();

        if (!res.ok) {
          setErrorDetail(
            typeof data?.detail === "string" ? data.detail : ""
          );
          setStatus("error");
          return;
        }

        if (data.needs_profile) {
          if (typeof data.signup_token === "string" && data.signup_token) {
            sessionStorage.setItem(
              ONBOARDING_SIGNUP_STORAGE_KEY,
              data.signup_token,
            );
          }
          if (typeof data.onboarding_nonce === "string" && data.onboarding_nonce) {
            sessionStorage.setItem(
              ONBOARDING_NONCE_STORAGE_KEY,
              data.onboarding_nonce,
            );
          }
          window.location.href = "/onboarding";
          return;
        }

        if (data.multi_major_pending) {
          window.location.href = "/onboarding/multi-major-pending";
          return;
        }

        if (data.tokens?.access || data.user) {
          if (data.user?.id) {
            localStorage.setItem("user_id", String(data.user.id));
          }
          window.location.href = "/";
          return;
        }

        setStatus("error");
      } catch {
        setStatus("error");
      }
    })();
  }, [searchParams, router]);

  if (status === "error") {
    return (
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8 text-center flex flex-col items-center justify-center">
        <LoginLogo className="translate-x-[18px]" />
        <p className="text-red-500 mt-4">로그인에 실패했습니다.</p>
        {errorDetail && (
          <p className="text-gray-600 text-sm mt-2 break-words">{errorDetail}</p>
        )}
        <a
          href="/login"
          className="inline-block mt-4 text-[#4F6EF7] font-semibold hover:underline"
        >
          로그인 화면으로
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8 text-center flex flex-col items-center justify-center">
      <LoginLogo className="translate-x-[18px]" />
      <p className="text-gray-500 mt-2">로그인 처리 중...</p>
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8 text-center flex flex-col items-center justify-center">
          <LoginLogo className="translate-x-[18px]" />
          <p className="text-gray-500 mt-2">로그인 처리 중...</p>
        </div>
      }
    >
      <KakaoCallbackContent />
    </Suspense>
  );
}
