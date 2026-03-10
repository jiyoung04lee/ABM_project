"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Pin } from "lucide-react";

import {
  fetchPostDetail,
  togglePostLike,
  fetchComments,
  addComment,
  pinPost,
  unpinPost,
  toggleCommentLike,
  deleteComment,
  PostDetail,
  Comment,
} from "@/shared/api/network";

import api from "@/shared/api/axios";
import PostMeta from "@/features/post/components/PostMeta";

export default function NetworkDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyInput, setReplyInput] = useState<{ [key: number]: string }>({});
  const [replyOpen, setReplyOpen] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    api
      .get("users/me/")
      .then((r) => setIsAdmin(!!r.data?.is_staff))
      .catch(() => {});
  }, []);

  const loadData = async () => {
    const data = await fetchPostDetail(Number(id));
    const cs = await fetchComments(Number(id));

    setPost(data);
    setComments(cs);
  };

  const handleLike = async () => {
    if (!post) return;

    const res = await togglePostLike(post.id);

    setPost({
      ...post,
      like_count: res.like_count,
      is_liked: res.liked,
    });
  };

  const handleCreateComment = async (parent: number | null = null) => {
    if (commentSubmitting) return;

    const content =
      parent === null
        ? commentInput.trim()
        : replyInput[parent]?.trim();

    if (!content) return;

    setCommentSubmitting(true);

    try {
      await addComment(Number(id), {
        content,
        parent,
        is_anonymous: isAnonymous,
      });

      const cs = await fetchComments(Number(id));
      setComments(cs);

      if (parent === null) {
        setCommentInput("");
      } else {
        setReplyInput((prev) => ({ ...prev, [parent]: "" }));
        setReplyOpen(null);
      }
    } catch {
      alert("댓글 작성 실패");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentLike = async (commentId: number) => {
    const res = await toggleCommentLike(commentId);

    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, is_liked: res.liked, like_count: res.like_count }
          : c
      )
    );
  };

  const handleDeleteComment = async (commentId: number) => {
    await deleteComment(commentId);

    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handlePin = async () => {
    if (!post || pinning) return;

    setPinning(true);

    try {
      await pinPost(post.id);

      setPost({
        ...post,
        is_pinned: true,
      });
    } finally {
      setPinning(false);
    }
  };

  const handleUnpin = async () => {
    if (!post || pinning) return;

    setPinning(true);

    try {
      await unpinPost(post.id);

      setPost({
        ...post,
        is_pinned: false,
      });
    } finally {
      setPinning(false);
    }
  };

  if (!post) return <div className="p-10">로딩중...</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">

      {/* 상단 */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()}>
          <Image src="/icons/back.svg" alt="back" width={24} height={24} />
        </button>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {post.is_pinned ? (
              <button
                onClick={handleUnpin}
                disabled={pinning}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm font-medium"
              >
                <Pin className="w-4 h-4 fill-current" />
                고정 해제
              </button>
            ) : (
              <button
                onClick={handlePin}
                disabled={pinning}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-700 text-sm font-medium"
              >
                <Pin className="w-4 h-4" />
                상단 고정
              </button>
            )}
          </div>
        )}
      </div>

      {/* 작성자 */}
      <PostMeta
        author={post.author_name}
        profileImage={"/icons/userbaseimage.svg"}
        createdAt={post.created_at}
        isAnonymous={post.is_anonymous}
        authorId={0}
      />

      <div className="border-b border-[#E5E7EB] mb-10" />

      {post.category_name && (
        <div className="mt-2 mb-6">
          <span className="inline-flex px-3 py-[6px] rounded-full text-[14px] bg-[#EFF6FF] text-[#155DFC]">
            {post.category_name}
          </span>
        </div>
      )}

      <h1 className="text-[30px] font-semibold text-[#0A0A0A] mb-6">
        {post.title}
      </h1>

      <div className="whitespace-pre-line text-[15px] text-[#364153] mb-6">
        {post.content}
      </div>

      {/* 좋아요 */}
      <div className="flex justify-end mt-8">
        <button
          onClick={handleLike}
          className="flex items-center gap-2 px-4 py-2 bg-[#F3F4F6] rounded-lg mb-5"
        >
          <Image
            src={post.is_liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
            alt="like"
            width={18}
            height={18}
          />
          <span className="text-[14px]">{post.like_count}</span>
        </button>
      </div>

      {/* 댓글 */}
      <div className="mt-1 border-t border-[#E5E7EB] pt-5">
        <h3 className="text-[20px] font-semibold mb-5 mt-1">댓글</h3>

        {comments.map((comment) => (
          <div key={comment.id} className="mb-12">
            <div className="flex items-start gap-3">

              <div className="w-10 h-10 rounded-full overflow-hidden">
                <img
                  src={"/icons/userbaseimage.svg"}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </div>

              <div className="flex-1">

                <div className="flex items-center gap-2">
                  <span className="text-[16px] text-[#0A0A0A]">
                    {comment.author_name ?? "익명"}
                  </span>

                  <span className="text-[14px] text-[#6A7282]">
                    {comment.created_at?.slice(0, 10)}
                  </span>
                </div>

                <p className="mt-2 text-[16px] text-[#364153]">
                  {comment.content}
                </p>

                <div className="mt-3 flex items-center gap-3 text-sm text-[#6A7282]">

                  <button
                    onClick={() => handleCommentLike(comment.id)}
                    className="flex items-center gap-1"
                  >
                    <Image src="/icons/good.svg" alt="like" width={16} height={16} />
                    <span>{comment.like_count}</span>
                  </button>

                  <button onClick={() => setReplyOpen(comment.id)}>
                    답글
                  </button>

                  <button onClick={() => handleDeleteComment(comment.id)}>
                    삭제
                  </button>

                </div>

                {replyOpen === comment.id && (
                  <div className="mt-4">
                    <textarea
                      value={replyInput[comment.id] || ""}
                      onChange={(e) =>
                        setReplyInput((prev) => ({
                          ...prev,
                          [comment.id]: e.target.value,
                        }))
                      }
                      className="w-full border border-[#E5E7EB] rounded-xl p-3"
                    />

                    <button
                      onClick={() => handleCreateComment(comment.id)}
                      className="mt-2 px-3 py-1 bg-[#2B7FFF] text-sm text-white rounded"
                    >
                      답글 작성
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>
        ))}

        {/* 댓글 입력 */}
        <div className="pt-5 border-t border-[#E5E7EB]">

          <textarea
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="w-full min-h-[160px] border border-[#E5E7EB] rounded-xl p-5 text-[15px]"
          />

          <div className="flex justify-between items-center mt-5">

            <label className="text-sm text-[#6A7282]">
              <input
                type="checkbox"
                className="mr-2"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
              />
              익명으로 작성
            </label>

            <button
              onClick={() => handleCreateComment(null)}
              disabled={commentSubmitting}
              className="px-4 py-2 bg-[#2B7FFF] text-white rounded-lg text-sm"
            >
              {commentSubmitting ? "작성 중..." : "댓글 작성"}
            </button>

          </div>

        </div>

      </div>
    </div>
  );
}