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
 } from "lucide-react";
 import Link from "next/link";
 import { useRouter } from "next/navigation";
 import { useEffect, useState } from "react";

 const API_BASE = "http://localhost:8000";

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
   bio: string;
   major: string;
   profile_image: string | null;
   created_at: string;
 }

 interface MyPost {
   id: number;
   title: string;
   like_count: number;
   comment_count: number;
   created_at: string;
   // 선택적으로 추가될 수 있는 필드들 (현재 백엔드에는 없을 수 있음)
   view_count?: number;
   category_name?: string;
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
     : user.admission_year
     ? `${2000 + user.admission_year}년도`
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
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState("");

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

   const postsCount = posts.length;
  const commentsCount = comments.length;

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
     <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 py-12">
       <div className="max-w-4xl mx-auto px-4">
         {/* Tab Navigation */}
         <div className="flex gap-3 justify-center mb-10 flex-wrap">
           <button
             onClick={() => setActiveTab("profile")}
             className={`px-6 py-3 rounded-full text-sm font-bold transition-all ${
               activeTab === "profile"
                 ? "bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white shadow-lg"
                 : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
             }`}
           >
             프로필
           </button>
           <button
             onClick={() => setActiveTab("activity")}
             className={`px-6 py-3 rounded-full text-sm font-bold transition-all ${
               activeTab === "activity"
                 ? "bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white shadow-lg"
                 : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
             }`}
           >
             내 활동
           </button>
         </div>

         {/* Profile Tab */}
         {activeTab === "profile" && (
           <>
             {/* Profile Card */}
             <div className="bg-gradient-to-br from-[#2563EB] to-[#4f46e5] rounded-3xl p-8 mb-8 text-white relative shadow-lg">
               <Link
                 href="/profile/edit"
                 className="absolute top-6 right-6 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-sm font-bold hover:bg-white/30 transition-all flex items-center gap-2"
               >
                 <Edit className="w-4 h-4" />
                 프로필 수정
               </Link>

               <div className="flex items-start gap-6">
                 <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user.profile_image ? (
                    <img
                      src={`${user.profile_image}?t=${Date.now()}`}
                      alt="profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-4xl">👤</span>
                  )}
                 </div>
                 <div className="flex-1">
                   <h2 className="text-3xl font-bold mb-2">{user.name}</h2>
                   {summaryText && (
                     <p className="text-white/90 text-base font-semibold mb-6">
                       {summaryText}
                     </p>
                   )}

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3">
                       <Mail className="w-5 h-5" />
                       <span className="text-sm font-medium">{user.email}</span>
                     </div>
                     <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3">
                       <Calendar className="w-5 h-5" />
                       <span className="text-sm font-medium">
                         가입일 {joinDate}
                       </span>
                     </div>
                     <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-3">
                       <Users className="w-5 h-5" />
                       <span className="text-sm font-medium">
                         학번 {user.student_id ?? "-"}
                       </span>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             {/* 학력 & 자기소개 */}
            <div className="mt-4 space-y-4">
              {/* 학력 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <GraduationCap className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">학력</p>
                  <p className="text-base font-semibold text-gray-700 leading-relaxed">
                    국민대학교 {user.major || "AI빅데이터융합경영학과"}
                  </p>
                </div>
              </div>

              {/* 자기소개 */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-blue-100 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500 mb-1">자기소개</p>
                  {user.bio && user.bio.trim() ? (
                    <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line">
                      {user.bio}
                    </p>
                  ) : (
                    <p className="text-base text-gray-700 leading-relaxed whitespace-pre-line font-semibold">
                      아직 작성된 자기소개가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
           </>
         )}

        {/* Activity Tab */}
         {activeTab === "activity" && (
           <div className="space-y-8">
             {/* 내가 작성한 글 */}
             <div className="bg-white rounded-3xl p-8 shadow-sm">
               <h2 className="text-2xl font-bold mb-6">내가 작성한 글</h2>
               {posts.length === 0 ? (
                 <p className="text-sm text-gray-500">
                   아직 작성한 글이 없습니다.
                 </p>
               ) : (
                 <div className="space-y-4">
                   {posts.map((post) => {
                     const created = formatDate(post.created_at);
                     const category = post.category_name ?? "커뮤니티";
                     const views = post.view_count ?? 0;

                     return (
                       <Link
                          key={post.id}
                          href={`/community/${post.id}`}
                          className="block p-6 border-2 border-gray-200 rounded-2xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:border-[#2563EB] transition-all"
                        >
                         <div className="flex items-start justify-between mb-3">
                           <div>
                             <div className="inline-block px-4 py-1 bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 rounded-full text-xs font-bold mb-3">
                               {category}
                             </div>
                             <h3 className="text-lg font-bold mb-2">
                               {post.title}
                             </h3>
                             <div className="text-sm font-semibold text-gray-500">
                               {created}
                             </div>
                           </div>
                           <FileText className="w-6 h-6 text-gray-400" />
                         </div>
                         <div className="flex items-center gap-6 text-sm font-bold text-gray-500 mt-4 pt-4 border-t border-gray-200">
                           <span>조회 {views}</span>
                           <span>좋아요 {post.like_count}</span>
                           <span>댓글 {post.comment_count}</span>
                         </div>
                       </Link>
                     );
                   })}
                 </div>
               )}
             </div>

             {/* 내가 작성한 댓글 */}
             <div className="bg-white rounded-3xl p-8 shadow-sm">
               <h2 className="text-2xl font-bold mb-6">내가 작성한 댓글</h2>
               {comments.length === 0 ? (
                 <p className="text-sm text-gray-500">
                   아직 작성한 댓글이 없습니다.
                 </p>
               ) : (
                 <div className="space-y-4">
                   {comments.map((comment) => {
                     const created = formatDate(comment.created_at);
                     return (
                       <div
                         key={comment.id}
                         className="p-6 border-2 border-gray-200 rounded-2xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:border-[#2563EB] transition-all"
                       >
                         <div className="flex items-start justify-between mb-3">
                           <div className="flex-1">
                             <div className="flex items-center gap-2 mb-2">
                               <MessageCircle className="w-4 h-4 text-indigo-600" />
                               <span className="text-sm font-semibold text-gray-600">
                                 "{comment.post_title}" 글에 댓글
                               </span>
                             </div>
                             <p className="text-base text-gray-800 leading-relaxed mb-2">
                               {comment.content}
                             </p>
                             <div className="text-sm font-semibold text-gray-500">
                               {created}
                             </div>
                           </div>
                           <MessageCircle className="w-6 h-6 text-gray-400 flex-shrink-0" />
                         </div>
                         <div className="flex items-center gap-4 text-sm font-bold text-gray-500 mt-4 pt-4 border-t border-gray-200">
                           <span>좋아요 {comment.like_count}</span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
           </div>
        )}
       </div>
     </div>
   );
 }

