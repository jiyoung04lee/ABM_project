"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import HoverProfileCard from "./HoverProfileCard";

interface Props {
  author: string | null;
  profileImage?: string | null;
  grade?: string | null;
  createdAt: string;
  isAnonymous?: boolean;
  authorId?: number | null;
  isNickname?: boolean;
}

export default function PostMeta({
  author,
  profileImage,
  grade,
  createdAt,
  isAnonymous = false,
  authorId,
  isNickname,
}: Props) {
  const [myId, setMyId] = useState<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const savedId = localStorage.getItem("user_id");
    if (savedId) setMyId(Number(savedId));
  }, []);

  const displayName = isAnonymous ? "익명" : author ?? "알 수 없음";

  const isCommunityMainPage = pathname === "/community";

  // 본인이 아니고, 익명도 아니고, 커뮤니티 메인 페이지가 아닐 때만 카드 표시
  const showCard =
    !isAnonymous &&
    !!authorId &&
    myId !== authorId &&
    !isCommunityMainPage;

  return (
    <div className="flex items-center gap-3 relative group">
      <div className="w-10 h-10 rounded-full overflow-hidden">
        <img
          src={!isAnonymous && profileImage ? profileImage : "/icons/userbaseimage.svg"}
          alt="user"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="relative">
        <div className="text-[14px] font-semibold text-[#0A0A0A]">
          {displayName}
        </div>

        <div className="mt-0.5 text-[12px] text-[#6A7282]">
          {new Date(createdAt).toLocaleDateString()}
        </div>

        {showCard && (
          <div className="hidden group-hover:block">
            <HoverProfileCard
              name={displayName}
              grade={grade}
              profileImage={profileImage}
              userId={authorId}
              isNickname={isNickname}
            />
          </div>
        )}
      </div>
    </div>
  );
}