"use client";

import { useEffect, useState } from "react";
import LoginLogo from "@/shared/components/layout/LoginLoGo";
import { API_BASE } from "@/shared/api/api";

const KAKAO_REST_KEY = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY ?? "";

export default function LoginPage() {
  const [reason, setReason] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setReason(params.get("reason"));
  }, []);

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

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");

    if (!adminEmail.trim() || !adminPassword) {
      setAdminError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setAdminLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/users/admin-login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAdminError(data?.detail ?? "로그인에 실패했습니다.");
        return;
      }

      if (data.tokens?.access) {
        localStorage.setItem("access_token", data.tokens.access);
        if (data.tokens.refresh) {
          localStorage.setItem("refresh_token", data.tokens.refresh);
        }
        if (data.user?.id) {
          localStorage.setItem("user_id", String(data.user.id));
        }

        window.location.href = "/admin";
        return;
      }

      setAdminError("로그인에 실패했습니다.");
    } catch {
      setAdminError("네트워크 오류입니다.");
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="w-full flex justify-center px-6 py-10">
      <div className="w-full max-w-[460px] flex flex-col items-center text-center">
        <div className="mb-6 w-full flex justify-center">
          <LoginLogo />
        </div>

        {reason && (
          <div className="mb-4 w-full bg-blue-50 border border-blue-100 text-sm text-blue-900 px-4 py-3 rounded-xl">
            더 많은 글을 보고 싶다면 로그인을 해주세요.
          </div>
        )}

        <h1 className="text-[2rem] font-bold text-gray-900 mb-1.5">로그인</h1>

        <p className="text-gray-500 text-sm mb-8">
          AI빅데이터융합경영학과에 오신 것을 환영합니다
        </p>

        <div className="w-full bg-white rounded-2xl shadow-lg px-8 py-8 text-left">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleKakaoLogin}
              className="w-full py-3.5 bg-[#FEE500] text-[#191919] rounded-xl font-semibold text-base hover:bg-[#FADA0A] active:bg-[#E6D000] transition flex items-center justify-center gap-2"
            >
              <KakaoIcon />
              카카오로 로그인
            </button>

            <div className="relative my-2">
              <span className="block border-t border-gray-200" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-gray-400">
                또는
              </span>
            </div>

            {!showAdmin ? (
              <button
                type="button"
                onClick={() => setShowAdmin(true)}
                className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl"
              >
                관리자 로그인
              </button>
            ) : (
              <form onSubmit={handleAdminLogin} className="flex flex-col gap-3 pt-1">
                <input
                  type="email"
                  placeholder="이메일"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  autoComplete="email"
                />

                <input
                  type="password"
                  placeholder="비밀번호"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent"
                  autoComplete="current-password"
                />

                {adminError && (
                  <p className="text-sm text-red-500">{adminError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdmin(false);
                      setAdminError("");
                      setAdminEmail("");
                      setAdminPassword("");
                    }}
                    className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50"
                  >
                    취소
                  </button>

                  <button
                    type="submit"
                    disabled={adminLoading}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-[#2563EB] rounded-xl hover:bg-[#1d4ed8] disabled:opacity-50"
                  >
                    {adminLoading ? "로그인 중..." : "관리자 로그인"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-center text-sm text-gray-400 mt-5">
            카카오 계정으로 간편하게 시작하세요.
          </p>
        </div>
      </div>
    </div>
  );
}

function KakaoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.966C1.5 6.665 6.201 3 12 3Z" />
    </svg>
  );
}