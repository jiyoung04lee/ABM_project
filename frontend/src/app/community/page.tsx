"use client";

import { useEffect, useState } from "react";
import WriteBox from "@/features/post/components/WriteBox";
import PostItem from "@/features/post/components/PostItem";
import FilterBar from "@/features/post/components/FilterBar";
import { Post } from "@/features/post/types";
import { getPosts } from "@/shared/api/community";
import { useRequireAuth } from "@/shared/hooks/useRequireAuth";

export default function CommunityPage() {
  const { isReady } = useRequireAuth();
  const [posts, setPosts] = useState<Post[]>([]);
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

      const rawPinned = res.data.results.pinned;
      const normalPosts = res.data.results.posts ?? [];
      const pinnedList = Array.isArray(rawPinned)
        ? rawPinned
        : rawPinned
          ? [rawPinned]
          : [];
      const combined = [...pinnedList, ...normalPosts];

      setPosts(combined);
    } catch (err) {
      console.error("게시글 불러오기 실패", err);
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) return null;

  return (
    <div className="max-w-3xl mx-auto px-6 pb-10">
      <FilterBar
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        sortType={sortType}
        onSortChange={setSortType}
        searchKeyword={searchKeyword}
        onSearchChange={setSearchKeyword}
      />

      <WriteBox />

      <div className="mt-1">
        {loading ? (
          <div>로딩중...</div>
        ) : (
          posts.map((post) => (
            <PostItem key={post.id} post={post} />
          ))
        )}
      </div>
    </div>
  );
}