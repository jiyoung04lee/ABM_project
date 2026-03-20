import Link from "next/link";
import LoginLogo from "@/shared/components/layout/LoginLoGo";

export default function MultiMajorPendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#EEF2FF] to-white px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg px-8 py-8">
        <div className="mb-6 flex justify-center">
          <LoginLogo className="translate-x-[18px]" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          다부전공 인증 승인 대기중입니다
        </h1>

        <p className="text-sm text-gray-600 mb-4">
          제출하신 1전공 정보와 증빙 이미지는 학과에서 확인 후 승인됩니다.
        </p>
        <p className="text-sm text-gray-600 mb-6">
          승인이 완료되면 다부전공 관련 기능이 자동으로 활성화되며, 그 전까지는
          일반 재학생과 동일한 기능만 이용하실 수 있습니다.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full inline-flex items-center justify-center rounded-xl bg-[#4F6EF7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#3D5CE8] transition"
          >
            메인으로 이동
          </Link>
          <Link
            href="/login"
            className="w-full inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            다시 로그인하기
          </Link>
        </div>
      </div>
    </div>
  );
}

