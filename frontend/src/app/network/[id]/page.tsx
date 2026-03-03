"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  fetchPostDetail,
  togglePostLike,
  fetchComments,
  addComment,
  PostDetail,
  Comment,
} from "@/shared/api/network";

export default function NetworkDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    (async () => {
      const data = await fetchPostDetail(id);
      setPost(data);
      const cs = await fetchComments(id);
      setComments(cs);
    })();
  }, [id]);

  if (!post) return <div style={{ padding: 16 }}>로딩중…</div>;

  return (
    <div style={{ padding: 16 }}>
      <a href="/network" style={{ textDecoration: "underline" }}>
        ← 목록
      </a>

      <h2 style={{ marginTop: 12 }}>{post.title}</h2>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        {post.category_name ?? "-"} · {post.author_name} · 조회 {post.view_count}
      </div>

      <div style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>{post.content}</div>

      <div style={{ marginTop: 12 }}>
        <button
          onClick={async () => {
            const res = await togglePostLike(post.id);
            setPost({ ...post, like_count: res.like_count, is_liked: res.liked });
          }}
        >
          {post.is_liked ? "❤️" : "🤍"} {post.like_count}
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
          onClick={async () => {
            if (!content.trim()) return;
            await addComment(id, { content });
            setContent("");
            const cs = await fetchComments(id);
            setComments(cs);
            // comment_count는 백엔드에서 증가하니까 상세도 다시 받아오고 싶으면 fetchPostDetail 재호출도 가능
          }}
        >
          등록
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