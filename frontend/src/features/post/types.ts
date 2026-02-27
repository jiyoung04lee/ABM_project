export interface Post {
  id: number;
  title: string;
  content?: string;
  author_name: string | null;
  author_id: number | null;
  is_pinned: boolean;
  is_anonymous: boolean;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  created_at: string;
  thumbnail?: string | null;
  category: string;
}