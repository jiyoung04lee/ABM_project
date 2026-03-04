// frontend/src/shared/api/network.ts
import api from "@/shared/api/axios";

export type NetworkType = "student" | "graduate" | "qa";

export interface Category {
  id: number;
  type: NetworkType;
  name: string;
  slug: string;
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PostListItem {
  id: number;
  type: NetworkType;
  category: number | null;
  category_name: string | null;
  title: string;
  author_name: string;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  created_at: string;
  thumbnail: string | null;
}

export interface PostListResponse {
  pinned: PostListItem | null;
  posts: PostListItem[];
  count?: number;
  next?: string | null;
  previous?: string | null;
}

export interface PostDetail {
  id: number;
  type: NetworkType;
  title: string;
  content: string;
  author_name: string;
  is_anonymous: boolean;
  view_count: number;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  created_at: string;
  updated_at: string;
  thumbnail: string | null;
  files: { id: number; file: string; file_type: "image" | "pdf"; order: number }[];
  category: number | null;
  category_name: string | null;
}

export interface Comment {
  id: number;
  author: number | null;
  author_name: string | null;
  content: string;
  parent: number | null;
  is_deleted: boolean;
  created_at: string;
  replies: Comment[];
  is_liked: boolean;
  like_count: number;
}

/**
 * ✅ baseURL은 axios.ts에서 이미 "http://localhost:8000/api/" 로 잡혀있음
 * 그래서 여기서는 "networks/..." 처럼 /api/ 없이 상대경로만 쓰면 됨.
 */

export async function fetchCategories(type: NetworkType) {
  const { data } = await api.get<Paginated<Category>>("networks/categories/", {
    params: { type },
  });
  return data.results;
}

export async function fetchPosts(params: {
  type: NetworkType;
  category?: string; // slug
  search?: string;
  ordering?: "likes";
  page?: number;
}): Promise<PostListResponse> {
  const { data } = await api.get("networks/posts/", { params });

  // DRF 전역 pagination 이 적용되면 { count, next, previous, results: { pinned, posts } }
  // 로 감싸져서 오기 때문에 results 안쪽을 꺼낸다.
  const payload = (data as any).results ?? data;

  return {
    pinned: payload.pinned ?? null,
    posts: payload.posts ?? [],
    count: (data as any).count,
    next: (data as any).next ?? null,
    previous: (data as any).previous ?? null,
  };
}

export async function fetchPostDetail(id: number) {
  const { data } = await api.get<PostDetail>(`networks/posts/${id}/`);
  return data;
}

export async function togglePostLike(id: number) {
  const { data } = await api.post<{ liked: boolean; like_count: number }>(
    `networks/posts/${id}/like/`
  );
  return data;
}

export async function fetchComments(postId: number) {
  const { data } = await api.get<Comment[]>(`networks/posts/${postId}/comments/`);
  return data;
}

export async function addComment(
  postId: number,
  payload: { content: string; parent?: number | null }
) {
  const { data } = await api.post<Comment>(`networks/posts/${postId}/add_comment/`, payload);
  return data;
}

export async function createPost(formData: FormData) {
  const { data } = await api.post<PostDetail>("networks/posts/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/* (선택) 댓글 like / delete도 네가 쓰면 추가 가능
export async function toggleCommentLike(commentId: number) {
  const { data } = await api.post(`networks/comments/${commentId}/like/`);
  return data;
}

export async function deleteComment(commentId: number) {
  await api.delete(`networks/comments/${commentId}/`);
}
*/