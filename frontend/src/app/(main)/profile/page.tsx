 "use client";

import {
  Mail,
  Calendar,
  BookOpen,
  MessageCircle,
  Users,
  Edit,
  FileText,
  GraduationCap,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import{ API_BASE } from "@/shared/api/api";
import { deletePost as deleteCommunityPost, deleteComment as deleteCommunityComment } from "@/shared/api/community";
import { deletePost as deleteNetworkPost, } from "@/shared/api/network";

 type UserType = "student" | "graduate";

 interface UserMeResponse {
   id: number;
   email: string;
   name: string;
   nickname: string;
   user_type: UserType;
   student_id: string | null;
   grade: number | null;
   admission_year: number | null;
   department: string | null;
   bio: string;
   major: string;
   profile_image: string | null;
   created_at: string;
   score: number;
   level: number;
   liked_count:number;
 }

 interface MyPost {
  id: number;
  title: string;
  like_count: number;
  comment_count: number;
  created_at: string;
  view_count?: number;
  category_name?: string;
  board_type?: "community" | "network" | null;
}

 interface MyComment {
   id: number;
   post_id: number;
   post_title: string;
   content: string;
   like_count: number;
   created_at: string;
}

type Tab = "profile" | "activity";

interface TopUser {
  id: number;
  nickname: string;
  profile_image: string | null;
  level: number;
}

function formatDate(dateString: string | null | undefined) {
   if (!dateString) return "-";
   const d = new Date(dateString);
   if (Number.isNaN(d.getTime())) return "-";
   const y = d.getFullYear();
   const m = String(d.getMonth() + 1).padStart(2, "0");
   const day = String(d.getDate()).padStart(2, "0");
   return `${y}.${m}.${day}`;
 }

function buildYearGradeStatus(user: UserMeResponse | null) {
   if (!user) return "";

   const isStudent = user.user_type === "student";

   const yearLabel = isStudent
     ? user.student_id
       ? `${user.student_id.slice(0, 4)}년도`
       : null
     : user.admission_year != null
     ? `${user.admission_year}년도`
     : null;

   const gradeLabel = user.grade ? `${user.grade}학년` : null;
   const statusLabel = isStudent ? "재학" : "졸업";

   return [yearLabel, gradeLabel, statusLabel].filter(Boolean).join(" · ");
 }

 export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [user, setUser] = useState<UserMeResponse | null>(null);
  const [posts, setPosts] = useState<MyPost[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activityTab, setActivityTab] = useState<"posts" | "comments">("posts");
  const ITEMS_PER_PAGE = 6;
  const [postsPage, setPostsPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);

   useEffect(() => {
     const token =
       typeof window !== "undefined"
         ? window.localStorage.getItem("access_token")
         : null;

     if (!token) {
       router.push("/login");
       return;
     }

     const fetchAll = async () => {
       setLoading(true);
       setError("");

       const headers = {
         Authorization: `Bearer ${token}`,
       };

       try {
         const meRes = await fetch(`${API_BASE}/api/users/me/`, { headers });

         if (meRes.status === 401) {
           router.push("/login");
           return;
         }

         if (!meRes.ok) {
           setError(
             "내 정보를 불러오지 못했습니다. 백엔드 서버(http://localhost:8000)가 실행 중인지 확인해주세요.",
           );
           return;
         }

         const contentType = meRes.headers.get("content-type");
         if (!contentType || !contentType.includes("application/json")) {
           setError(
             "서버 응답 형식 오류입니다. 백엔드 서버가 정상 동작 중인지 확인해주세요.",
           );
           return;
         }

         const meData: UserMeResponse = await meRes.json();
         setUser(meData);
       } catch {
         setError(
           "내 정보를 불러오지 못했습니다. 백엔드 서버(http://localhost:8000)가 실행 중인지 확인해주세요.",
         );
         return;
       } finally {
         setLoading(false);
       }

       try {
         const [postsRes, commentsRes] = await Promise.all([
           fetch(`${API_BASE}/api/users/me/posts/`, { headers }),
           fetch(`${API_BASE}/api/users/me/comments/`, { headers }),
         ]);

         const topRes = await fetch(`${API_BASE}/api/users/top-active/`);

         if (topRes.ok) {
           const topData = await topRes.json();
           setTopUsers(topData);
         }

         if (postsRes.ok) {
           const postsJson = await postsRes.json();
           const postsData: MyPost[] = Array.isArray(postsJson)
             ? postsJson
             : postsJson.results ?? [];
           setPosts(postsData);
         }

         if (commentsRes.ok) {
           const commentsJson = await commentsRes.json();
           const commentsData: MyComment[] = Array.isArray(commentsJson)
             ? commentsJson
             : commentsJson.results ?? [];
           setComments(commentsData);
         }
       } catch {
         // 글/댓글만 실패해도 프로필은 이미 보이므로 무시
       }
     };

     fetchAll();
   }, [router]);

  const handleProfileImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const token =
      typeof window !== "undefined"
        ? window.localStorage.getItem("access_token")
        : null;

    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append("profile_image", file);

      const res = await fetch(`${API_BASE}/api/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) return;

      const data: UserMeResponse = await res.json();
      setUser(data);
    } finally {
      setUploadingImage(false);
    }
  };

  const postsCount = posts.length;
  const commentsCount = comments.length;
  const likesCount = user?.liked_count ?? 0;
  const score = user?.score ?? 0;
  const level = user?.level ?? 1;
  const maxScore = 300;
  const scorePercent = (score / maxScore) * 100;
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercent(scorePercent);
    }, 200);

    return () => clearTimeout(timer);
  }, [scorePercent]);
  const handleDeleteMyPost = async (post: MyPost) => {
    if (!confirm("이 글을 삭제할까요?")) return;

    try {
      if (post.board_type === "network") {
        await deleteNetworkPost(post.id);
      } else {
        await deleteCommunityPost(post.id);
      }

      setPosts((prev) => {
        const next = prev.filter((p) => p.id !== post.id);
        return next;
      });
      setPostsPage((p) => (posts.length <= 1 ? 1 : Math.min(p, Math.ceil((posts.length - 1) / ITEMS_PER_PAGE) || 1)));
    } catch {
      alert("글 삭제에 실패했습니다.");
    }
  };
  const handleEditPost = (post: MyPost) => {
    if (post.board_type === "network") {
      router.push(`/network/edit/${post.id}`);
    } else {
      router.push(`/community/edit/${post.id}`);
    }
  };

  const handleDeleteMyComment = async (id: number) => {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    try {
      await deleteCommunityComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      setCommentsPage((p) => (comments.length <= 1 ? 1 : Math.min(p, Math.ceil((comments.length - 1) / ITEMS_PER_PAGE) || 1)));
    } catch {
      alert("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

   if (loading) {
     return (
       <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 flex items-center justify-center">
         <div className="bg-white rounded-3xl px-10 py-8 shadow-lg">
           <p className="text-gray-700 font-semibold">내 정보를 불러오는 중입니다...</p>
         </div>
       </div>
     );
   }

   if (error) {
     return (
       <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 flex items-center justify-center px-4">
         <div className="max-w-md">
           <div className="bg-white rounded-3xl p-10 shadow-lg text-center">
             <div className="w-20 h-20 bg-gradient-to-br from-blue-300 to-indigo-300 rounded-2xl flex items-center justify-center mx-auto mb-6">
               <Users className="w-10 h-10 text-indigo-800" />
             </div>
             <h2 className="text-2xl font-bold mb-4">오류가 발생했습니다</h2>
             <p className="text-gray-600 mb-6 text-sm">{error}</p>
             <button
               onClick={() => window.location.reload()}
               className="inline-block px-6 py-3 bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white rounded-xl hover:shadow-lg transition-all text-sm font-semibold"
             >
               새로고침
             </button>
           </div>
         </div>
       </div>
     );
   }

   if (!user) {
     // 토큰은 있지만 사용자 정보를 못 불러온 경우
     return null;
   }

   const summaryText = buildYearGradeStatus(user);
   const joinDate = formatDate(user.created_at);

   return (
      <div className="w-full pt-10 pb-12">
        <div className="max-w-6xl mx-auto px-4">

          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">

            {/* 왼쪽 사용자 정보 */}
            <div className="bg-white border border-gray-200 p-6 shadow-sm h-fit">

              <div className="flex flex-col items-center text-center">

                {/* 프로필 사진 */}
                <div className="w-24 h-24 rounded-lg overflow-hidden mb-4 bg-gray-100">
                  {user.profile_image ? (
                    <img
                      src={user.profile_image}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      👤
                    </div>
                  )}
                </div>

                {/* 이름 */}
                <h2 className="text-lg font-semibold">{user.name}</h2>

                {/* 학년 */}
                {summaryText && (
                  <p className="text-sm text-gray-500 mt-1">{summaryText}</p>
                )}

                {/* 닉네임 */}
                <p className="text-sm text-gray-600 mt-2 mb-6">
                  {user.nickname}
                </p>

              </div>

              {/* 프로필 수정 row */}
              <Link
                href="/profile/edit"
                className="flex items-center justify-between border-t pt-4 text-sm text-gray-700 hover:text-black"
              >
                <span>프로필 수정</span>
                <span className="text-lg">›</span>
              </Link>

            </div>

            {/* 활동 우수자 */}
            <div className="bg-white border border-gray-200 p-4 shadow-sm mt-4">

              <h3 className="text-sm font-semibold mb-3 text-gray-700">
                활동 우수자
              </h3>

              <div className="space-y-3">

                {topUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3">

                    <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">

                      {u.profile_image ? (
                        <img
                          src={u.profile_image}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src="/icons/userbaseimage.svg"
                          className="w-full h-full object-cover"
                        />
                      )}

                    </div>

                    <div className="text-sm font-semibold">
                      {u.nickname}
                    </div>

                  </div>
                ))}

              </div>

            </div>

            {/* 오른쪽 영역 */}
            <div className="space-y-6">

              {/* 지원현황 */}
              <div className="bg-white border border-gray-200 p-6 shadow-sm">

                <h3 className="text-lg font-bold mb-4">활동현황</h3>

                <div className="grid grid-cols-3 text-center">

                  <div className="py-4">
                    <p className="text-3xl font-bold">{postsCount}</p>
                    <p className="text-sm text-gray-500">작성 글</p>
                  </div>

                  <div className="py-4 border-l border-gray-200">
                    <p className="text-3xl font-bold">{commentsCount}</p>
                    <p className="text-sm text-gray-500">작성 댓글</p>
                  </div>

                  <div className="py-4 border-l border-gray-200">
                    <p className="text-3xl font-bold">{likesCount}</p>
                    <p className="text-sm text-gray-500">누른 좋아요</p>
                  </div>

                </div>

              </div>
  
              {/* 활동 점수 */}
              <div className="bg-white border border-gray-200 p-6 shadow-sm">

                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold">활동점수</h3>

                  <div className="text-sm font-semibold text-gray-600">
                    Lv.{level} · {score} / 300
                  </div>
                </div>

                <div className="w-full h-5 bg-gray-200 rounded-full overflow-hidden relative mb-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 transition-all duration-1000 ease-out shadow-md"
                    style={{ width: `${animatedPercent}%` }}
                  />
                </div>

                {/* 아이콘 라인 */}
                <div className="flex justify-between text-xs text-gray-400">

                  <div className="flex flex-col items-center">
                    <span>Lv1</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span>Lv5</span>
                  </div>

                  <div className="flex flex-col items-center">
                    <span>Lv10</span>
                  </div>

                </div>

              </div>


              {/* 글 / 댓글 탭 */}
              <div className="bg-white border border-gray-200 p-6 shadow-sm">
                <div className="flex border-b mb-6">
                  <button
                    onClick={() => setActivityTab("posts")}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 ${
                      activityTab === "posts"
                        ? "border-[#2563EB] text-[#2563EB]"
                        : "border-transparent text-gray-400"
                    }`}
                  >
                    내가 작성한 글
                  </button>

                  <button
                    onClick={() => setActivityTab("comments")}
                    className={`px-6 py-3 text-sm font-semibold border-b-2 ${
                      activityTab === "comments"
                        ? "border-[#2563EB] text-[#2563EB]"
                        : "border-transparent text-gray-400"
                    }`}
                  >
                    내가 작성한 댓글
                  </button>
                </div>

                {/* 내가 작성한 글 탭 내용 */}
                {activityTab === "posts" && (() => {
                  const totalPostsPages = Math.max(1, Math.ceil(posts.length / ITEMS_PER_PAGE));
                  const paginatedPosts = posts.slice((postsPage - 1) * ITEMS_PER_PAGE, postsPage * ITEMS_PER_PAGE);
                  return (
                    <div className="flex flex-col">
                      {/* 리스트 영역: max-h로 높이 제한 및 내부 스크롤 적용 */}
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {paginatedPosts.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">작성한 글이 없습니다.</p>
                        ) : (
                          paginatedPosts.map((post) => {
                            const created = formatDate(post.created_at);
                            const categoryLabel =
                              post.board_type === "network"
                                ? "네트워크"
                                : (post.category_name ?? "커뮤니티");
                            const views = post.view_count ?? 0;

                            return (
                              <div
                                key={`${post.board_type ?? "community"}-${post.id}`}
                                className="p-6 border-2 border-gray-200 rounded-2xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:border-[#2563EB] transition-all"
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="inline-block px-4 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 rounded-full text-xs font-bold mb-3">
                                      {categoryLabel}
                                    </div>
                                    <Link href={post.board_type === "network" ? `/network/${post.id}` : `/community/${post.id}`}>
                                      <h3 className="text-lg font-bold mb-2 hover:underline">{post.title}</h3>
                                    </Link>
                                    <div className="text-sm font-semibold text-gray-500">{created}</div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditPost(post)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 rounded-lg hover:bg-blue-50">
                                      <Edit className="w-4 h-4" /> 수정
                                    </button>
                                    <button onClick={() => handleDeleteMyPost(post)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 rounded-lg hover:bg-red-50">
                                      <Trash2 className="w-4 h-4" /> 삭제
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm font-bold text-gray-500 mt-4 pt-4 border-t border-gray-200">
                                  <span>조회 {views}</span>
                                  <span>좋아요 {post.like_count}</span>
                                  <span>댓글 {post.comment_count}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {/* 페이지네이션은 스크롤 영역 밖에 배치 */}
                      {totalPostsPages > 1 && (
                        <div className="mt-8 flex justify-center gap-2">
                          <button type="button" onClick={() => setPostsPage((p) => Math.max(1, p - 1))} disabled={postsPage === 1} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">이전</button>
                          {Array.from({ length: totalPostsPages }).map((_, idx) => (
                            <button key={idx} onClick={() => setPostsPage(idx + 1)} className={`min-w-[32px] px-2 py-1 rounded-lg text-sm border ${postsPage === idx + 1 ? "bg-[#2563EB] text-white" : "bg-white"}`}>{idx + 1}</button>
                          ))}
                          <button type="button" onClick={() => setPostsPage((p) => Math.min(totalPostsPages, p + 1))} disabled={postsPage === totalPostsPages} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">다음</button>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* 내가 작성한 댓글 탭 내용 */}
                {activityTab === "comments" && (() => {
                  const totalCommentsPages = Math.max(1, Math.ceil(comments.length / ITEMS_PER_PAGE));
                  const paginatedComments = comments.slice((commentsPage - 1) * ITEMS_PER_PAGE, commentsPage * ITEMS_PER_PAGE);
                  return (
                    <div className="flex flex-col">
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {paginatedComments.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">작성한 댓글이 없습니다.</p>
                        ) : (
                          paginatedComments.map((comment) => (
                            <div key={comment.id} className="p-6 border-2 border-gray-200 rounded-2xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:border-[#2563EB] transition-all">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageCircle className="w-4 h-4 text-indigo-600" />
                                    <span className="text-sm font-semibold text-gray-600">"{comment.post_title}" 글에 댓글</span>
                                  </div>
                                  <p className="text-base text-gray-800 leading-relaxed mb-2">{comment.content}</p>
                                  <div className="text-sm font-semibold text-gray-500">{formatDate(comment.created_at)}</div>
                                </div>
                                <button onClick={() => handleDeleteMyComment(comment.id)} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 rounded-lg hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" /> 삭제
                                </button>
                              </div>
                              <div className="flex items-center gap-4 text-sm font-bold text-gray-500 mt-4 pt-4 border-t border-gray-200">
                                <span>좋아요 {comment.like_count}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {totalCommentsPages > 1 && (
                        <div className="mt-8 flex justify-center gap-2">
                          <button type="button" onClick={() => setCommentsPage((p) => Math.max(1, p - 1))} disabled={commentsPage === 1} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">이전</button>
                          {Array.from({ length: totalCommentsPages }).map((_, idx) => (
                            <button key={idx} onClick={() => setCommentsPage(idx + 1)} className={`min-w-[32px] px-2 py-1 rounded-lg text-sm border ${commentsPage === idx + 1 ? "bg-[#2563EB] text-white" : "bg-white"}`}>{idx + 1}</button>
                          ))}
                          <button type="button" onClick={() => setCommentsPage((p) => Math.min(totalCommentsPages, p + 1))} disabled={commentsPage === totalCommentsPages} className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40">다음</button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

            </div>

          </div>

        </div>
      </div>
    );
 }

