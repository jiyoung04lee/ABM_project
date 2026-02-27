"use client";

import Image from "next/image";

interface Props {
  author: string | null;
  grade?: string | null;
  createdAt: string;
  isAnonymous?: boolean;
}

export default function PostMeta({
  author,
  grade,
  createdAt,
  isAnonymous = false,
}: Props) {
  const displayName = isAnonymous ? "익명" : author ?? "알 수 없음";

  return (
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3 relative group">
        {/* 프로필 이미지 */}
        <div className="w-10 h-10 rounded-full overflow-hidden">
          <Image
            src="/icons/userbaseimage.svg"
            alt="user"
            width={40}
            height={40}
          />
        </div>

        <div>
          {/* 이름 */}
          <div className="text-[14px] font-semibold leading-[24px] text-[#0A0A0A]">
            {displayName}
          </div>

          {/* 학년 */}
          {!isAnonymous && grade && (
            <div className="text-[12px] text-[#6A7282]">
              {grade}
            </div>
          )}
        </div>

        {/* 🔥 나중에 여기 HoverProfileCard 붙이면 됨 */}
      </div>

      {/* 날짜 */}
      <div className="text-[12px] text-[#6A7282]">
        {new Date(createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}