"use client";

import { CommunityPost } from "../types";
import CommunityPostItem from "./CommunityPostItem";

interface Props {
  posts: CommunityPost[];
}

export default function CommunityPostList({ posts }: Props) {
  const sortedPosts = [...posts].sort(
    (a, b) => Number(b.isPinned) - Number(a.isPinned)
  );

  return (
    <div>
      {sortedPosts.map((post) => (
        <CommunityPostItem key={post.id} post={post} />
      ))}
    </div>
  );
}