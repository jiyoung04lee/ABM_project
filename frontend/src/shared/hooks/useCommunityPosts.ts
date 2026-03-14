import useSWR from "swr";
import { getPosts } from "@/shared/api/community";
import type { Post } from "@/features/post/types";

function buildKey(
  filter: string,
  sortType: string,
  search: string
): string {
  return `community-posts:${filter}:${sortType}:${search}`;
}

async function fetcher(
  _key: string,
  selectedFilter: string,
  sortType: "latest" | "popular",
  searchKeyword: string
): Promise<Post[]> {
  const res = await getPosts({
    category: selectedFilter !== "전체" ? selectedFilter : undefined,
    ordering: sortType === "popular" ? "likes" : undefined,
    search: searchKeyword || undefined,
  });

  const raw = (res.data as { results?: { pinned?: unknown; posts?: Post[] } })
    ?.results ?? res.data as { pinned?: unknown; posts?: Post[] };
  const rawPinned = raw.pinned;
  const normalPosts = raw.posts ?? [];
  const pinnedList = Array.isArray(rawPinned)
    ? rawPinned
    : rawPinned
      ? [rawPinned]
      : [];

  return [...pinnedList, ...normalPosts] as Post[];
}

export function useCommunityPosts(
  selectedFilter: string,
  sortType: "latest" | "popular",
  searchKeyword: string
) {
  const key = buildKey(selectedFilter, sortType, searchKeyword);
  const { data, error, isLoading, mutate } = useSWR(
    [key, selectedFilter, sortType, searchKeyword],
    ([_, filter, sort, search]) => fetcher(key, filter, sort, search),
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      keepPreviousData: true,
    }
  );

  return {
    posts: data ?? [],
    isLoading,
    error,
    mutate,
  };
}
