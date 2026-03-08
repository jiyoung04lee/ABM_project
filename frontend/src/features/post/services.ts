import { Post } from "./types";

const USE_MOCK = true;

const mockPosts: Post[] = [
  {
    id: 1,
    title: "네이버 AI 공모전 합격 후기",
    author_name: "김서연",
    author_id: 3,
    is_pinned: false,
    is_anonymous: false,
    like_count: 12,
    is_liked: false,
    comment_count: 4,
    created_at: "2026-02-01",
    category: "공지",
  },
];

export const fetchPosts = async (): Promise<Post[]> => {
  if (USE_MOCK) {
    return mockPosts;
  }

  // 나중에 API 연결
  return [];
};