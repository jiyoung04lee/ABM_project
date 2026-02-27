import { useEffect, useState } from "react";
import { Post } from "../types";
import { fetchPosts } from "../services";

export const usePosts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts().then((res) => {
      setPosts(res.data.posts);
      setLoading(false);
    });
  }, []);

  return { posts, loading };
};