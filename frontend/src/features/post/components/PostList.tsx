"use client";

import { Post } from "../types";
import PostItem from "./PostItem";

interface Props {
  posts: Post[];
}

export default function PostList({ posts }: Props) {
  const sortedPosts = [...posts].sort(
    (a, b) => Number(b.is_pinned) - Number(a.is_pinned)
  );

  return (
    <div>
      {sortedPosts.map((post) => (
        <PostItem key={post.id} post={post} />
      ))}
    </div>
  );
}