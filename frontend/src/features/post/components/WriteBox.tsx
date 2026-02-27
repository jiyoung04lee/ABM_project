"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

export default function WriteBox() {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push("/community/write")}
      className="
        flex items-center gap-4
        border-b border-[#E5E7EB]
        py-4
        cursor-pointer
        mb-6
      "
    >
      <Image
        src="/icons/userbaseimage.svg"
        alt="user"
        width={40}
        height={40}
      />

      <span className="text-[#6A7282]">
        궁금하거나 나누고 싶은 생각을 공유해보세요!
      </span>
    </div>
  );
}