import useSWR from "swr";
import type { NetworkType } from "@/shared/api/network";
import {
  fetchPosts,
  type PostListResponse,
  type PostListItem,
} from "@/shared/api/network";

const PAGE_SIZE = 9;

function buildKey(
  type: NetworkType,
  category: string | undefined,
  page: number
): string {
  return `network-posts:${type}:${category ?? "all"}:${page}`;
}

async function fetcher(
  _key: string,
  type: NetworkType,
  category: string | undefined,
  page: number
): Promise<{
  pinned: PostListItem[];
  posts: PostListItem[];
  totalPages: number;
  count: number;
}> {
  const res = await fetchPosts({ type, category, page });
  const totalPages =
    res.total_pages && res.total_pages > 0
      ? res.total_pages
      : Math.max(1, Math.ceil((res.count ?? 0) / PAGE_SIZE));
  return {
    pinned: res.pinned ?? [],
    posts: res.posts ?? [],
    totalPages,
    count: res.count ?? 0,
  };
}

export function useNetworkPosts(
  type: NetworkType,
  categorySlug: string | undefined,
  page: number
) {
  const key = buildKey(type, categorySlug, page);
  const { data, error, isLoading, mutate } = useSWR(
    [key, type, categorySlug, page],
    ([_, t, c, p]) => fetcher(key, t, c, p),
    {
      revalidateOnFocus: true,
      dedupingInterval: 2000,
      keepPreviousData: true,
    }
  );

  return {
    pinned: data?.pinned ?? [],
    posts: data?.posts ?? [],
    totalPages: data?.totalPages ?? 1,
    count: data?.count ?? 0,
    isLoading,
    error,
    mutate,
  };
}
