export interface Post {
  id: number;
  title: string;
  content?: string;
  content_preview?: string;
  author_id?: number | null;
  author_name?: string | null;
  author_profile_image?: string | null; 
  is_pinned: boolean;
  is_anonymous: boolean;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  created_at: string;
  thumbnail?: string | null;
  category: string;
}

export interface PostDetail {
  id: number;
  title: string;
  content: string;
  author_id?: number | null;
  author_name: string | null;
  author_profile_image?: string | null; 
  is_anonymous: boolean;
  like_count: number;
  is_liked: boolean;
  category?: string;
  category_name?: string;
  comment_count: number;
  comments: Comment[];
  thumbnail?: string | null;
  attachments?: {
    file: string;
    type: "image" | "pdf";
  }[];
  created_at: string;
  is_pinned?: boolean;
}

export interface Comment {
  id: number;
  author_id: number | null;
  author_name: string;
  author_profile_image?: string | null; 
  content: string;
  created_at: string;
  like_count: number;
  is_liked: boolean;
  parent: number | null;
  replies: Comment[];
  is_anonymous?: boolean;
}