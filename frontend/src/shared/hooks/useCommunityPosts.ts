import { useCallback } from "react";
import useSWRInfinite from "swr/infinite";
import { getPosts } from "@/shared/api/community";
import type { Post } from "@/features/post/types";

interface CommunityPage {
  pinned: Post[];
  posts: Post[];
  hasMore: boolean;
}

type CommunityPageKey = readonly [string, string, "latest" | "popular", string, number];

async function fetcher(
  [, selectedFilter, sortType, searchKeyword, page]: CommunityPageKey
): Promise<CommunityPage> {
  const { data } = await getPosts({
    category: selectedFilter !== "전체" ? selectedFilter : undefined,
    ordering: sortType === "popular" ? "likes" : undefined,
    search: searchKeyword || undefined,
    page,
  });

  const raw = "results" in data ? data.results : data;
  const rawPinned = raw.pinned;

  return {
    pinned: Array.isArray(rawPinned) ? rawPinned : rawPinned ? [rawPinned] : [],
    posts: raw.posts ?? [],
    hasMore: "next" in data && Boolean(data.next),
  };
}

export function useCommunityPosts(
  selectedFilter: string,
  sortType: "latest" | "popular",
  searchKeyword: string
) {
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    (pageIndex: number, previousPage: CommunityPage | null): CommunityPageKey | null => {
      if (previousPage && !previousPage.hasMore) return null;
      return ["community-posts", selectedFilter, sortType, searchKeyword, pageIndex + 1];
    },
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      // 검색·필터·정렬 조건이 바뀌면 새 목록의 첫 페이지부터 시작한다.
      persistSize: false,
      keepPreviousData: false,
    }
  );

  // 서버는 매 페이지에 고정글을 반환하므로 맨 위에 한 번만 표시한다.
  const seen = new Set<number>();
  const posts = [
    ...(data?.[0]?.pinned ?? []),
    ...(data?.flatMap((page) => page.posts) ?? []),
  ].filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
  const hasMore = data?.[data.length - 1]?.hasMore ?? false;
  const isLoadingMore = hasMore && !error && Boolean(data && !data[size - 1]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isValidating || error) return;
    void setSize(size + 1).catch(() => {});
  }, [hasMore, isLoadingMore, isValidating, error, setSize, size]);

  const retry = useCallback(() => {
    void mutate().catch(() => {});
  }, [mutate]);

  return {
    posts,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    retry,
    error,
    mutate,
  };
}
