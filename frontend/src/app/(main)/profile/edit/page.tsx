 "use client";

import { Save, X, Upload } from "lucide-react";
 import { useRouter } from "next/navigation";
 import { useEffect, useState } from "react";
import{ API_BASE } from "@/shared/api/api";

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
 }

 interface ProfileForm {
   name: string;
   nickname: string;
   email: string;
  major: string;
   grade: string;
   student_id: string;
   admission_year: string;
   bio: string;
 }

 function toAdmissionYearDisplay(admissionYear: number | null) {
   if (admissionYear == null) return "";
   return String(admissionYear);
 }

 function toAdmissionYearValue(display: string) {
   if (!display) return null;
   const year = Number(display);
   if (!Number.isFinite(year)) return null;
   return year;
 }

 export default function ProfileEditPage() {
   const router = useRouter();
   const [user, setUser] = useState<UserMeResponse | null>(null);
   const [form, setForm] = useState<ProfileForm | null>(null);
   const [profileImage, setProfileImage] = useState<string | null>(null);
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [error, setError] = useState("");
   const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
   const [imageFile, setImageFile] = useState<File | null>(null);

   useEffect(() => {
     const token =
       typeof window !== "undefined"
         ? window.localStorage.getItem("access_token")
         : null;

     if (!token) {
       router.push("/login");
       return;
     }

     const fetchMe = async () => {
       try {
         setLoading(true);
         setError("");

         const res = await fetch(`${API_BASE}/api/users/me/`, {
           headers: {
             Authorization: `Bearer ${token}`,
           },
         });

         if (res.status === 401) {
           router.push("/login");
           return;
         }

         const data: UserMeResponse = await res.json();
         setUser(data);

         if (data.profile_image) {
          setProfileImage(`${API_BASE}${data.profile_image}`);
        }

         const initial: ProfileForm = {
           name: data.name,
           nickname: data.nickname,
           email: data.email ?? "",
           major: data.department ?? "AI빅데이터융합경영학과",
           grade: data.grade != null ? String(data.grade) : "",
           student_id: data.student_id ?? "",
           admission_year: toAdmissionYearDisplay(data.admission_year),
           bio: data.bio ?? "",
         };

         setForm(initial);
       } catch {
         setError("프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
       } finally {
         setLoading(false);
       }
     };

     fetchMe();
   }, [router]);

  const handleChange = (
     e:
       | React.ChangeEvent<HTMLInputElement>
       | React.ChangeEvent<HTMLSelectElement>
       | React.ChangeEvent<HTMLTextAreaElement>,
   ) => {
     const { name, value } = e.target;
     setForm((prev) => (prev ? { ...prev, [name]: value } : prev));
     setFieldErrors((prev) => ({ ...prev, [name]: "" }));
     setError("");
   };

  const applyImageFile = (file: File) => {
    setImageFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    applyImageFile(file);
  };

   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!form || !user) return;

     const token =
       typeof window !== "undefined"
         ? window.localStorage.getItem("access_token")
         : null;

     if (!token) {
       router.push("/login");
       return;
     }

     try {
       setSaving(true);
       setError("");
       setFieldErrors({});

      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("nickname", form.nickname);
      formData.append("bio", form.bio);
      formData.append("major", form.major || "AI빅데이터융합경영학과");

      if (imageFile) {
        formData.append("profile_image", imageFile);
      }

      if (user.user_type === "student") {
        if (form.grade) {
          formData.append("grade", form.grade);
        }
        if (form.student_id) {
          formData.append("student_id", form.student_id);
        }
      } else if (user.user_type === "graduate") {
        const admissionValue = toAdmissionYearValue(form.admission_year);
        if (admissionValue != null) {
          formData.append("admission_year", String(admissionValue));
        }
      }

      const res = await fetch(`${API_BASE}/api/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

       const data = await res.json();

       if (!res.ok) {
         if (typeof data === "object" && data) {
           const fe: Record<string, string> = {};
           Object.entries(data as Record<string, unknown>).forEach(
             ([key, value]) => {
               if (Array.isArray(value) && value.length > 0) {
                 fe[key] = String(value[0]);
               }
             },
           );
           if (Object.keys(fe).length > 0) {
             setFieldErrors(fe);
           } else {
             setError(
               data.detail ||
                 data.message ||
                 "프로필 수정에 실패했습니다. 다시 시도해주세요.",
             );
           }
         } else {
           setError("프로필 수정에 실패했습니다. 다시 시도해주세요.");
         }
         return;
       }

       router.push("/profile");
     } catch {
       setError("서버와 통신 중 오류가 발생했습니다.");
     } finally {
       setSaving(false);
     }
   };

   const handleCancel = () => {
     router.push("/profile");
   };

   if (loading || !form || !user) {
     return (
       <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 flex items-center justify-center">
         <div className="bg-white rounded-3xl px-10 py-8 shadow-lg">
           <p className="text-gray-700 font-semibold">프로필을 불러오는 중입니다...</p>
         </div>
       </div>
     );
   }

   const isStudent = user.user_type === "student";

   return (
     <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 py-12">
       <div className="max-w-3xl mx-auto px-4">
         {/* Header */}
         <div className="mb-8">
           <h1 className="text-4xl font-bold text-gray-900">프로필 수정</h1>
         </div>

         {/* Form */}
         <form
           onSubmit={handleSubmit}
           className="bg-white rounded-3xl p-8 shadow-sm"
         >
           {/* Profile Image */}
           <div className="mb-8 text-center">
             <div className="inline-block relative">
               <div
                 className="w-32 h-32 bg-gradient-to-br from-blue-300 to-indigo-300 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden"
                 onDragOver={(e) => {
                   e.preventDefault();
                 }}
                 onDrop={(e) => {
                   e.preventDefault();
                   const file = e.dataTransfer.files?.[0];
                   if (file) {
                     applyImageFile(file);
                     e.dataTransfer.clearData();
                   }
                 }}
               >
                 {profileImage ? (
                  <img
                    src={
                      profileImage?.startsWith("data:")
                        ? profileImage
                        : `${profileImage}?t=${Date.now()}`
                    }
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                 ) : (
                   <span className="text-5xl">👤</span>
                 )}
               </div>
               <label
                 htmlFor="profile-image"
                 className="absolute bottom-4 right-0 w-10 h-10 bg-gradient-to-r from-[#2563EB] to-[#4f46e5] rounded-xl flex items-center justify-center cursor-pointer hover:shadow-lg transition-all"
               >
                 <Upload className="w-5 h-5 text-white" />
                 <input
                   type="file"
                   id="profile-image"
                   accept="image/*"
                   className="hidden"
                   onChange={handleImageUpload}
                 />
               </label>
             </div>
             <p className="text-sm font-semibold text-gray-500 mt-2">
               프로필 사진 변경 (현재는 로컬 미리보기만 지원)
             </p>
           </div>

           {/* Global error */}
           {error && (
             <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
               {error}
             </div>
           )}

           {/* Form Fields */}
           <div className="space-y-6">
             {/* Name */}
             <div>
               <label
                 htmlFor="name"
                 className="block text-sm font-bold text-gray-900 mb-2"
               >
                 이름 *
               </label>
               <input
                 type="text"
                 id="name"
                 name="name"
                 value={form.name}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold text-gray-900"
                 required
               />
               {fieldErrors.name && (
                 <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>
               )}
             </div>

             {/* Nickname */}
             <div>
               <label
                 htmlFor="nickname"
                 className="block text-sm font-bold text-gray-900 mb-2"
               >
                 닉네임 *
               </label>
               <input
                 type="text"
                 id="nickname"
                 name="nickname"
                 value={form.nickname}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold text-gray-900"
                 required
               />
               {fieldErrors.nickname && (
                 <p className="text-xs text-red-500 mt-1">
                   {fieldErrors.nickname}
                 </p>
               )}
             </div>

             {/* Email (readonly) */}
             <div>
               <label
                 htmlFor="email"
                 className="block text-sm font-bold text-gray-900 mb-2"
               >
                 이메일
               </label>
               <input
                 type="email"
                 id="email"
                 name="email"
                 value={form.email}
                 disabled
                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-900 font-semibold cursor-not-allowed"
               />
             </div>

             {/* 전공 */}
             <div>
               <label
                 htmlFor="major"
                 className="block text-sm font-bold text-gray-900 mb-2"
               >
                 전공 *
               </label>
               <input
                 type="text"
                 id="major"
                 name="major"
                 value={form.major}
                 onChange={handleChange}
                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold text-gray-900"
                 required
               />
               {(fieldErrors.major ?? fieldErrors.department) && (
                 <p className="text-xs text-red-500 mt-1">
                   {fieldErrors.major ?? fieldErrors.department}
                 </p>
               )}
             </div>

             {/* 재학생 전용: 학년 + 학번 */}
             {isStudent && (
               <div className="space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                     <label
                       htmlFor="grade"
                       className="block text-sm font-bold text-gray-900 mb-2"
                     >
                       학년 *
                     </label>
                     <select
                       id="grade"
                       name="grade"
                       value={form.grade}
                       onChange={handleChange}
                       className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold text-gray-900"
                       required
                     >
                       <option value="">선택하세요</option>
                       <option value="1">1학년</option>
                       <option value="2">2학년</option>
                       <option value="3">3학년</option>
                       <option value="4">4학년</option>
                     </select>
                     {fieldErrors.grade && (
                       <p className="text-xs text-red-500 mt-1">
                         {fieldErrors.grade}
                       </p>
                     )}
                   </div>

                   <div>
                     <label
                       htmlFor="student_id"
                       className="block text-sm font-bold text-gray-900 mb-2"
                     >
                       학번
                     </label>
                     <input
                       type="text"
                       id="student_id"
                       name="student_id"
                       value={form.student_id}
                       onChange={handleChange}
                       maxLength={8}
                       className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold text-gray-900"
                       placeholder="예: 20222882"
                     />
                     {fieldErrors.student_id && (
                       <p className="text-xs text-red-500 mt-1">
                         {fieldErrors.student_id}
                       </p>
                     )}
                   </div>
                 </div>
               </div>
             )}

             {/* 졸업생 전용: 입학년도 */}
             {!isStudent && (
               <div>
                 <label
                   htmlFor="admission_year"
                   className="block text-sm font-bold text-gray-900 mb-2"
                 >
                   입학년도 *
                 </label>
                 <select
                   id="admission_year"
                   name="admission_year"
                   value={form.admission_year}
                   onChange={handleChange}
                   className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold text-gray-900"
                   required
                 >
                   <option value="">선택하세요</option>
                   {Array.from({ length: 13 }, (_, i) => 2013 + i).map(
                     (year) => (
                       <option key={year} value={year}>
                         {year}년
                       </option>
                     ),
                   )}
                 </select>
                 {fieldErrors.admission_year && (
                   <p className="text-xs text-red-500 mt-1">
                     {fieldErrors.admission_year}
                   </p>
                 )}
               </div>
             )}

             {/* Bio */}
             <div>
               <label
                 htmlFor="bio"
                 className="block text-sm font-bold text-gray-900 mb-2"
               >
                 자기소개
               </label>
               <textarea
                 id="bio"
                 name="bio"
                 value={form.bio}
                 onChange={handleChange}
                 rows={4}
                 className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#2563EB] transition-all font-semibold resize-none text-gray-900"
                 placeholder="자신을 소개해주세요"
               />
               {fieldErrors.bio && (
                 <p className="text-xs text-red-500 mt-1">{fieldErrors.bio}</p>
               )}
             </div>
           </div>

           {/* Action Buttons */}
           <div className="flex gap-4 mt-8">
             <button
               type="submit"
               disabled={saving}
               className="flex-1 px-6 py-4 bg-gradient-to-r from-[#2563EB] to-[#4f46e5] text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
             >
               <Save className="w-5 h-5" />
               {saving ? "저장 중..." : "저장하기"}
             </button>
             <button
               type="button"
               onClick={handleCancel}
               className="px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
             >
               <X className="w-5 h-5" />
               취소
             </button>
           </div>
         </form>
       </div>
     </div>
   );
 }

