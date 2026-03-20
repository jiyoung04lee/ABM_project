"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/shared/components/layout/Logo";
import { API_BASE } from "@/shared/api/api";

// UI 상 사용자 유형: 다부전공생은 재학생 + is_multi_major 로 매핑
type UserType = "student" | "graduate" | "multi_major";

const INTEREST_OPTIONS: { value: string; label: string }[] = [
  { value: "ai", label: "AI" },
  { value: "data", label: "데이터" },
  { value: "business", label: "경영" },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signupToken = searchParams.get("signup_token");

  const DEPARTMENT = "AI빅데이터융합경영학과";

  const [userType, setUserType] = useState<UserType>("student");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [personalInfoConsent, setPersonalInfoConsent] = useState(false);
  const [showPrivacyDetail, setShowPrivacyDetail] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [grade, setGrade] = useState<number | "">("");
  const [admissionYear, setAdmissionYear] = useState<number | "">("");
  const [department, setDepartment] = useState("");
  const [multiMajorImage, setMultiMajorImage] = useState<File | null>(null);
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

    try {
      const formData = new FormData();

      // 백엔드는 student / graduate 두 종류만 받으므로
      // 다부전공생은 student + is_multi_major=true 로 보낸다.
      const backendUserType = userType === "multi_major" ? "student" : userType;

      formData.append("signup_token", signupToken);
      formData.append("user_type", backendUserType);
      formData.append("name", name.trim());
      formData.append("nickname", nickname.trim());
      formData.append("department", userType === "multi_major" ? department.trim() : DEPARTMENT);
      formData.append(
        "personal_info_consent",
        String(personalInfoConsent)
      );

      if (email.trim()) {
        formData.append("email", email.trim());
      }

      interests.forEach((v) => formData.append("interests", v));

      if (backendUserType === "student") {
        formData.append("student_id", studentId.trim());
        if (grade !== "") {
          formData.append("grade", String(grade));
        }

        const isMultiMajor = userType === "multi_major";
        formData.append("is_multi_major", String(isMultiMajor));
        if (isMultiMajor && multiMajorImage) {
          formData.append("multi_major_image", multiMajorImage);
        }
      } else if (backendUserType === "graduate") {
        if (admissionYear !== "") {
          formData.append("admission_year", String(admissionYear));
        }
      }

      const res = await fetch(
        `${API_BASE}/api/users/social/complete-profile/`,
        {
          method: "POST",
          body: formData,
        }
      );
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
        if (userType === "multi_major") {
          // 다부전공생: 로그인 상태를 만들지 않고 승인 대기 페이지로 이동
          router.replace("/onboarding/multi-major-pending");
          return;
        }

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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="user_type"
                  checked={userType === "multi_major"}
                  onChange={() => setUserType("multi_major")}
                  className="text-[#4F6EF7]"
                />
                <span>다부전공생</span>
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
              커뮤니티에서 사용할 닉네임을 입력해주세요. <span className="text-red-500">*</span>
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
            {userType === "multi_major" ? (
              <>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="1전공을 입력하세요"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4F6EF7] text-sm"
                  maxLength={100}
                  required
                />
                {fieldErrors.department && (
                  <p className="text-red-500 text-xs mt-1">{fieldErrors.department}</p>
                )}
              </>
            ) : (
              <div className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-gray-800 text-sm">
                {DEPARTMENT}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              관심분야
            </label>
            <div className="overflow-x-auto pb-2 -mx-1">
              <div className="flex gap-2 min-w-0">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = interests[0] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setInterests((prev) =>
                          prev[0] === opt.value ? [] : [opt.value]
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
            <div className="flex items-center border border-gray-200 rounded-xl focus-within:border-[#4F6EF7]">
              <input
                type="text"
                value={email.replace(/@kookmin\.ac\.kr$/, "")}
                onChange={(e) =>
                  setEmail(e.target.value.replace(/@.*/, "") + "@kookmin.ac.kr")
                }
                placeholder="example123"
                className="min-w-0 flex-1 px-4 py-3 outline-none bg-white text-sm rounded-l-xl"
                required
              />
              <span className="flex-shrink-0 px-4 py-3 bg-gray-50 text-gray-600 text-sm font-semibold border-l border-gray-200 whitespace-nowrap rounded-r-xl">
                @kookmin.ac.kr
              </span>
            </div>
            {fieldErrors.email && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
            )}
          </div>

          {(userType === "student" || userType === "multi_major") && (
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
                {userType === "multi_major" && (
                  <p className="text-gray-500 text-xs mt-1">
                    다부전공은 학번을 자동으로 명단과 대조하지 않습니다. 아래 증빙 이미지로 확인합니다.
                  </p>
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
                  required
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

              {userType === "multi_major" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      다부전공 증빙 이미지 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setMultiMajorImage(file);
                      }}
                      className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#EEF2FF] file:text-[#4F6EF7] file:text-sm hover:file:bg-[#E0E7FF]"
                    />
                    {fieldErrors.multi_major_image && (
                      <p className="text-red-500 text-xs mt-1">
                        {fieldErrors.multi_major_image}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      다부전공(복수전공 포함) 신청을 위해 학적 정보 등 증빙 화면을 캡처하여 업로드해주세요.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {userType === "graduate" && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                입학년도 <span className="text-red-500">*</span>
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
            <button
              type="button"
              onClick={() => setShowPrivacyDetail(true)}
              className="mt-1 text-xs text-gray-500 underline underline-offset-2 hover:text-[#4F6EF7]"
            >
              자세히 보기
            </button>
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

      {showPrivacyDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg max-h-[80vh] rounded-2xl bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">
                개인정보 수집·이용 안내
              </h2>
              <button
                type="button"
                onClick={() => setShowPrivacyDetail(false)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <section>
                <h3 className="font-semibold mb-1">1. 수집하는 개인정보 항목</h3>
                <p className="mb-1">① 필수 항목</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>닉네임</li>
                  <li>학과</li>
                  <li>관심분야</li>
                  <li>(재학생) 학번, 학년</li>
                  <li>(졸업생) 입학년도</li>
                  <li>학교 이메일(@kookmin.ac.kr)</li>
                </ul>
                <p className="mt-2 mb-1">② 서비스 이용 과정에서 자동으로 생성·수집되는 정보</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>접속 일시, 접속 IP</li>
                  <li>이용한 메뉴·페이지, 버튼 클릭, 스크롤, 입력/클릭 패턴 등 서비스 이용 기록</li>
                  <li>기기 정보(기기 종류, OS, 브라우저 종류/버전 등)</li>
                  <li>쿠키, 웹 비콘, 로컬 스토리지, 광고/기기 식별자 등 온라인 식별자</li>
                  <li>오류 로그, 비정상 사용 시도 및 이에 대한 기술적 기록</li>
                </ul>
                <p className="mt-2 mb-1">③ (향후 도입 예정) 웹/앱 분석 도구를 통한 수집 정보</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>Google Analytics, Microsoft Clarity 등 분석 도구에서 생성하는 접속·이용 기록</li>
                  <li>페이지 체류 시간, 이동 경로, 스크롤·클릭·탭 위치 등 이용 행태 정보</li>
                </ul>
                <p className="mt-2 text-xs text-gray-500">
                  ※ 분석 도구 사용 시, 관련 법령 및 각 서비스의 가이드에 따라 IP 익명화 등 개인정보 최소화 조치를
                  적용합니다.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-1">2. 개인정보의 수집·이용 목적</h3>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>회원 식별 및 본인 여부 확인</li>
                  <li>커뮤니티 서비스 제공 및 운영 (프로필 표시, 글/댓글 작성 시 작성자 정보 표기 등)</li>
                  <li>개인화 기능 제공 (내 활동, 알림 등)</li>
                  <li>서비스 품질 개선 및 통계 분석 (이용 현황 분석, 기능 개선 및 UI/UX 개선, 오류 대응 등)</li>
                  <li>부정 이용 방지 및 서비스 안정성 확보 (비정상 접속·이용 시도 탐지 및 차단, 운영 정책 위반 대응)</li>
                  <li>
                    (향후) Google Analytics, Microsoft Clarity 등 분석 도구를 활용한 이용 패턴·통계 분석 및 서비스
                    개선
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold mb-1">3. 개인정보의 보유·이용 기간</h3>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>회원 탈퇴 시까지 보관 후 지체 없이 파기합니다.</li>
                  <li>
                    관련 법령에 따라 일정 기간 보관이 필요한 경우, 해당 법령에서 정한 기간 동안만 별도 보관 후
                    파기합니다.
                  </li>
                  <li>
                    웹/앱 분석 도구(Google Analytics, Microsoft Clarity 등)를 통해 수집된 데이터는 각 서비스의 정책에
                    따른 보관 기간 내에서 통계·분석 목적으로만 이용되며, 기간 경과 후에는 익명화 또는 삭제됩니다.
                  </li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold mb-1">4. 제3자 제공 및 처리 위탁</h3>
                <p className="mb-1">
                  서비스는 회원님의 개인정보를 외부 광고사 등 불필요한 제3자에게 판매하거나 임의로 제공하지 않습니다.
                  다만, 서비스 이용 분석 및 품질 향상을 위하여 아래와 같이 개인정보 처리 업무를 외부 서비스에 위탁할 수
                  있습니다.
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>
                    수탁자: Google LLC (Google Analytics 서비스 제공자) – 서비스 이용 현황 분석 및 통계 생성, 접속 로그와
                    이용 페이지, 기기·브라우저 정보, 쿠키 및 온라인 식별자 등을 해외 서버(미국 등)에서 처리
                  </li>
                  <li>
                    수탁자: Microsoft Corporation (Microsoft Clarity 서비스 제공자) – 화면 사용 행태 분석 및 UI/UX 개선을
                    위한 세션 분석, 페이지 이용 행태 정보(클릭, 스크롤, 머무른 시간 등)와 기기·브라우저 정보, 쿠키 및
                    온라인 식별자 등을 해외 서버에서 처리
                  </li>
                </ul>
                <p className="mt-2">
                  위탁 시에는 관련 법령에 따라 필요한 계약 체결 및 관리·감독을 통해 개인정보가 안전하게 처리되도록
                  합니다. 향후 새로운 제3자 제공 또는 추가 위탁이 필요한 경우, 사전에 별도 동의를 받고 관련 내용을
                  명확히 안내하겠습니다.
                </p>
              </section>

              <section>
                <h3 className="font-semibold mb-1">5. 동의를 거부할 권리</h3>
                <p>
                  회원님은 개인정보 수집·이용에 대한 동의를 거부할 권리가 있습니다. 다만 필수 항목에 대한 동의를 거부하는
                  경우 회원 가입 및 서비스 이용이 제한될 수 있습니다.
                </p>
                <p className="mt-1">
                  웹/앱 분석 도구(Google Analytics, Microsoft Clarity 등)에 의한 분석에 대해서는 브라우저 설정(쿠키
                  차단, 추적 방지 모드 등) 또는 각 서비스에서 제공하는 opt-out 기능을 통해 수집·분석을 제한할 수
                  있습니다. 이 경우 일부 기능 이용에 제약이 있을 수 있습니다.
                </p>
              </section>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrivacyDetail(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#4F6EF7] hover:bg-[#3D5CE8]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
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
