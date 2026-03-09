import api from "@/shared/api/axios";
import { Post } from "./types";

export const fetchPosts = async (): Promise<Post[]> => {
  const res = await api.get("community/posts/");
  return res.data;
};