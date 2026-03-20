"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Users,
  MessageCircle,
  GraduationCap,
  TrendingUp,
  Menu,
  ArrowRight,
} from "lucide-react";
import { fetchPosts, PostListItem } from "@/shared/api/network";
import { getPosts as getCommunityPosts } from "@/shared/api/community";

type HomePost = {
  id: number;
  title: string;
  author: string;
  category?: string | null;
  date: string;
};

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  return iso.slice(0, 10).replace(/-/g, ".");
};

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const update = (matches: boolean) => {
      setIsMobile(matches);
    };

    update(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      update(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

function SectionCard({
  title,
  href,
  posts,
  emptyText,
}: {
  title: string;
  href: string;
  posts: HomePost[];
  emptyText: string;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-[#2563EB]" />
          {title}
        </h2>
        <Link
          href={href}
          className="flex items-center gap-1 text-sm font-medium text-[#2563EB]"
        >
          더보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {posts.length > 0 ? (
          posts.map((post) => (
            <Link
              key={post.id}
              href={href === "/network" ? `/network/${post.id}` : `/community/${post.id}`}
              className="block rounded-xl border border-slate-100 px-3 py-3 transition hover:bg-slate-50"
            >
              <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                {post.title}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {post.author}
                {post.category ? ` · ${post.category}` : ""}
                {post.date ? ` · ${post.date}` : ""}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function MobileHomeView({
  isLoggedIn,
  latestNetworkPosts,
  latestCommunityPosts,
}: {
  isLoggedIn: boolean;
  latestNetworkPosts: HomePost[];
  latestCommunityPosts: HomePost[];
}) {
  return (
    <div className="min-h-screen bg-slate-50 md:hidden">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-md items-center justify-between px-4">
          <Link href="/" className="text-base font-bold tracking-tight text-slate-900">
            AIVE
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
            aria-label="메뉴"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-4">
        <section className="mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 px-5 py-6 text-white shadow-sm">
          <p className="mb-2 text-xs font-medium text-blue-100">
            AI빅데이터융합경영학과 학생들을 위한
          </p>
          <h1 className="text-2xl font-bold leading-tight">
            정보 아카이브
          </h1>
          <p className="mt-3 text-sm leading-6 text-blue-50">
            선배와 동기의 경험을 모아 더 나은 선택을 돕는 공간.
            학교생활 이야기부터 수업, 공모전, 취업 준비, 수상 경험까지
            다양한 정보를 한곳에 모았어.
          </p>

          <div className="mt-5 flex gap-2">
            {!isLoggedIn ? (
              <Link
                href="/login"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700"
              >
                시작하기
              </Link>
            ) : (
              <Link
                href="/department"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700"
              >
                지금 시작하기
              </Link>
            )}
          </div>
        </section>

        <section className="mb-4 grid grid-cols-3 gap-3">
          <Link
            href="/department"
            className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100"
          >
            <BookOpen className="mx-auto mb-2 h-5 w-5 text-blue-600" />
            <span className="text-xs font-medium text-slate-700">학과정보</span>
          </Link>

          <Link
            href="/network"
            className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100"
          >
            <Users className="mx-auto mb-2 h-5 w-5 text-indigo-600" />
            <span className="text-xs font-medium text-slate-700">네트워크</span>
          </Link>

          <Link
            href="/community"
            className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100"
          >
            <MessageCircle className="mx-auto mb-2 h-5 w-5 text-sky-600" />
            <span className="text-xs font-medium text-slate-700">커뮤니티</span>
          </Link>
        </section>

        {isLoggedIn && (
          <div className="space-y-4">
            <SectionCard
              title="최신 네트워크 글"
              href="/network"
              posts={latestNetworkPosts}
              emptyText="아직 등록된 네트워크 글이 없습니다."
            />

            <SectionCard
              title="최신 커뮤니티 글"
              href="/community"
              posts={latestCommunityPosts}
              emptyText="아직 등록된 커뮤니티 글이 없습니다."
            />
          </div>
        )}

        <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="mb-3 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-slate-900">
              이런 정보를 찾을 수 있어요
            </h2>
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <Link href="/department" className="block rounded-xl bg-slate-50 px-3 py-3">
              학과 소개, 교육과정, 학회 정보
            </Link>
            <Link href="/network" className="block rounded-xl bg-slate-50 px-3 py-3">
              취업, 진로, 대외활동, 교환학생 후기
            </Link>
            <Link href="/community" className="block rounded-xl bg-slate-50 px-3 py-3">
              일상 이야기, 학습 팁, 프로젝트 소통
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function DesktopHomeView({
  isLoggedIn,
  latestNetworkPosts,
  latestCommunityPosts,
}: {
  isLoggedIn: boolean;
  latestNetworkPosts: HomePost[];
  latestCommunityPosts: HomePost[];
}) {
  return (
    <div className="-mt-40 min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />
      <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30" />

      <div className="relative max-w-5xl mx-auto px-4 pt-40 pb-16 text-center">
        <div className="inline-block mb-6 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm">
          ✨ AI빅데이터융합경영학과 학생들을 위한
        </div>

        <div className="relative mb-6 flex items-center justify-center gap-3 md:gap-4">
          <div className="penguin-bounce shrink-0 -mt-10">
            <img
              src="/penguin.png"
              alt=""
              className="w-20 h-20 md:w-24 md:h-24 object-contain pointer-events-none"
            />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight text-gray-900 text-center shrink-0">
            <span className="whitespace-nowrap">AI빅데이터융합경영학과 학생들을 위한</span>
            <br />
            <span className="text-[#2563EB] whitespace-nowrap">정보 아카이브</span>
          </h1>
          <div className="penguin-bounce shrink-0 -mt-10">
            <img
              src="/penguin.png"
              alt=""
              className="w-20 h-20 md:w-24 md:h-24 object-contain pointer-events-none -scale-x-100"
            />
          </div>
        </div>

        <p className="text-gray-700 text-lg mb-3 leading-relaxed">
          선배와 동기의 경험을 모아 더 나은 선택을 돕는 공간
        </p>
        <p className="text-gray-600 mb-10 leading-relaxed">
          학교생활 이야기부터 수업, 공모전, 취업 준비, 수상 경험까지
          <br />
          AI빅데이터융합경영학과의 다양한 정보를 한곳에 모았습니다.
        </p>

        {!isLoggedIn ? (
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-[#2B7FFF] text-white rounded-full hover:bg-[#1d4ed8] transition-colors font-medium text-lg shadow-lg"
          >
            시작하기
          </Link>
        ) : (
          <Link
            href="/department"
            className="inline-block px-8 py-4 bg-[#2B7FFF] text-white rounded-full hover:bg-[#1d4ed8] transition-colors font-medium text-lg shadow-lg"
          >
            지금 시작하기
          </Link>
        )}

        <div className="flex justify-center gap-6 mt-14">
          <div className="w-16 h-16 bg-blue-300 rounded-2xl flex items-center justify-center shadow-md">
            <BookOpen className="w-8 h-8 text-blue-900" />
          </div>
          <div className="w-16 h-16 bg-indigo-300 rounded-2xl flex items-center justify-center shadow-md">
            <Users className="w-8 h-8 text-indigo-900" />
          </div>
          <div className="w-16 h-16 bg-blue-400 rounded-2xl flex items-center justify-center shadow-md">
            <MessageCircle className="w-8 h-8 text-blue-900" />
          </div>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-16">
        {isLoggedIn && (
          <div className="grid grid-cols-2 gap-6 mb-20">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                  최신 네트워크 글
                </h2>
                <Link href="/network" className="text-sm text-[#2563EB] hover:underline">
                  더보기 →
                </Link>
              </div>
              <div className="space-y-3">
                {latestNetworkPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/network/${post.id}`}
                    className="block p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      {post.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span>{post.author}</span>
                      {post.category && (
                        <>
                          <span>·</span>
                          <span>{post.category}</span>
                        </>
                      )}
                      {post.date && (
                        <>
                          <span>·</span>
                          <span>{post.date}</span>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
                {latestNetworkPosts.length === 0 && (
                  <p className="text-sm text-gray-500">
                    아직 등록된 네트워크 글이 없습니다.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                  최신 커뮤니티 글
                </h2>
                <Link href="/community" className="text-sm text-[#2563EB] hover:underline">
                  더보기 →
                </Link>
              </div>
              <div className="space-y-3">
                {latestCommunityPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/community/${post.id}`}
                    className="block p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      {post.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-700">
                      <span>{post.author}</span>
                      {post.date && (
                        <>
                          <span>·</span>
                          <span>{post.date}</span>
                        </>
                      )}
                    </div>
                  </Link>
                ))}
                {latestCommunityPosts.length === 0 && (
                  <p className="text-sm text-gray-500">
                    아직 등록된 커뮤니티 글이 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <div className="inline-block mb-4 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-full text-sm">
            ✨ 핵심 기능
          </div>
          <h2 className="text-3xl font-bold mb-3 text-gray-900">
            이런 정보를 찾을 수 있어요
          </h2>
          <p className="text-gray-600">
            세 가지 핵심 영역(학과정보 · 네트워크 · 커뮤니티)에서 필요한 정보를 찾아보세요
          </p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-20">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-blue-700 rounded-2xl flex items-center justify-center mb-5">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">학과 정보 모음</h3>
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">
              우리 학과에 대한 모든 정보를 한곳에서 확인하세요
            </p>
            <Link href="/department" className="text-[#2563EB] text-sm font-medium">
              자세히 보기 →
            </Link>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-5">
              <Users className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">네트워크</h3>
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">
              재학생과 졸업생의 취업, 진로, 대학원 경험담을 공유하고 궁금한 점을 물어보세요
            </p>
            <Link href="/network" className="text-[#2563EB] text-sm font-medium">
              자세히 보기 →
            </Link>
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-8 shadow-sm hover:shadow-lg transition-all">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-5">
              <MessageCircle className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">커뮤니티</h3>
            <p className="text-gray-700 text-sm mb-5 leading-relaxed">
              일상 이야기, 학습 팁, 프로젝트 아이디어를 자유롭게 공유하는 소통 공간
            </p>
            <Link href="/community" className="text-[#2563EB] text-sm font-medium">
              자세히 보기 →
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-r from-[#2563EB] to-[#4f46e5] rounded-3xl p-12 text-center text-white">
          <div className="relative z-10">
            <h2 className="text-4xl font-bold mb-4">지금 바로 시작해보세요</h2>
            <p className="mb-10 opacity-90 text-lg leading-relaxed">
              선배들의 경험을 들으면서 노하우를 얻고
              <br />
              더 나은 미래를 준비할 수 있습니다.
            </p>
            <div className="flex gap-4 justify-center">
              {!isLoggedIn ? (
                <>
                  <Link
                    href="/register"
                    className="px-8 py-4 bg-white text-[#2563EB] rounded-full hover:bg-gray-50 transition-colors font-bold shadow-lg"
                  >
                    회원가입
                  </Link>
                  <Link
                    href="/department"
                    className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full hover:bg-white/10 transition-colors font-bold"
                  >
                    둘러보기
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/network"
                    className="px-8 py-4 bg-white text-[#2563EB] rounded-full hover:bg-gray-50 transition-colors font-bold shadow-lg"
                  >
                    네트워크 가기
                  </Link>
                  <Link
                    href="/community"
                    className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full hover:bg-white/10 transition-colors font-bold"
                  >
                    커뮤니티 가기
                  </Link>
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

export default function HomeView() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [latestNetworkPosts, setLatestNetworkPosts] = useState<HomePost[]>([]);
  const [latestCommunityPosts, setLatestCommunityPosts] = useState<HomePost[]>([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setLatestNetworkPosts([]);
      setLatestCommunityPosts([]);
      return;
    }

    Promise.allSettled([
      fetchPosts({ type: "student", page: 1 }),
      getCommunityPosts({ ordering: "latest" }),
    ]).then(([networkResult, communityResult]) => {
      if (networkResult.status === "fulfilled") {
        const networkRes = networkResult.value;
        const networkList: PostListItem[] = [];
        if (networkRes.pinned?.length) networkList.push(...networkRes.pinned);
        if (networkRes.posts) networkList.push(...networkRes.posts);

        setLatestNetworkPosts(
          networkList.slice(0, 2).map((p) => ({
            id: p.id,
            title: p.title,
            author: p.author_name,
            category: p.category_name,
            date: formatDate(p.created_at),
          }))
        );
      } else {
        setLatestNetworkPosts([]);
      }

      if (communityResult.status === "fulfilled") {
        const { data } = communityResult.value;
        const payload = (data as any).results ?? data;
        const list: any[] = [];
        const rawPinned = payload.pinned;
        if (Array.isArray(rawPinned)) list.push(...rawPinned);
        else if (rawPinned) list.push(rawPinned);
        if (Array.isArray(payload.posts)) list.push(...payload.posts);

        setLatestCommunityPosts(
          list.slice(0, 2).map((p: any) => ({
            id: p.id,
            title: p.title,
            author: p.author_name,
            category: null,
            date: formatDate(p.created_at),
          }))
        );
      } else {
        setLatestCommunityPosts([]);
      }
    });
  }, [isLoggedIn]);

  if (isMobile) {
    return (
      <MobileHomeView
        isLoggedIn={isLoggedIn}
        latestNetworkPosts={latestNetworkPosts}
        latestCommunityPosts={latestCommunityPosts}
      />
    );
  }

  return (
    <DesktopHomeView
      isLoggedIn={isLoggedIn}
      latestNetworkPosts={latestNetworkPosts}
      latestCommunityPosts={latestCommunityPosts}
    />
  );
}