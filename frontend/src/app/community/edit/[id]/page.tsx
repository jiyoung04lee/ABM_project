"use client";

import { AxiosError } from "axios";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Image from "next/image";
import { getCommunityCategoryLabel } from "@/constants/communityCategories";

import AttachmentField, {
  type ExistingPostFile,
  toExistingAttachments,
  useAttachments,
} from "@/features/post/components/AttachmentField";
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

  const {
    attachments,
    mainKey,
    mainImageIndex,
    addFiles,
    remove,
    selectMain,
    reset,
  } = useAttachments();
  const [submitting, setSubmitting] = useState(false);

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

        const existing = toExistingAttachments(
          (post.files ?? []) as ExistingPostFile[]
        );
        // 지금 대표 이미지(post.thumbnail)를 대표로 표시. 없으면 첫 번째 이미지
        const main = existing.find(
          (a) => a.kind === "image" && a.previewUrl === post.thumbnail
        );
        reset(existing, main?.key);
      } catch (err) {
        console.error(err);
      }
    };

    init();
  }, [postId, reset]);

  /* 카테고리 */
  useEffect(() => {
    getCategories("community").then((res) => {
      setCategories(res.data.results);
    });
  }, []);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("content", content);
    formData.append("is_anonymous", String(isAnonymous));
    formData.append("category", category ?? "");

    const keptIds = attachments
      .filter((item) => item.existingId !== undefined)
      .map((item) => item.existingId as number);
    keptIds.forEach((id) => {
      formData.append("existing_files", String(id));
    });
    // multipart는 빈 목록을 보낼 수 없어서, 기존 파일을 모두 지웠으면 따로 알린다
    if (keptIds.length === 0) {
      formData.append("clear_files", "true");
    }

    attachments.forEach((item) => {
      if (item.file) formData.append("new_files", item.file);
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

      {/* 상단 */}
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => router.back()}>
          <Image src="/icons/back.svg" alt="back" width={24} height={24} />
        </button>
        <h1 className="text-[20px] font-semibold">게시글 수정</h1>
      </div>

      {/* 카테고리 */}
      <div className="mb-8">
        <label className="block text-sm mb-3 text-[#6A7282]">
          카테고리
        </label>
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value)}
          className="text-[15px] w-full border border-[#E5E7EB] rounded-xl px-4 pr-10 py-2 focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {getCommunityCategoryLabel(cat.name)}
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
      <AttachmentField
        attachments={attachments}
        mainKey={mainKey}
        onAdd={addFiles}
        onRemove={remove}
        onSelectMain={selectMain}
      />

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
          disabled={submitting}
          className="flex-1 py-3 bg-[#2B7FFF] text-white rounded-xl font-semibold hover:bg-[#1a66e6] transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "수정 중..." : "수정하기"}
        </button>
      </div>
    </div>
  );
}
