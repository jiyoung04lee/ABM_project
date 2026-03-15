"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Post } from "../types";
import Image from "next/image";
import PostMeta from "./PostMeta";
import { togglePostLike } from "@/shared/api/community";
import { AxiosError } from "axios";

interface Props {
  post: Post;
}

export default function PostItem({ post }: Props) {
  const router = useRouter();

  const handleMoveDetail = () => {
    router.push(`/community/${post.id}`);
  };

  const [liked, setLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_LENGTH = 100;
  const content = post.content_preview ?? post.content ?? "";
  const truncatedContent =
    content.length > MAX_LENGTH ? content.slice(0, MAX_LENGTH) : content;
  const isLong = content.length > MAX_LENGTH;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const res = await togglePostLike(post.id);

      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch (err) {
      const error = err as AxiosError;

      if (error.response?.status === 401) {
        alert("로그인이 필요합니다.");
      } else {
        setError("좋아요 처리 중 오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setLiked(post.is_liked);
    setLikeCount(post.like_count);
  }, [post.is_liked, post.like_count]);

  return (
    <div onClick={handleMoveDetail} className="cursor-pointer">
      <div className="border-b border-[#E5E7EB] py-3">
        <div className="flex items-center gap-2 mb-1">
          {post.is_pinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
              📌 상단 고정
            </span>
          )}
        </div>
        <PostMeta
          author={post.author_name ?? null}
          profileImage={post.author_profile_image ?? null}
          createdAt={post.created_at}
          isAnonymous={post.is_anonymous}
          authorId={post.author_id}
          isNickname={!!post.nickname}
        />

        {post.thumbnail && (
          <div className="mb-4 rounded-lg overflow-hidden">
            <img
              src={post.thumbnail}
              alt={post.title}
              width={800}
              height={200}
              loading="lazy"
              className="w-full object-cover rounded-lg"
            />
          </div>
        )}

        <h3 className="text-[16px] font-semibold text-[#0A0A0A]">
          {post.title}
        </h3>

        <p className="text-[15px] text-[#4B5563] mt-2 whitespace-pre-line">
          {truncatedContent}
          {isLong && (
            <span
              onClick={() => router.push(`/community/${post.id}`)}
              className="text-[#6B7280] cursor-pointer ml-1"
            >
              ... 더보기
            </span>
          )}
        </p>

        <div className="mt-4 flex justify-end gap-4 text-[12px] text-[#6A7282]">
          <button
            onClick={handleLike}
            disabled={isLoading}
            className="flex items-center gap-1 disabled:opacity-50"
          >
            <Image
              src={liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
              alt="like"
              width={14}
              height={14}
            />
            {likeCount}
          </button>

          <div className="flex items-center gap-1">
            <Image
              src="/icons/comment.svg"
              alt="comment"
              width={14}
              height={14}
            />
            {post.comment_count}
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-xs mt-1 text-right">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}