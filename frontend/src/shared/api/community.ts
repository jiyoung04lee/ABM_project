import api from "./axios";

/* =======================
   게시글 목록
======================= */
export const getPosts = (params?: {
  category?: string;
  ordering?: string;
  search?: string;
}) => {
  return api.get("community/posts/", { params });
};

/* =======================
   게시글 상세
======================= */
export const getPostDetail = (id: number) => {
  return api.get(`community/posts/${id}/`);
};

/* =======================
   게시글 생성
======================= */
export const createPost = (data: FormData) => {
  return api.post("community/posts/", data);
};

/* =======================
   좋아요 토글
======================= */
export const togglePostLike = (id: number) => {
  return api.post(`community/posts/${id}/like/`);
};

/* =======================
   카테고리 조회
======================= */
export const getCategories = (group: string) => {
  return api.get("community/categories/", {
    params: { group },
  });
};

/* =======================
   댓글 좋아요
======================= */
export const toggleCommentLike = (commentId: number) => {
  return api.post(`community/comments/${commentId}/like/`);
};

/* =======================
   댓글 작성
======================= */
export const createComment = (
  postId: number,
  data: { content: string; parent?: number }
) => {
  return api.post(
    `community/posts/${postId}/add_comment/`,
    data
  );
};

/* =======================
   댓글 삭제
======================= */
export const deleteComment = (commentId: number) => {
  return api.delete(`community/comments/${commentId}/`);
};