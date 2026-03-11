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
        {!isReady || loading ? (
          <div className="space-y-4 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                className="animate-pulse rounded-xl border border-gray-100 bg-white p-4"
              >
                <div className="h-40 w-full rounded-lg bg-gray-200 mb-4" />
                <div className="h-4 w-32 bg-gray-200 mb-2 rounded" />
                <div className="h-5 w-3/4 bg-gray-200 mb-2 rounded" />
                <div className="h-4 w-1/2 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-6 text-sm text-gray-500 text-center">
            아직 작성된 글이 없습니다.
          </div>
        ) : (
          posts.map((post) => <PostItem key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}