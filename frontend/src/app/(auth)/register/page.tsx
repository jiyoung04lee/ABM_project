"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = "http://localhost:8000";

type UserType = "student" | "graduate" | null;

interface StudentForm {
  name: string;
  nickname: string;
  student_id: string;
  grade: string;
  email: string;
  password: string;
  password_confirm: string;
}

interface GraduateForm {
  name: string;
  nickname: string;
  admission_year: string;
  email: string;
  password: string;
  password_confirm: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<UserType>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [nicknameStatus, setNicknameStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [studentIdStatus, setStudentIdStatus] = useState<"idle" | "ok" | "fail">("idle");

  const [studentForm, setStudentForm] = useState<StudentForm>({
    name: "",
    nickname: "",
    student_id: "",
    grade: "",
    email: "",
    password: "",
    password_confirm: "",
  });

  const [graduateForm, setGraduateForm] = useState<GraduateForm>({
    name: "",
    nickname: "",
    admission_year: "",
    email: "",
    password: "",
    password_confirm: "",
  });

  const handleNext = () => {
    if (!userType) return;
    setStep(2);
  };

  const handleCheckNickname = async () => {
    const nickname =
      userType === "student" ? studentForm.nickname : graduateForm.nickname;
    if (!nickname) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/users/check-nickname/?nickname=${encodeURIComponent(nickname)}`
      );
      const data = await res.json();
      setNicknameStatus(data.available ? "ok" : "fail");
    } catch {
      setNicknameStatus("fail");
    }
  };

  const handleCheckStudentId = async () => {
    const student_id = studentForm.student_id;
    if (!student_id) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/users/check-student-id/?student_id=${encodeURIComponent(student_id)}`
      );
      const data = await res.json();
      setStudentIdStatus(data.available ? "ok" : "fail");
    } catch {
      setStudentIdStatus("fail");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    const body: Record<string, unknown> = {
      user_type: userType,
    };

    if (userType === "student") {
      Object.assign(body, {
        name: studentForm.name,
        nickname: studentForm.nickname,
        student_id: studentForm.student_id,
        grade: parseInt(studentForm.grade),
        email: studentForm.email,
        password: studentForm.password,
        password_confirm: studentForm.password_confirm,
      });
    } else {
      Object.assign(body, {
        name: graduateForm.name,
        nickname: graduateForm.nickname,
        admission_year: parseInt(graduateForm.admission_year),
        email: graduateForm.email,
        password: graduateForm.password,
        password_confirm: graduateForm.password_confirm,
      });
    }

    try {
      const res = await fetch(`${API_BASE}/api/users/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        const errors: Record<string, string> = {};
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key])) {
            errors[key] = data[key][0];
          }
        }
        if (Object.keys(errors).length > 0) {
          setFieldErrors(errors);
        } else {
          setError(data.detail || "회원가입에 실패했습니다.");
        }
        return;
      }

      alert(
        "회원가입이 완료되었습니다!\n이메일을 확인하여 인증을 완료해주세요."
      );
      router.push("/login");
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Logo */}
      <div className="w-14 h-14 bg-[#4F6EF7] rounded-2xl flex items-center justify-center text-white font-semibold text-base mb-5 shadow-md">
        로고
      </div>

      {/* Title */}
      <h1 className="text-[2rem] font-bold text-gray-900 mb-8">회원가입</h1>

      {/* Card */}
      <div className="w-full max-w-[460px] bg-white rounded-2xl shadow-lg px-8 py-8">
        {step === 1 ? (
          /* ── Step 1: 회원 유형 선택 ── */
          <div className="flex flex-col gap-4">
            <UserTypeCard
              selected={userType === "student"}
              onClick={() => setUserType("student")}
              title="재학생"
              description="현재 학과에 재학 중인 학생입니다"
            />
            <UserTypeCard
              selected={userType === "graduate"}
              onClick={() => setUserType("graduate")}
              title="졸업생"
              description="학과를 졸업한 졸업생입니다"
            />

            <button
              onClick={handleNext}
              disabled={!userType}
              className="w-full py-3.5 bg-[#4F6EF7] text-white rounded-xl font-semibold text-base hover:bg-[#3D5CE8] transition disabled:opacity-50 mt-2"
            >
              다음
            </button>
          </div>
        ) : (
          /* ── Step 2: 정보 입력 ── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 이름 */}
            <FormField label="이름">
              <input
                type="text"
                placeholder="홍길동"
                value={
                  userType === "student" ? studentForm.name : graduateForm.name
                }
                onChange={(e) =>
                  userType === "student"
                    ? setStudentForm({ ...studentForm, name: e.target.value })
                    : setGraduateForm({ ...graduateForm, name: e.target.value })
                }
                className={inputClass}
                required
              />
              <FieldError message={fieldErrors.name} />
            </FormField>

            {/* 닉네임 */}
            <FormField label="닉네임">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="닉네임"
                  value={
                    userType === "student"
                      ? studentForm.nickname
                      : graduateForm.nickname
                  }
                  onChange={(e) => {
                    setNicknameStatus("idle");
                    userType === "student"
                      ? setStudentForm({ ...studentForm, nickname: e.target.value })
                      : setGraduateForm({ ...graduateForm, nickname: e.target.value });
                  }}
                  className={`${inputClass} flex-1`}
                  required
                />
                <button
                  type="button"
                  onClick={handleCheckNickname}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 whitespace-nowrap hover:bg-gray-50 transition"
                >
                  중복확인
                </button>
              </div>
              {nicknameStatus === "ok" && (
                <p className="text-green-500 text-xs mt-1">사용 가능한 닉네임입니다.</p>
              )}
              {nicknameStatus === "fail" && (
                <p className="text-red-500 text-xs mt-1">이미 사용 중인 닉네임입니다.</p>
              )}
              <FieldError message={fieldErrors.nickname} />
            </FormField>

            {/* 재학생: 학번 + 학년 / 졸업생: 입학년도 */}
            {userType === "student" ? (
              <>
                {/* 학번 */}
                <FormField label="학번">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ex) 20222882"
                      value={studentForm.student_id}
                      onChange={(e) => {
                        setStudentIdStatus("idle");
                        setStudentForm({ ...studentForm, student_id: e.target.value });
                      }}
                      className={`${inputClass} flex-1`}
                      maxLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={handleCheckStudentId}
                      className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-600 whitespace-nowrap hover:bg-gray-50 transition"
                    >
                      중복확인
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    8자리 숫자를 입력해주세요
                  </p>
                  {studentIdStatus === "ok" && (
                    <p className="text-green-500 text-xs mt-1">사용 가능한 학번입니다.</p>
                  )}
                  {studentIdStatus === "fail" && (
                    <p className="text-red-500 text-xs mt-1">이미 등록된 학번입니다.</p>
                  )}
                  <FieldError message={fieldErrors.student_id} />
                </FormField>

                {/* 학년 */}
                <FormField label="학년">
                  <select
                    value={studentForm.grade}
                    onChange={(e) =>
                      setStudentForm({ ...studentForm, grade: e.target.value })
                    }
                    className={selectClass}
                    required
                  >
                    <option value="">선택하세요</option>
                    {[1, 2, 3, 4].map((g) => (
                      <option key={g} value={g}>
                        {g}학년
                      </option>
                    ))}
                  </select>
                  <FieldError message={fieldErrors.grade} />
                </FormField>
              </>
            ) : (
              /* 입학년도 (졸업생) */
              <FormField label="입학년도">
                <select
                  value={graduateForm.admission_year}
                  onChange={(e) =>
                    setGraduateForm({
                      ...graduateForm,
                      admission_year: e.target.value,
                    })
                  }
                  className={selectClass}
                  required
                >
                  <option value="">선택하세요</option>
                  {Array.from({ length: 10 }, (_, i) => 13 + i).map((y) => (
                    <option key={y} value={y}>
                      {2000 + y}
                    </option>
                  ))}
                </select>
                <FieldError message={fieldErrors.admission_year} />
              </FormField>
            )}

            {/* 아이디(이메일) */}
            <FormField label="아이디(이메일)">
              <input
                type="email"
                placeholder={
                  userType === "student"
                    ? "abc123@naver.com"
                    : "email@example.com"
                }
                value={
                  userType === "student" ? studentForm.email : graduateForm.email
                }
                onChange={(e) =>
                  userType === "student"
                    ? setStudentForm({ ...studentForm, email: e.target.value })
                    : setGraduateForm({ ...graduateForm, email: e.target.value })
                }
                className={inputClass}
                required
              />
              <FieldError message={fieldErrors.email} />
            </FormField>

            {/* 비밀번호 */}
            <FormField label="비밀번호">
              <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-[#4F6EF7] transition">
                <input
                  type={showPw ? "text" : "password"}
                  placeholder="8자 이상 입력하세요"
                  value={
                    userType === "student"
                      ? studentForm.password
                      : graduateForm.password
                  }
                  onChange={(e) =>
                    userType === "student"
                      ? setStudentForm({
                          ...studentForm,
                          password: e.target.value,
                        })
                      : setGraduateForm({
                          ...graduateForm,
                          password: e.target.value,
                        })
                  }
                  className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="text-gray-400 hover:text-gray-600 transition shrink-0"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <FieldError message={fieldErrors.password} />
            </FormField>

            {/* 비밀번호 확인 */}
            <FormField label="비밀번호 확인">
              <div className="flex items-center border border-gray-200 rounded-xl px-4 py-3 gap-3 focus-within:border-[#4F6EF7] transition">
                <input
                  type={showPwConfirm ? "text" : "password"}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={
                    userType === "student"
                      ? studentForm.password_confirm
                      : graduateForm.password_confirm
                  }
                  onChange={(e) =>
                    userType === "student"
                      ? setStudentForm({
                          ...studentForm,
                          password_confirm: e.target.value,
                        })
                      : setGraduateForm({
                          ...graduateForm,
                          password_confirm: e.target.value,
                        })
                  }
                  className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwConfirm(!showPwConfirm)}
                  className="text-gray-400 hover:text-gray-600 transition shrink-0"
                  tabIndex={-1}
                >
                  {showPwConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <FieldError message={fieldErrors.password_confirm} />
            </FormField>

            {/* 개인정보 안내 */}
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 leading-relaxed">
              더 나은 서비스를 위해 방문 수·게시글 조회 수·검색어 등의 이용
              통계를 개인 식별 없이 집계합니다.
              <br />
              쪽지(메시지) 내용은 수집하거나 분석하지 않습니다.
            </div>

            {/* 전체 에러 */}
            {error && <p className="text-red-500 text-xs">{error}</p>}

            {/* 버튼 */}
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-base hover:bg-gray-50 transition"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3.5 bg-[#4F6EF7] text-white rounded-xl font-semibold text-base hover:bg-[#3D5CE8] transition disabled:opacity-60"
              >
                {loading ? "가입 중..." : "가입하기"}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-gray-400 mt-5">
          이미 계정이 있으신가요?{" "}
          <Link
            href="/login"
            className="text-[#4F6EF7] font-semibold hover:underline"
          >
            로그인
          </Link>
        </p>
      </div>
    </>
  );
}

/* ── Sub-components ── */

function UserTypeCard({
  selected,
  onClick,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 p-5 border-2 rounded-xl transition text-left w-full ${
        selected
          ? "border-[#4F6EF7] bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-gray-900">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
    </button>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-red-500 text-xs mt-1">{message}</p>;
}

const inputClass =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-[#4F6EF7] transition placeholder-gray-400 bg-white";

const selectClass =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:border-[#4F6EF7] transition bg-white appearance-none cursor-pointer";

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
