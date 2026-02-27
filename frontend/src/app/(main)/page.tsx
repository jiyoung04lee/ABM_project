"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Award,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

export default function HomeView() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    setIsLoggedIn(!!token);
  }, []);

  // TODO: 추후 네트워크 게시판 API로 대체
  const latestNetworkPosts = [
    { id: 0, tab: "graduate", title: "네이버 데이터 분석가로 입사한 후기", author: "박지훈", category: "취업", date: "2026.02.03" },
    { id: 1, tab: "current", title: "일본 교환학생 후기", author: "김서연", category: "국제교류", date: "2026.02.01" },
  ];

  // TODO: 추후 커뮤니티 게시판 API로 대체
  const latestCommunityPosts = [
    { id: 0, title: "네이버 AI 직제로도 입사한 후기", author: "박지훈", category: "취업", date: "2026.03.21" },
    { id: 1, title: "빅데이터 대학원 후기", author: "김서연", category: "대학원", date: "2026.03.23" },
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 relative overflow-hidden">
      {/* Decorative Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />

      {/* Hero Section */}
      <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm">
          ✨ AI빅데이터융합경영학과 학생들을 위한
        </div>

        <div className="relative mb-6">
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-gray-900">
            AI빅데이터융합경영학과 학생들을 위한
            <br />
            <span className="text-[#2563EB]">정보 아카이브</span>
          </h1>
        </div>

        <p className="text-gray-700 text-lg mb-3 leading-relaxed">
          선배와 동료의 경험을 모아 더 나은 선택을 돕는 공간
        </p>
        <p className="text-gray-600 mb-10 leading-relaxed">
          경험담부터, 취업에서 그룹 졸업된 나의 팁과,
          <br />
          수업, 공모, 수상 경험을 한곳에 모았습니다.
        </p>

        {!isLoggedIn ? (
          <Link
            href="/register"
            className="inline-block px-8 py-4 bg-[#2563EB] text-white rounded-full hover:bg-[#1d4ed8] transition-colors font-medium text-lg shadow-lg"
          >
            지금 시작하기
          </Link>
        ) : (
          <Link
            href="/network"
            className="inline-block px-8 py-4 bg-[#2563EB] text-white rounded-full hover:bg-[#1d4ed8] transition-colors font-medium text-lg shadow-lg"
          >
            지금 시작하기
          </Link>
        )}

        {/* Icon Grid */}
        <div className="flex justify-center gap-6 mt-14">
          <div className="w-16 h-16 bg-blue-300 rounded-2xl flex items-center justify-center shadow-md">
            <BookOpen className="w-8 h-8 text-blue-900" />
          </div>
          <div className="w-16 h-16 bg-indigo-300 rounded-2xl flex items-center justify-center shadow-md">
            <GraduationCap className="w-8 h-8 text-indigo-900" />
          </div>
          <div className="w-16 h-16 bg-blue-400 rounded-2xl flex items-center justify-center shadow-md">
            <Award className="w-8 h-8 text-blue-900" />
          </div>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-16">

        {/* 로그인 시에만 표시 */}
        {isLoggedIn && (
          <div className="grid grid-cols-2 gap-6 mb-20">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                  최신 네트워크 글
                </h2>
                <Link href="/network" className="text-sm text-[#2563EB] hover:underline">더보기 →</Link>
              </div>
              <div className="space-y-3">
                {latestNetworkPosts.map((post, index) => (
                  <Link key={index} href={`/network/${post.tab}/${post.id}`} className="block p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="text-sm font-semibold text-gray-900 mb-1">{post.title}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span>{post.author}</span><span>·</span>
                      <span>{post.category}</span><span>·</span>
                      <span>{post.date}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                  최신 커뮤니티 글
                </h2>
                <Link href="/community" className="text-sm text-[#2563EB] hover:underline">더보기 →</Link>
              </div>
              <div className="space-y-3">
                {latestCommunityPosts.map((post, index) => (
                  <Link key={index} href={`/community/${post.id}`} className="block p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="text-sm font-semibold text-gray-900 mb-1">{post.title}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span>{post.author}</span><span>·</span>
                      <span>{post.category}</span><span>·</span>
                      <span>{post.date}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Feature Section */}
        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm">
            ✨ 핵심 기능
          </div>
          <h2 className="text-3xl font-bold mb-3 text-gray-900">이런 정보를 찾을 수 있어요</h2>
          <p className="text-gray-600">학과 경험을 체계화 하여 성공적인 길을 찾아요</p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-20">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-5">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">네트워크</h3>
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">재학생과 졸업생의 취업, 진로, 대학원 경험담을 공유하고 궁금한 점을 물어보세요</p>
            <Link href="/network" className="text-[#2563EB] text-sm font-medium">자세히 보기 →</Link>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-5">
              <Award className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">커뮤니티</h3>
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">일상 이야기, 학습 팁, 프로젝트 아이디어를 자유롭게 공유하는 소통 공간</p>
            <Link href="/community" className="text-[#2563EB] text-sm font-medium">자세히 보기 →</Link>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-blue-700 rounded-2xl flex items-center justify-center mb-5">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">학과 정보 모음</h3>
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">우리 학과에 대한 모든 정보를 한곳에서 확인하세요</p>
            <Link href="/about" className="text-[#2563EB] text-sm font-medium">자세히 보기 →</Link>
          </div>
        </div>

        {/* CTA Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#2563EB] to-[#4f46e5] rounded-3xl p-12 text-center text-white">
          <div className="relative z-10">
            <h2 className="text-4xl font-bold mb-4">지금 바로 시작해보세요</h2>
            <p className="mb-10 opacity-90 text-lg leading-relaxed">
              선배들의 경험을 들으면서 노하우를 얻고
              <br />더 나은 미래를 준비할 수 있습니다.
            </p>
            <div className="flex gap-4 justify-center">
              {!isLoggedIn ? (
                <>
                  <Link href="/register" className="px-8 py-4 bg-white text-[#2563EB] rounded-full hover:bg-gray-50 transition-colors font-bold shadow-lg">회원가입</Link>
                  <Link href="/network" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full hover:bg-white/10 transition-colors font-bold">둘러보기</Link>
                </>
              ) : (
                <>
                  <Link href="/network/create" className="px-8 py-4 bg-white text-[#2563EB] rounded-full hover:bg-gray-50 transition-colors font-bold shadow-lg">글 작성하기</Link>
                  <Link href="/community" className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full hover:bg-white/10 transition-colors font-bold">커뮤니티 가기</Link>
                </>
              )}
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full -ml-32 -mb-32" />
        </div>
      </div>
    </div>
  );
}
