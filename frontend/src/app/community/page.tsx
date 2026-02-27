"use client";

import { useEffect, useState } from "react";
import CommunityWriteBox from "@/features/community/components/CommunityWriteBox";
import CommunityPostItem from "@/features/community/components/CommunityPostItem";
import CommunityFilterBar from "@/features/community/components/CommunityFilterBar";
import { CommunityPost } from "@/features/community/types";
import { getPosts } from "@/shared/api/community";

export default function CommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFilter, setSelectedFilter] = useState("전체");
  const [sortType, setSortType] = useState<"latest" | "popular">("latest");
  const [searchKeyword, setSearchKeyword] = useState("");

  useEffect(() => {
    fetchPosts();
  }, [selectedFilter, sortType, searchKeyword]);

  const fetchPosts = async () => {
    try {
      setLoading(true);

      const res = await getPosts({
        category: selectedFilter !== "전체" ? selectedFilter : undefined,
        ordering: sortType === "popular" ? "likes" : undefined,
        search: searchKeyword || undefined,
      });

      const pinned = res.data.results.pinned;
      const normalPosts = res.data.results.posts;

      const combined = pinned
        ? [pinned, ...normalPosts]
        : normalPosts;

      setPosts(combined);
    } catch (err) {
      console.error("게시글 불러오기 실패", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <CommunityFilterBar
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        sortType={sortType}
        onSortChange={setSortType}
        searchKeyword={searchKeyword}
        onSearchChange={setSearchKeyword}
      />

      <CommunityWriteBox />

      <div className="mt-1">
        {loading ? (
          <div>로딩중...</div>
        ) : (
          posts.map((post) => (
            <CommunityPostItem key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  );
}