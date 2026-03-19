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
  deletePost,
  PostDetail,
  Comment,
} from "@/shared/api/network";

import api from "@/shared/api/axios";
import { API_BASE } from "@/shared/api/api";
import PostMeta from "@/features/post/components/PostMeta";

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // useEffect(() => {
  //   api
  //     .get("users/me/")
  //     .then((r) => {
  //       setIsAdmin(!!r.data?.is_staff);
  //       setCurrentUserId(r.data?.id);
  //     })
  //     .catch(() => {});
  // }, []);
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return; // 토큰 없으면 아예 요청 안 함
    api
      .get("users/me/")
      .then((r) => {
        setIsAdmin(!!r.data?.is_staff);
        setCurrentUserId(r.data?.id);
      })
      .catch(() => {});
  }, []);

  const loadData = async () => {
    const [data, cs] = await Promise.all([
      fetchPostDetail(Number(id)),
      fetchComments(Number(id)),
    ]);
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

  const isAuthor = currentUserId != null && post?.author_id === currentUserId;

  const handleEdit = () => {
    router.push(`/network/edit/${id}`);
  };

  const handleDelete = async () => {
    if (!post || deleting) return;
    if (!confirm("정말 이 글을 삭제할까요?")) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      router.push("/network");
    } catch {
      alert("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  //댓글 작성 
  const handleCreateComment = async (parent: number | null = null) => {
    if (commentSubmitting) return;

    // 열려있는 답글창(replyOpen)의 입력값을 우선적으로 가져옵니다.
    let content = "";
    if (parent === null) {
      content = commentInput.trim();
    } else {
      content = replyInput[replyOpen!]?.trim() || replyInput[parent]?.trim() || "";
    }

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
          prev.map((c) =>
            c.id === parent
              ? {
                  ...c,
                  replies: [...(c.replies || []), res],
                }
              : c
          )
        );
        // 입력창 초기화
        setReplyInput((prev) => ({ ...prev, [replyOpen!]: "", [parent]: "" }));
        setReplyOpen(null);
      }
    } catch (err) {
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

      <div className="flex items-start justify-between mb-4">
        <PostMeta
          author={post.author_name}
          profileImage={post.author_profile_image ?? "/icons/userbaseimage.svg"}
          createdAt={post.created_at}
          isAnonymous={post.is_anonymous}
          authorId={post.author_id}
          isNickname={true}
        />

        {isAuthor && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleEdit}
              className="text-[13px] text-[#6A7282] hover:text-[#2B7FFF]"
            >
              수정
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-[13px] text-[#6A7282] hover:text-[#DC2626] disabled:opacity-50"
            >
              {deleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-[#E5E7EB] mb-10 mt-4" />

      <h1 className="text-[30px] font-semibold text-[#0A0A0A] mb-6">
        {post.title}
      </h1>

      {post.type === "qa" ? (
        <div className="whitespace-pre-line text-[15px] font-normal text-[#364153] mb-6">
          {post.content ?? ""}
        </div>
      ) : (
      <div
        className="text-[15px] text-[#364153] mb-6 leading-relaxed [&>p]:mb-4 [&_li>p]:mb-4 [&>p:empty]:h-4 [&_li>p:empty]:h-4 [&>h2]:mt-6 [&>hr]:my-6"
        dangerouslySetInnerHTML={{
          __html: (() => {
            let html = post.content ?? "";
            const base = API_BASE.replace(/\/$/, "");
            const imageFiles = (post.files ?? [])
              .filter((f) => f.file_type === "image")
              .sort((a, b) => a.order - b.order);
            imageFiles.forEach((f, idx) => {
              const raw = f.file ?? "";
              const realUrl =
                raw && (raw.startsWith("http://") || raw.startsWith("https://"))
                  ? raw
                  : raw
                    ? `${base}${raw.startsWith("/") ? raw : `/${raw}`}`
                    : "";
              if (realUrl)
                html = html.replace(
                  new RegExp(`src="__BLOB_${idx}__"`, "g"),
                  `src="${realUrl}"`
                );
            });
            html = html.replace(/<img[^>]*src="blob:[^"]*"[^>]*\/?>/gi, "");
            html = html.replace(/<img[^>]*src="__BLOB_\d+__"[^>]*\/?>/gi, "");
            html = html.replace(
              /<link-card[^>]*url="([^"]+)"[^>]*>(.*?)<\/link-card>/gi,
              (match, url) => {
                let domain = "";
                try {
                  domain = new URL(url).hostname;
                } catch {
                  domain = url;
                }

                return `
                <a href="${url}" target="_blank" rel="noopener noreferrer" class="not-prose block border rounded-lg overflow-hidden shadow-sm hover:bg-gray-50 my-4 no-underline text-inherit">
                  <div class="flex items-center">
                    <div class="w-32 h-20 bg-gray-100 flex items-center justify-center text-gray-400 shrink-0 border-r">
                      <span style="font-size: 20px;">🔗</span>
                    </div>
                    <div class="p-3 overflow-hidden">
                      <div class="text-sm font-medium truncate text-blue-600">${url}</div>
                      <div class="text-xs text-gray-500 mt-1">${domain}</div>
                    </div>
                  </div>
                </a>
                `;
              }
            );
            
            html = html.replace(
              /<link-card[^>]*url="([^"]+)"[^>]*\/?>/gi,
              (match, url) => {
                let domain = ""; try { domain = new URL(url).hostname; } catch { domain = url; }
                return `<a href="${url}" target="_blank" ... (생략) ... </a>`;
              }
            );

            return html;
          })(),
        }}
      />
      )}

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

      {/* 댓글 섹션 시작 */}
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
                  <img
                    src="/icons/userbaseimage.svg"
                    alt="profile"
                    className="w-10 h-10 rounded-full object-cover"
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
                      className={`flex items-center gap-1 transition-colors ${
                        comment.is_liked ? "text-[#2B7FFF]" : "text-[#6A7282]"
                      }`}
                    >
                      <Image
                        src={comment.is_liked ? "/icons/good_blue.svg" : "/icons/good.svg"}
                        alt="like"
                        width={16}
                        height={16}
                      />
                      <span>{comment.like_count}</span>
                    </button>

                    <button onClick={() => setReplyOpen(replyOpen === comment.id ? null : comment.id)}>
                      답글
                    </button>

                    {(comment.author_id === currentUserId || isAdmin) && (
                      <button onClick={() => handleDeleteComment(comment.id)}>
                        삭제
                      </button>
                    )}
                  </div>

                  {/* 답글(대댓글) 입력창 - 커뮤니티 스타일 */}
                  {replyOpen === comment.id && (
                    <div className="mt-4 pl-4 border-l-2 border-[#E5E7EB]">
                      <textarea
                        value={replyInput[comment.id] || ""}
                        onChange={(e) =>
                          setReplyInput((prev) => ({
                            ...prev,
                            [comment.id]: e.target.value,
                          }))
                        }
                        placeholder="답글을 입력하세요..."
                        className="w-full min-h-[80px] border border-[#E5E7EB] rounded-xl p-3 text-sm focus:outline-none"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => handleCreateComment(comment.id)}
                          disabled={commentSubmitting}
                          className="px-3 py-1.5 bg-[#2B7FFF] text-white rounded-lg text-xs disabled:opacity-50"
                        >
                          {commentSubmitting ? "작성 중..." : "답글 등록"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 대댓글 리스트 렌더링 - 커뮤니티 스타일 */}
                  {comment.replies?.map((reply) => (
                    <div key={reply.id} className="mt-6 ml-10">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                          <img
                            src={reply.author_profile_image || "/icons/userbaseimage.svg"}
                            alt="user"
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        </div>
                        <span className="text-[14px] font-medium text-[#0A0A0A]">
                          {reply.is_anonymous ? "익명" : reply.author_name}
                        </span>
                        <span className="text-[12px] text-[#6A7282]">
                          {reply.created_at?.slice(0, 10)}
                        </span>
                      </div>

                      <p className="mt-1 text-[14px] text-[#364153]">
                        {reply.content}
                      </p>

                      <div className="mt-2 flex gap-3 text-xs text-[#6A7282] items-center">
                        <button
                          onClick={() => handleCommentLike(reply.id)}
                          className={`flex items-center gap-1 transition-colors ${
                            reply.is_liked ? "text-[#2B7FFF]" : "text-[#6A7282]"
                          }`}
                        >
                          <Image
                            src={reply.is_liked ? "/icons/good_blue.svg" : "/icons/good.svg"}
                            alt="like"
                            width={14}
                            height={14}
                          />
                          <span>{reply.like_count}</span>
                        </button>

                        <button 
                          onClick={() => setReplyOpen(replyOpen === reply.id ? null : reply.id)}
                          className="hover:text-[#2B7FFF]"
                        >
                          답글
                        </button>

                        {(reply.author_id === currentUserId || isAdmin) && (
                          <button onClick={() => handleDeleteComment(reply.id)} className="hover:text-red-500">
                            삭제
                          </button>
                        )}
                      </div>

                      {/* 대댓글에 대한 답글 입력창 */}
                      {replyOpen === reply.id && (
                        <div className="mt-3">
                          <textarea
                            value={replyInput[reply.id] || ""}
                            onChange={(e) =>
                              setReplyInput((prev) => ({
                                ...prev,
                                [reply.id]: e.target.value,
                              }))
                            }
                            placeholder="답글을 입력하세요..."
                            className="w-full border border-[#E5E7EB] rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#2B7FFF]"
                          />
                          <div className="flex justify-end mt-1.5">
                            <button
                              onClick={() => handleCreateComment(comment.id)} // 최상위 댓글 ID를 parent로 전달
                              disabled={commentSubmitting}
                              className="px-3 py-1 bg-[#2B7FFF] text-xs text-white rounded disabled:opacity-50"
                            >
                              {commentSubmitting ? "작성 중..." : "답글 등록"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}

        {/* 메인 댓글 작성란 */}
        <div className="pt-5 border-t border-[#E5E7EB]">
          <textarea
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="w-full min-h-[160px] border border-[#E5E7EB] rounded-xl p-5 text-[15px] focus:outline-none focus:ring-1 focus:ring-[#2B7FFF] mt-5"
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
              className="px-4 py-2 bg-[#2B7FFF] text-white rounded-lg text-sm disabled:opacity-50"
            >
              {commentSubmitting ? "작성 중..." : "댓글 작성"}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}