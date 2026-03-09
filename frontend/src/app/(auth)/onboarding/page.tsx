"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/shared/components/layout/Logo";
import{ API_BASE } from "@/shared/api/api";

type UserType = "student" | "graduate";

const INTEREST_OPTIONS: { value: string; label: string }[] = [
  { value: "ai", label: "AI" },
  { value: "data", label: "데이터" },
  { value: "business", label: "경영" },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupToken = searchParams.get("signup_token");

  const [userType, setUserType] = useState<UserType>("student");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [department, setDepartment] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [personalInfoConsent, setPersonalInfoConsent] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [admissionYear, setAdmissionYear] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const token = localStorage.getItem("access_token");
    if (token) {
      router.replace("/");
      return;
    }

    if (!signupToken) {
      router.replace("/login");
    }
  }, [signupToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupToken) return;
    setError("");
    setFieldErrors({});
    setLoading(true);

    const payload: Record<string, unknown> = {
      signup_token: signupToken,
      user_type: userType,
      name: name.trim(),
      nickname: nickname.trim(),
      department: department.trim(),
      interests: interests,
      email: email.trim() || undefined,
      personal_info_consent: personalInfoConsent,
    };

    if (userType === "student") {
      payload.student_id = studentId.trim();
      payload.grade = grade === "" ? undefined : Number(grade);
    } else {
      payload.admission_year = admissionYear === "" ? undefined : Number(admissionYear);
    }

    try {
      const res = await fetch(`${API_BASE}/api/users/social/complete-profile/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (typeof data === "object" && data !== null) {
          const errors: Record<string, string> = {};
          for (const [k, v] of Object.entries(data)) {
            if (Array.isArray(v) && v[0]) errors[k] = String(v[0]);
            else if (typeof v === "string") errors[k] = v;
          }
          setFieldErrors(errors);
        }
        setError(data.detail || "입력 내용을 확인해주세요.");
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
        window.location.href = "/";
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!signupToken) {
    return null;
  }

  return (
    <>
      <div className="mb-5">
        <Logo />
      </div>

      <h1 className="text-[2rem] font-bold text-gray-900 mb-1.5">프로필 완성</h1>
      <p className="text-gray-500 text-sm mb-8">
        서비스 이용을 위해 아래 정보를 입력해주세요
      </p>

      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              사용자 유형
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="user_type"
                  checked={userType === "student"}
                  onChange={() => setUserType("student")}
                  className="text-[#4F6EF7]"
                />
                <span>재학생</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="user_type"
                  checked={userType === "graduate"}
                  onChange={() => setUserType("graduate")}
                  className="text-[#4F6EF7]"
                />
                <span>졸업생</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              실명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="홍길동"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7]"
              maxLength={50}
              required
            />
            {fieldErrors.name && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              닉네임 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7]"
              maxLength={30}
              required
            />
            {fieldErrors.nickname && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.nickname}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              학과 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="학과명"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7]"
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              관심분야
            </label>
            <div className="overflow-x-auto pb-2 -mx-1">
              <div className="flex gap-2 min-w-0">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = interests.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setInterests((prev) =>
                          prev.includes(opt.value)
                            ? prev.filter((x) => x !== opt.value)
                            : [...prev, opt.value]
                        )
                      }
                      className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition border ${
                        selected
                          ? "bg-[#4F6EF7] text-white border-[#4F6EF7]"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#4F6EF7] hover:bg-[#EFF6FF]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {fieldErrors.interests && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.interests}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              학교 이메일 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#4F6EF7]">
              <input
                type="text"
                value={email.replace(/@kookmin\.ac\.kr$/, "")}
                onChange={(e) =>
                  setEmail(e.target.value.replace(/@.*/, "") + "@kookmin.ac.kr")
                }
                placeholder="학번 또는 아이디"
                className="flex-1 px-4 py-3 outline-none bg-white text-sm"
                required
              />
              <span className="px-3 py-3 bg-gray-50 text-gray-500 text-sm font-medium border-l border-gray-200 whitespace-nowrap">
                @kookmin.ac.kr
              </span>
            </div>
            {fieldErrors.email && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {userType === "student" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  학번 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="8자리 숫자"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7]"
                  maxLength={8}
                />
                {fieldErrors.student_id && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.student_id}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  학년 <span className="text-red-500">*</span>
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7]"
                  required={userType === "student"}
                >
                  <option value="">선택</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{n}학년</option>
                  ))}
                </select>
                {fieldErrors.grade && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.grade}</p>
                )}
              </div>
            </>
          )}

          {userType === "graduate" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                입학년도(기수) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={admissionYear}
                onChange={(e) => setAdmissionYear(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="예: 2020"
                min={2013}
                max={2025}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7]"
              />
              {fieldErrors.admission_year && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.admission_year}</p>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={personalInfoConsent}
                onChange={(e) => setPersonalInfoConsent(e.target.checked)}
                className="text-[#4F6EF7] rounded"
              />
              <span className="text-sm text-gray-700">
                개인정보 수집·이용에 동의합니다 <span className="text-red-500">*</span>
              </span>
            </label>
            {fieldErrors.personal_info_consent && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.personal_info_consent}</p>
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#4F6EF7] text-white rounded-xl font-semibold text-base hover:bg-[#3D5CE8] transition disabled:opacity-60 mt-2"
          >
            {loading ? "처리 중..." : "완료"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-5">
          <Link href="/login" className="text-[#4F6EF7] font-semibold hover:underline">
            로그인 화면으로
          </Link>
        </p>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-500">로딩...</div>}>
      <OnboardingContent />
    </Suspense>
  );
}
