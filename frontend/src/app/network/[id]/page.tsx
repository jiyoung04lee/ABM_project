"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchPostDetail,
  togglePostLike,
  fetchComments,
  addComment,
  pinPost,
  unpinPost,
  deletePost,
  PostDetail,
  Comment,
} from "@/shared/api/network";
import api from "@/shared/api/axios";
import { Pin } from "lucide-react";

export default function NetworkDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const data = await fetchPostDetail(id);
      setPost(data);
      const cs = await fetchComments(id);
      setComments(cs);
    })();
  }, [id]);

  useEffect(() => {
    api.get("users/me/").then((r) => setIsAdmin(!!r.data?.is_staff)).catch(() => {});
  }, []);

  const handlePin = async () => {
    if (!post || pinning) return;
    setPinning(true);
    try {
      await pinPost(post.id);
      setPost({ ...post, is_pinned: true });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? "고정에 실패했습니다.";
      alert(msg);
    } finally {
      setPinning(false);
    }
  };
  const handleUnpin = async () => {
    if (!post || pinning) return;
    setPinning(true);
    try {
      await unpinPost(post.id);
      setPost({ ...post, is_pinned: false });
    } catch {
      alert("고정 해제에 실패했습니다.");
    } finally {
      setPinning(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!window.confirm("이 게시글을 삭제하시겠습니까?")) return;

    try {
      await deletePost(post.id);
      alert("삭제되었습니다.");
      router.push("/network");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        "삭제에 실패했습니다. 권한이 없을 수 있습니다.";
      alert(msg);
    }
  };

  if (!post) return <div style={{ padding: 16 }}>로딩중…</div>;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <a href="/network" style={{ textDecoration: "underline" }}>
          ← 목록
        </a>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            {post.is_pinned ? (
              <button
                type="button"
                onClick={handleUnpin}
                disabled={pinning}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #f59e0b",
                  background: "#fffbeb",
                  color: "#b45309",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <Pin style={{ width: 16, height: 16 }} /> 고정 해제
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePin}
                disabled={pinning}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  color: "#374151",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <Pin style={{ width: 16, height: 16 }} /> 상단 고정
              </button>
            )}
          </div>
        )}
      </div>

      <h2 style={{ marginTop: 12 }}>{post.title}</h2>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        {post.category_name ?? "-"} · {post.author_name} · 조회 {post.view_count}
      </div>

      <div style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{post.content}</div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button
          onClick={async () => {
            const res = await togglePostLike(post.id);
            setPost({ ...post, like_count: res.like_count, is_liked: res.liked });
          }}
        >
          {post.is_liked ? "❤️" : "🤍"} {post.like_count}
        </button>
        <button
          onClick={handleDelete}
          style={{
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 12,
          }}
        >
          삭제
        </button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <h3>댓글 ({post.comment_count})</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="댓글 입력"
          style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <button
          disabled={commentSubmitting}
          onClick={async () => {
            if (commentSubmitting || !content.trim()) return;
            setCommentSubmitting(true);
            try {
              await addComment(id, { content });
              setContent("");
              const cs = await fetchComments(id);
              setComments(cs);
            } catch {
              alert("댓글 작성 실패");
            } finally {
              setCommentSubmitting(false);
            }
          }}
          style={{ opacity: commentSubmitting ? 0.5 : 1, cursor: commentSubmitting ? "not-allowed" : "pointer" }}
        >
          {commentSubmitting ? "작성 중..." : "등록"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {comments.map((c) => (
          <div key={c.id} style={{ border: "1px solid #eee", padding: 10, borderRadius: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              {c.author_name ?? "-"} · ❤️ {c.like_count}
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{c.content}</div>

            {c.replies?.length > 0 && (
              <div style={{ marginTop: 8, paddingLeft: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {c.replies.map((r) => (
                  <div key={r.id} style={{ borderLeft: "2px solid #eee", paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      {r.author_name ?? "-"} · ❤️ {r.like_count}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{r.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {comments.length === 0 && <div>댓글이 없어.</div>}
      </div>
    </div>
  );
}