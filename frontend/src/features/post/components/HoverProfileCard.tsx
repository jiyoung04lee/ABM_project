"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/shared/api/axios";

interface Props {
  name: string;
  grade?: string | null;
  profileImage?: string | null;
  userId?: number | null;
  isNickname?: boolean;
}

export default function HoverProfileCard({ name, grade, profileImage, userId, isNickname }: Props) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  
  useEffect(() => {
    api
      .get("users/me/")
      .then((r) => {
        setCurrentUserId(r.data?.id ?? null);
      })
      .catch(() => {
        setCurrentUserId(null);
      });
  }, []);

  const handleMessage = () => {
    if (!userId || userId === currentUserId) return;

    if (isNickname) {
      router.push(`/messages?userId=${userId}&nickname=${name}`);
    } else {
      router.push(`/messages?userId=${userId}`);
    }
  };

  const canSendMessage = !!userId && userId !== currentUserId;

  return (
    <div className="absolute top-full left-0 mt-2 w-52 bg-white border border-[#E5E7EB] rounded-lg shadow-lg p-3 z-50">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full overflow-hidden">
          <img
            src={profileImage ? profileImage : "/icons/userbaseimage.svg"}
            alt="user"
            className="w-full h-full object-cover"
          />
        </div>

        <div>
          <div className="text-[13px] font-semibold text-[#0A0A0A]">
            {name}
          </div>

          {grade && (
            <div className="text-[11px] text-[#6A7282]">
              {grade}
            </div>
          )}
        </div>
      </div>

      {canSendMessage && (
        <button
          onClick={handleMessage}
          className="w-full py-2 text-[13px] bg-[#2B7FFF] text-white rounded-md hover:bg-[#1f6ae0]"
        >
          메시지 보내기
        </button>
      )}
    </div>
  );
}