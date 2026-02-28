"use client";

import axios, { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostDetail, Comment } from "@/features/post/types";
import {
  getPostDetail,
  togglePostLike,
  toggleCommentLike,
  createComment,
  deleteComment,
} from "@/shared/api/community";
import PostMeta from "@/features/post/components/PostMeta";
import Image from "next/image";

export default function PostDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyInput, setReplyInput] = useState<{ [key: number]: string }>({});
  const [replyOpen, setReplyOpen] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, []);

  const fetchDetail = async () => {
    try {
      const res = await getPostDetail(Number(id));
      setPost(res.data);
      setLiked(res.data.is_liked);
      setLikeCount(res.data.like_count);
      setComments(res.data.comments || []);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    const res = await togglePostLike(Number(id));
    setLiked(res.data.liked);
    setLikeCount(res.data.like_count);
  };

  const handleCommentLike = async (commentId: number) => {
    try {
      const res = await toggleCommentLike(commentId);

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                is_liked: res.data.liked,
                like_count: res.data.like_count,
              }
            : comment
        )
      );
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        alert("로그인이 필요합니다.");
      }
    }
  };
  
  // 댓글 작성 
  const handleCreateComment = async (
    parent: number | null = null
  ) => {
    const content =
      parent === null
        ? commentInput.trim()
        : replyInput[parent]?.trim();

    if (!content) return;

    try {
      const payload: { content: string; parent?: number; is_anonymous?: boolean} = {
        content, is_anonymous: isAnonymous,
      };

      if (parent !== null) {
        payload.parent = parent;
      }

      const res = await createComment(Number(id), payload);

      if (parent === null) {
        setComments((prev) => [...prev, res.data]);
        setCommentInput("");
      } else {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === parent
              ? {
                  ...comment,
                  replies: [...comment.replies, res.data],
                }
              : comment
          )
        );
        setReplyInput((prev) => ({ ...prev, [parent]: "" }));
        setReplyOpen(null);
      }
    } catch (err) {
      console.log("에러전체: ", err)
      alert("댓글 작성 실패");
    }
  };

  // 댓글 삭제 
  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(commentId);

      setComments((prev) =>
        prev
          .filter((comment) => comment.id !== commentId)
          .map((comment) => ({
            ...comment,
            replies: comment.replies.filter(
              (reply) => reply.id !== commentId
            ),
          }))
      );
    } catch {
      alert("삭제 실패");
    }
  };

  if (loading) return <div className="p-10">로딩중...</div>;
  if (!post) return <div className="p-10">게시글이 없습니다.</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <button onClick={() => router.back()} className="mb-6">
        <Image src="/icons/back.svg" alt="back" width={24} height={24} />
      </button>

      <PostMeta
        author={post.author_name}
        createdAt={post.created_at}
        isAnonymous={post.is_anonymous}
      />

      <div className="border-b border-[#E5E7EB] mb-10" />

      {post.category && (
        <div className="mt-2 mb-6">
          <span className="inline-flex px-3 py-[6px] rounded-full text-[14px] bg-[#EFF6FF] text-[#155DFC]">
            {post.category_name}
          </span>
        </div>
      )}

      <h1 className="text-[30px] font-semibold text-[#0A0A0A] mb-6">
        {post.title}
      </h1>

      <div className="whitespace-pre-line text-[15px] font-normal text-[#364153] mb-6">
        {post.content}
      </div>

      {post.thumbnail && (
        <div className="mb-6 rounded-lg overflow-hidden">
          <img
            src={post.thumbnail}
            alt="thumbnail"
            width={800}
            height={200}
            className="rounded-lg"
          />
        </div>
      )}

      <div className="flex justify-end mt-8">
        <button
          onClick={handleLike}
          className="flex items-center gap-2 px-4 py-2 bg-[#F3F4F6] rounded-lg mb-5"
        >
          <Image
            src={liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
            alt="like"
            width={18}
            height={18}
            className="shrink-0"
          />
          <span className="text-[14px] text-[#0A0A0A] leading-none">
            {likeCount}
          </span>
        </button>
      </div>

      <div className="mt-1 border-t border-[#E5E7EB] pt-5">
        <h3 className="text-[20px] font-semibold mb-5 mt-1">댓글</h3>

      {comments.length === 0 ? (
        <div className="py-20 text-center text-[#9CA3AF] text-[14px]">
          아직 작성된 댓글이 없습니다.
        </div>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="mb-12">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <Image src="/icons/userbaseimage.svg" alt="user" width={40} height={40} />
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
                  <button onClick={() => handleCommentLike(comment.id)} className="flex items-center gap-1" >
                    <Image src={"/icons/good.svg"} alt="like" width={16} height={16} />
                    <span>{comment.like_count}</span>
                  </button>

                  <button onClick={() => setReplyOpen(comment.id)}>
                    답글
                  </button>

                  <button onClick={() => handleDeleteComment(comment.id)}>
                    삭제
                  </button>
                </div>

                {/* 대댓글 입력 */}
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

                {/* 대댓글 렌더 */}
                {comment.replies?.map((reply) => (
                  <div key={reply.id} className="mt-6 ml-10">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] text-[#0A0A0A]">
                        {reply.author_name}
                      </span>
                      <span className="text-[12px] text-[#6A7282]">
                        {reply.created_at?.slice(0, 10)}
                      </span>
                    </div>

                    <p className="mt-1 text-[14px] text-[#364153]">
                      {reply.content}
                    </p>

                    <div className="mt-2 flex gap-3 text-xs text-[#6A7282]">
                      <button onClick={() => handleDeleteComment(reply.id)}>
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}

        <div className="pt-5 border-t border-[#E5E7EB]">
          <textarea
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="w-full min-h-[160px] border border-[#E5E7EB] rounded-xl p-5 text-[15px] leading-[24px] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF] mt-5"
          />

          <div className="flex justify-between items-center mt-5">
            <label className="text-sm text-[#6A7282]">
              <input 
                type="checkbox" 
                className="mr-2"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)} />
              익명으로 작성
            </label>

            <button
              onClick={() => handleCreateComment(null)}
              className="px-4 py-2 bg-[#2B7FFF] text-white rounded-lg text-sm"
            >
              댓글 작성
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}