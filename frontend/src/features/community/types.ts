export interface CommunityPost {
  id: number;
  title: string;
  author_name: string;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  created_at: string;
  thumbnail?: string | null;
}