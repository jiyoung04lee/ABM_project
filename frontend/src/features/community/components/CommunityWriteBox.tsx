"use client";

import Image from "next/image";

interface Props {
  placeholder?: string;
}

export default function CommunityWriteBox({
  placeholder = "궁금하거나 나누고 싶은 생각을 공유해보세요!",
}: Props) {
  return (
    <div className="border-b border-[#E5E7EB] py-2">
      <div className="flex items-center gap-4 cursor-pointer">
        <div className="w-10 h-10 rounded-full overflow-hidden">
                  <Image
                    src="/icons/userbaseimage.svg"
                    alt="user"
                    width={40}
                    height={40}
                  />
        </div>

        <div className="text-[16px] leading-[24px] text-[#6A7282]">
          {placeholder}
        </div>

      </div>
    </div>
  );
}