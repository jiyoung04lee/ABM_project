"use client";

import { AxiosError } from "axios";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";

import {
  updatePost,
  getCategories,
  getPostDetail,
} from "@/shared/api/community";

interface Category {
  id: number;
  name: string;
  slug: string;
  group: string;
}

export default function EditPage() {
  const router = useRouter();
  const params = useParams();

  const postId = params.id as string;

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [existingFiles, setExistingFiles] = useState<number[]>([]);
  const [existingImages, setExistingImages] = useState<
    { id: number; url: string }[]
  >([]);

  /* 게시글 불러오기 */
  useEffect(() => {
    const init = async () => {
      try {
        const res = await getPostDetail(Number(postId));
        const post = res.data;

        setTitle(post.title);
        setContent(post.content);
        setCategory(post.category ? String(post.category) : null);
        setIsAnonymous(post.is_anonymous);

        if (post.files) {
          setExistingFiles(post.files.map((f: any) => f.id));

          const images = post.files
            .filter((f: any) => f.file_type === "image")
            .map((f: any) => ({
              id: f.id,
              url: f.file,
            }));

          setExistingImages(images);
        }
      } catch (err) {
        console.error(err);
      }
    };

    init();
  }, [postId]);

  /* 카테고리 */

  useEffect(() => {
    getCategories("community").then((res) => {
      setCategories(res.data.results);
    });
  }, []);

  /* 파일 */

  const handleFiles = (fileList: FileList | File[]) => {
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

  // 기존 파일 삭제 
  const removeExistingImage = (id: number) => {
    setExistingImages((prev) => prev.filter((img) => img.id !== id));
    setExistingFiles((prev) => prev.filter((fileId) => fileId !== id));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const formData = new FormData();

    formData.append("title", title);
    formData.append("content", content);
    formData.append("is_anonymous", String(isAnonymous));
    formData.append("category", category ?? "");

    existingFiles.forEach((id) => {
      formData.append("existing_files", String(id));
    });

    files.forEach((file) => {
      formData.append("new_files", file);
    });

    if (mainImageIndex !== null) {
      formData.append("thumbnail_index", String(mainImageIndex));
    }

    try {
      setSubmitting(true);

      await updatePost(Number(postId), formData);

      alert("수정 완료");

      router.push(`/community/${postId}`);
    } catch (err) {
      if (err instanceof AxiosError) {
        console.error(err.response?.data);
      }

      alert("수정 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => router.back()}>
          <Image src="/icons/back.svg" alt="back" width={24} height={24} />
        </button>
        <h1 className="text-[20px] font-semibold">게시글 수정</h1>
      </div>

      {/* 카테고리 */}

      <select
        value={category ?? ""}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full border rounded-xl p-2 mb-6"
      >
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      {/* 제목 */}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border rounded-xl p-3 mb-6"
      />

      {/* 내용 */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full h-[400px] border rounded-xl p-4 mb-6"
      />

      {/* 기존 이미지 */}
      {existingImages.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {existingImages.map((img) => (
            <div key={img.id} className="relative">
              <img
                src={img.url}
                className="w-full h-24 object-cover rounded-lg"
              />

              <button
                onClick={() => removeExistingImage(img.id)}
                className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 py-1 rounded"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
)}

      {/* 익명 */}

      <div className="flex gap-2 mb-10">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={() => setIsAnonymous(!isAnonymous)}
        />
        <span className="text-sm">익명 작성</span>
      </div>

      {/* 버튼 */}

      <div className="flex gap-4">
        <button
          onClick={() => router.back()}
          className="flex-1 border rounded-xl py-3"
        >
          취소
        </button>

        <button
          onClick={handleSubmit}
          className="flex-1 bg-[#2B7FFF] text-white rounded-xl py-3"
        >
          수정하기
        </button>
      </div>

    </div>
  );
}