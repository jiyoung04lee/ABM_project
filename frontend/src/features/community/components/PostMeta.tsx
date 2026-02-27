"use client";

import Image from "next/image";

interface Props {
  author: string;
  grade?: string;
  createdAt: string;
}

export default function PostMeta({
  author,
  grade,
  createdAt,
}: Props) {
  return (
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
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
          <div
            className="
              text-[14px]
              font-semibold
              leading-[24px]
              tracking-[-0.31px]
              text-[#0A0A0A]
            "
          >
            {author}
          </div>

          {/* 학년 정보 */}
          {grade && (
            <div
              className="
                text-[12px]
                font-normal
                leading-[20px]
                tracking-[-0.15px]
                text-[#6A7282]
              "
            >
              {grade}
            </div>
          )}
        </div>
      </div>

      {/* 날짜 */}
      <div
        className="
          text-[12px]
          font-normal
          leading-[20px]
          tracking-[-0.15px]
          text-[#6A7282]
        "
      >
        {createdAt}
      </div>
    </div>
  );
}