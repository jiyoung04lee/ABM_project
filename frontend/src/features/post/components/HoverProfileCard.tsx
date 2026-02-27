"use client";

import Image from "next/image";

interface Props {
  name: string;
  grade?: string | null;
}

export default function HoverProfileCard({ name, grade }: Props) {
  return (
    <div
      className="
        absolute
        top-full
        left-0
        mt-2
        w-52                
        bg-white
        border border-[#E5E7EB]
        rounded-lg         
        shadow-lg          
        p-3                
        z-50
      "
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full overflow-hidden">
          <Image
            src="/icons/userbaseimage.svg"
            alt="user"
            width={36}
            height={36}
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

      <button
        className="
          w-full
          py-2               
          text-[13px]
          bg-[#2B7FFF]
          text-white
          rounded-md
          hover:bg-[#1f6ae0]
          transition
        "
      >
        메시지 보내기
      </button>
    </div>
  );
}