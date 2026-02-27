"use client";

import Image from "next/image";
import HoverProfileCard from "./HoverProfileCard";

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

        {/* 이름 + 학년 */}
        <div className="relative">
          <div className="text-[14px] font-semibold text-[#0A0A0A]">
            {displayName}
          </div>

          {!isAnonymous && grade && (
            <div className="text-[12px] text-[#6A7282]">
              {grade}
            </div>
          )}

          {/* Hover 카드 */}
          {!isAnonymous && (
            <div className="hidden group-hover:block">
              <HoverProfileCard
                name={displayName}
                grade={grade}
              />
            </div>
          )}
        </div>
      </div>

      {/* 날짜 */}
      <div className="text-[12px] text-[#6A7282]">
        {new Date(createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}