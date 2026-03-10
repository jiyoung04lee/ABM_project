"use client";

import axios, { AxiosError } from "axios";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PostDetail, Comment as PostComment } from "@/features/post/types";
import {
  getPostDetail,
  togglePostLike,
  toggleCommentLike,
  createComment,
  deleteComment,
  pinPost,
  unpinPost,
} from "@/shared/api/community";
import api from "@/shared/api/axios";
import PostMeta from "@/features/post/components/PostMeta";
import Image from "next/image";
import { Pin, ChevronLeft, Heart, MessageCircle, User, CornerDownRight } from "lucide-react";

export default function PostDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [replyInput, setReplyInput] = useState<{ [key: number]: string }>({});
  const [replyOpen, setReplyOpen] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await getPostDetail(Number(id));
      setPost(res.data as PostDetail);
      setLiked(res.data.is_liked);
      setLikeCount(res.data.like_count);
      setComments(res.data.comments || []);
    } catch (error) {
      console.error("게시글 로딩 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    api.get("users/me/").then((r) => setIsAdmin(!!r.data?.is_staff)).catch(() => {});
  }, []);

  const handleLike = async () => {
    try {
      const res = await togglePostLike(Number(id));
      setLiked(res.data.liked);
      setLikeCount(res.data.like_count);
    } catch (err) {
      alert("로그인이 필요합니다.");
    }
  };

  const handleCommentLike = async (commentId: number) => {
    try {
      const res = await toggleCommentLike(commentId);
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? { ...comment, is_liked: res.data.liked, like_count: res.data.like_count }
            : comment
        )
      );
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.status === 401) {
        alert("로그인이 필요합니다.");
      }
    }
  };

  const handleCreateComment = async (parent: number | null = null) => {
    if (commentSubmitting) return;
    const content = parent === null ? commentInput.trim() : replyInput[parent]?.trim();
    if (!content) return;

    setCommentSubmitting(true);
    try {
      const payload = { content, is_anonymous: isAnonymous, ...(parent && { parent }) };
      const res = await createComment(Number(id), payload);

      if (parent === null) {
        setComments((prev) => [...prev, res.data]);
        setCommentInput("");
      } else {
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === parent
              ? { ...comment, replies: [...(comment.replies || []), res.data] }
              : comment
          )
        );
        setReplyInput((prev) => ({ ...prev, [parent]: "" }));
        setReplyOpen(null);
      }
    } catch (err) {
      alert("댓글 작성 실패");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handlePinAction = async () => {
    if (pinning || !post) return;
    setPinning(true);
    try {
      if (post.is_pinned) {
        await unpinPost(post.id);
        setPost({ ...post, is_pinned: false });
      } else {
        await pinPost(post.id);
        setPost({ ...post, is_pinned: true });
      }
    } catch (err: any) {
      alert(err?.response?.data?.detail ?? "처리 실패");
    } finally {
      setPinning(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await deleteComment(commentId);
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId).map((c) => ({
          ...c,
          replies: (c.replies || []).filter((r) => r.id !== commentId)
        }))
      );
    } catch {
      alert("삭제 실패");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">로딩중...</div>;
  if (!post) return <div className="min-h-screen flex items-center justify-center text-gray-500">게시글이 없습니다.</div>;

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* 상단 바 */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center justify-between py-4">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">뒤로가기</span>
            </button>
            
            {isAdmin && (
              <button
                onClick={handlePinAction}
                disabled={pinning}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  post.is_pinned 
                  ? "bg-amber-50 text-amber-700 border border-amber-200" 
                  : "bg-gray-50 text-gray-600 border border-gray-200"
                }`}
              >
                <Pin className={`w-4 h-4 ${post.is_pinned ? "fill-current" : ""}`} />
                {post.is_pinned ? "고정 해제" : "상단 고정"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* 게시글 헤더 */}
        <div className="flex gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {post.author_profile_image && !post.is_anonymous ? (
              <img src={post.author_profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-lg font-bold">
                {post.is_anonymous ? "익" : (post.author_name?.charAt(0) || "익")}
              </span>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 text-base">
                {post.is_anonymous ? "익명" : (post.author_name || "익명")}
              </span>
              {post.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-current" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{post.created_at?.slice(0, 10)}</span>
              <span>·</span>
              <span className="text-[#2563EB] font-medium">{post.category_name || "알쓸생잡"}</span>
              <span>·</span>
              <span>조회수 {(post as any).view_count ?? 0}</span>
            </div>
          </div>
        </div>

        {/* 게시글 본문 */}
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-6 leading-tight">
            {post.title}
          </h1>
          <div className="text-gray-700 text-[16px] leading-relaxed whitespace-pre-line mb-8">
            {post.content}
          </div>
          
          {post.thumbnail && (
            <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 mb-8">
              <img src={post.thumbnail} alt="" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
            </div>
          )}

          <div className="flex items-center gap-6 py-6 border-y border-gray-100">
            <button 
              onClick={handleLike}
              className={`flex items-center gap-2 transition-colors ${liked ? "text-[#2563EB]" : "text-gray-500 hover:text-gray-900"}`}
            >
              <Heart className={`w-6 h-6 ${liked ? "fill-current" : ""}`} />
              <span className="font-bold">{likeCount}</span>
            </button>
            <div className="flex items-center gap-2 text-gray-500">
              <MessageCircle className="w-6 h-6" />
              <span className="font-bold">{comments.length}</span>
            </div>
          </div>
        </div>

        {/* 댓글 섹션 */}
        <div className="space-y-8">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            댓글 <span className="text-[#2563EB]">{comments.length}</span>
          </h3>

          {comments.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
              첫 번째 댓글을 남겨보세요!
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map((comment) => (
                <div key={comment.id} className="group">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200 overflow-hidden">
                      {comment.author_profile_image && !comment.is_anonymous ? (
                        <img src={comment.author_profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 rounded-2xl px-4 py-3 relative">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-gray-900">
                            {comment.is_anonymous ? "익명" : comment.author_name}
                          </span>
                          <span className="text-[10px] text-gray-400">{comment.created_at?.slice(0, 10)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-normal">{comment.content}</p>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-2 ml-2 text-[11px] font-bold text-gray-500">
                        <button 
                          onClick={() => handleCommentLike(comment.id)}
                          className={`hover:text-gray-900 ${comment.is_liked ? "text-[#2563EB]" : ""}`}
                        >
                          좋아요 {comment.like_count > 0 && comment.like_count}
                        </button>
                        <button onClick={() => setReplyOpen(replyOpen === comment.id ? null : comment.id)} className="hover:text-gray-900">답글달기</button>
                        {(isAdmin || !comment.is_anonymous) && (
                          <button onClick={() => handleDeleteComment(comment.id)} className="text-red-400 hover:text-red-600">삭제</button>
                        )}
                      </div>

                      {replyOpen === comment.id && (
                        <div className="mt-3 ml-4 flex gap-2">
                          <textarea
                            value={replyInput[comment.id] || ""}
                            onChange={(e) => setReplyInput(prev => ({ ...prev, [comment.id]: e.target.value }))}
                            placeholder="답글을 입력하세요..."
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[#2563EB] bg-white h-20 resize-none"
                          />
                          <button
                            onClick={() => handleCreateComment(comment.id)}
                            disabled={commentSubmitting}
                            className="self-end px-4 py-2 bg-[#2563EB] text-white rounded-xl text-xs font-bold disabled:opacity-50"
                          >
                            등록
                          </button>
                        </div>
                      )}

                      {comment.replies?.map((reply) => (
                        <div key={reply.id} className="mt-4 ml-4 flex gap-3">
                          <CornerDownRight className="w-4 h-4 text-gray-300 mt-1" />
                          <div className="flex-1">
                            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl px-4 py-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs text-gray-900">{reply.author_name}</span>
                                <span className="text-[10px] text-gray-400">{reply.created_at?.slice(0, 10)}</span>
                              </div>
                              <p className="text-sm text-gray-700">{reply.content}</p>
                            </div>
                            <div className="mt-1 ml-2">
                              <button onClick={() => handleDeleteComment(reply.id)} className="text-[10px] font-bold text-red-400">삭제</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 하단 댓글 입력창 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-30">
          <div className="max-w-4xl mx-auto px-2">
            <div className="flex gap-3 items-end">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl p-3 focus-within:bg-white focus-within:border-[#2563EB] transition-all">
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="공급하기나 나누고 싶은 생각을 공유해보세요!"
                  className="w-full bg-transparent border-none focus:ring-0 text-sm h-10 resize-none py-1"
                />
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-1.5 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={isAnonymous}
                      onChange={(e) => setIsAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <span className="text-xs font-bold text-gray-500 group-hover:text-gray-700 transition-colors">익명</span>
                  </label>
                  <button
                    onClick={() => handleCreateComment(null)}
                    disabled={commentSubmitting || !commentInput.trim()}
                    className="px-5 py-1.5 bg-[#2563EB] text-white rounded-full text-sm font-bold hover:bg-[#1d4ed8] disabled:opacity-30 disabled:grayscale transition-all"
                  >
                    {commentSubmitting ? "..." : "게시"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}