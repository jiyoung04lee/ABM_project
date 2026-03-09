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
  is_pinned?: boolean;
}

export interface PostListResponse {
  pinned: PostListItem[];
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
  is_pinned?: boolean;
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
  const payload = (data as any).results ?? data;

  const rawPinned = payload.pinned;
  const pinnedList = Array.isArray(rawPinned)
    ? rawPinned
    : rawPinned
      ? [rawPinned]
      : [];
  return {
    pinned: pinnedList,
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

/** 게시글 상단 고정 (관리자 전용) */
export async function pinPost(id: number) {
  await api.post(`networks/posts/${id}/pin/`);
}

/** 게시글 고정 해제 (관리자 전용) */
export async function unpinPost(id: number) {
  await api.post(`networks/posts/${id}/unpin/`);
}

// 댓글 like / delete도 네가 쓰면 추가 가능
export async function toggleCommentLike(commentId: number) {
  const { data } = await api.post(`networks/comments/${commentId}/like/`);
  return data;
}

export async function deleteComment(commentId: number) {
  await api.delete(`networks/comments/${commentId}/`);
}