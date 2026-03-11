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
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [pinning, setPinning] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    api.get("users/me/")
      .then((r) => {
        setIsAdmin(!!r.data?.is_staff);
        setCurrentUserId(r.data?.id);
      })
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
      const res = await addComment(Number(id), {
        content,
        parent,
        is_anonymous: isAnonymous,
      });

      if (parent === null) {
        setComments((prev) => [...prev, res]);
        setCommentInput("");
      } else {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === parent
              ? {
                  ...comment,
                  replies: [...(comment.replies || []), res],
                }
              : comment
          )
        );

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
      prev.map((comment) => {
        if (comment.id === commentId) {
          return {
            ...comment,
            is_liked: res.liked,
            like_count: res.like_count,
          };
        }

        return {
          ...comment,
          replies: comment.replies?.map((reply) =>
            reply.id === commentId
              ? { ...reply, is_liked: res.liked, like_count: res.like_count }
              : reply
          ),
        };
      })
    );
  };

  const handleDeleteComment = async (commentId: number) => {
    await deleteComment(commentId);

    setComments((prev) =>
      prev
        .filter((c) => c.id !== commentId)
        .map((c) => ({
          ...c,
          replies: c.replies?.filter((r) => r.id !== commentId) ?? [],
        }))
    );
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
      alert("상단에 고정되었습니다.");
      router.push("/network");
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
      alert("상단 고정이 해제되었습니다.");
      router.push("/network");
    } finally {
      setPinning(false);
    }
  };

  if (!post) return <div className="p-10">로딩중...</div>;

  const isAnswered = post.comment_count > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6">

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

          <PostMeta
            author={post.author_name}
            profileImage={"/icons/userbaseimage.svg"}
            createdAt={post.created_at}
            isAnonymous={post.is_anonymous}
            authorId={post.author_id}
          />

          <div className="mt-4 flex justify-between items-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isAnswered ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {isAnswered ? "답변완료" : "답변대기"}
            </span>
          </div>

          <div className="border-b border-[#E5E7EB] mb-10 mt-4" />

          <h1 className="text-[30px] font-semibold text-[#0A0A0A] mb-6">
            {post.title}
          </h1>

          <div className="whitespace-pre-line text-[15px] text-[#364153] mb-6">
            {post.content}
          </div>

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

          <div className="mt-1 border-t border-[#E5E7EB] pt-5">
            <h3 className="text-[20px] font-semibold mb-5 mt-1">댓글</h3>

            {comments.map((comment) => (
              <div key={comment.id} className="mb-12">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/icons/userbaseimage.svg"
                      alt="profile"
                      className="w-10 h-10 rounded-full"
                    />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] text-[#0A0A0A]">
                        {comment.is_anonymous ? "익명" : comment.author_name}
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
                        <Image
                          src="/icons/good.svg"
                          alt="like"
                          width={16}
                          height={16}
                        />
                        <span>{comment.like_count}</span>
                      </button>

                      <button onClick={() => setReplyOpen(comment.id)}>
                        답글
                      </button>

                      {(comment.author_id === currentUserId || isAdmin) && (
                        <button onClick={() => handleDeleteComment(comment.id)}>
                          삭제
                        </button>
                      )}
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

                    {comment.replies?.map((reply) => (
                      <div key={reply.id} className="mt-6 ml-10">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] text-[#0A0A0A]">
                            {reply.is_anonymous ? "익명" : reply.author_name}
                          </span>
                          <span className="text-[12px] text-[#6A7282]">
                            {reply.created_at?.slice(0, 10)}
                          </span>
                        </div>

                        <p className="mt-1 text-[14px] text-[#364153]">
                          {reply.content}
                        </p>

                        <div className="mt-2 flex gap-3 text-xs text-[#6A7282]">
                          {(reply.author_id === currentUserId || isAdmin) && (
                            <button
                              onClick={() => handleDeleteComment(reply.id)}
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

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
      </div>
    </div>
  );
}