import api from "./axios";

export interface GetPostsParams {
  category?: string;
  ordering?: string;
  search?: string;
}

export const getPosts = (params?: GetPostsParams) => {
  return api.get("community/posts/", { params });
};

export const togglePostLike = (id: number) => {
  return api.post(`community/posts/${id}/like/`);
};