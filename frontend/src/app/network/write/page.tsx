"use client";

import { AxiosError } from "axios";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { createPost, fetchCategories } from "@/shared/api/network";

type NetworkType = "student" | "graduate" | "qa";

interface Category {
  id: number;
  type: NetworkType;
  name: string;
  slug: string;
}

function WriteContent() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ /network/write?type=student
  const type = (sp.get("type") as NetworkType) ?? "student";

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number | null>(null);

  // ✅ 카테고리 불러오기 (네트워크는 type 기준)
  useEffect(() => {
    (async () => {
      try {
        const results = await fetchCategories(type); // ✅ 네트워크는 배열로 옴
        setCategories(results);

        if (results.length > 0) {
          setCategory(String(results[0].id)); // 기본값 자동 선택
        } else {
          setCategory(null);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [type]);

  // 파일 업로드 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;

    const newFiles = Array.from(fileList);

    setFiles((prev) => [...prev, ...newFiles]);

    const previews = newFiles
      .filter((file) => file.type.startsWith("image/"))
      .map((file) => URL.createObjectURL(file));

    setPreviewImages((prev) => [...prev, ...previews]);

    if (mainImageIndex === null && previews.length > 0) {
      setMainImageIndex(0);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }

    if (!category) {
      alert("카테고리를 선택해주세요.");
      return;
    }

    try {
      const formData = new FormData();

      // ✅ 네트워크 필수
      formData.append("type", type);

      formData.append("title", title);
      formData.append("content", content);
      formData.append("is_anonymous", String(isAnonymous));
      formData.append("category", category);

      if (files.length > 0) {
        files.forEach((file) => {
          formData.append("new_files", file);
        });

        // ⚠️ 네트워크 backend serializer에 thumbnail_index 필드가 없으면 보내면 400 날 수 있음
        // 필요하면 backend에 thumbnail_index 추가한 뒤 아래 주석 해제
        // if (mainImageIndex !== null) {
        //   formData.append("thumbnail_index", String(mainImageIndex));
        // }
      }

      await createPost(formData);

      alert("작성 완료");
      router.push("/network");
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        console.error(err.response?.data);
      } else {
        console.error(err);
      }
      alert("작성 실패");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* 상단 */}
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => router.back()}>
          <Image src="/icons/back.svg" alt="back" width={24} height={24} />
        </button>
        <h1 className="text-[20px] font-semibold">네트워크</h1>
      </div>

      {/* 카테고리 */}
      <div className="mb-8">
        <label className="block text-sm mb-3 text-[#6A7282]">카테고리</label>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value)}
          className="text-[15px] w-full border border-[#E5E7EB] rounded-xl px-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* 제목 */}
      <div className="mb-8">
        <label className="block text-sm mb-3 text-[#6A7282]">제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="text-[15px] w-full border border-[#E5E7EB] rounded-xl px-4 py-2 focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
        />
      </div>

      {/* 내용 */}
      <div className="mb-8">
        <label className="block text-sm mb-3 text-[#6A7282]">내용</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          className="text-[15px] w-full !h-[400px] resize-none border border-[#E5E7EB] rounded-xl p-6 focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
        />
      </div>

      {/* 파일 업로드 */}
      <div className="mb-8">
        <label className="block text-sm mb-3 text-[#6A7282]">첨부파일 (이미지, PDF)</label>

        <label
          htmlFor="fileUpload"
          className="border-2 border-dashed border-[#E5E7EB] rounded-xl py-12 flex flex-col items-center justify-center text-[#6A7282] cursor-pointer"
        >
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
            id="fileUpload"
          />
          <img src="/icons/upload.svg" alt="upload" className="w-10 h-10" />
          <p className="mt-4 text-sm">클릭하여 파일 업로드</p>
          <p className="text-xs mt-1">이미지 또는 PDF 파일 (최대 10MB)</p>
        </label>

        {/* 이미지 미리보기 + 대표 선택(UI는 유지) */}
        {previewImages.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mt-6">
            {previewImages.map((src, index) => (
              <div
                key={index}
                onClick={() => setMainImageIndex(index)}
                className={`relative cursor-pointer border-2 rounded-lg ${
                  mainImageIndex === index ? "border-[#2B7FFF]" : "border-transparent"
                }`}
              >
                <img src={src} className="w-full h-24 object-cover rounded-lg" />
                {mainImageIndex === index && (
                  <div className="absolute top-1 right-1 bg-[#2B7FFF] text-white text-xs px-2 py-0.5 rounded">
                    대표
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 익명 */}
      <div className="flex items-center gap-2 mt-4 mb-12">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={() => setIsAnonymous(!isAnonymous)}
          className="w-4 h-4 accent-[#2B7FFF]"
        />
        <span className="text-sm text-[#6A7282]">익명으로 작성</span>
      </div>

      {/* 버튼 */}
      <div className="flex gap-4 w-full">
        <button
          onClick={() => router.back()}
          className="flex-1 py-3 border border-[#E5E7EB] rounded-xl font-medium text-[#6A7282] hover:bg-gray-50 transition"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 py-3 bg-[#2B7FFF] text-white rounded-xl font-semibold hover:bg-[#1a66e6] transition shadow-md"
        >
          게시하기
        </button>
      </div>
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-6 py-10 text-gray-500">로딩...</div>}>
      <WriteContent />
    </Suspense>
  );
}