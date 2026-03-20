"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Users,
  MessageCircle,
  GraduationCap,
  ArrowRight,
} from "lucide-react";
import MobileContainer from "@/features/mobile/layout/MobileContainer";
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
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <Link
          href={href}
          className="flex items-center gap-1 text-sm font-medium text-blue-600"
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
              <p className="line-clamp-2 text-sm font-medium text-slate-900">
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

export default function MobileHomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [latestNetworkPosts, setLatestNetworkPosts] = useState<HomePost[]>([]);
  const [latestCommunityPosts, setLatestCommunityPosts] = useState<HomePost[]>([]);

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

  return (
    <MobileContainer>
      <section className="mb-4 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 px-5 py-6 text-white shadow-sm">
        <p className="mb-2 text-xs font-medium text-blue-100">
          AI빅데이터융합경영학과 학생들을 위한
        </p>
        <h1 className="text-2xl font-bold leading-tight">
          정보 아카이브
        </h1>
        <p className="mt-3 text-sm leading-6 text-blue-50">
          학교생활 이야기부터 수업, 공모전, 취업 준비, 수상 경험까지
          AI빅데이터융합경영학과의 다양한 정보를 한곳에 모았습니다.
        </p>

        <div className="mt-5 flex gap-2">
          {!isLoggedIn ? (
            <>
              <Link
                href="/register"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700"
              >
                시작하기
              </Link>
              <Link
                href="/network"
                className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold text-white"
              >
                둘러보기
              </Link>
            </>
          ) : (
            <Link
              href="/network"
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
          <h2 className="text-base font-semibold text-slate-900">이런 정보를 찾을 수 있어요</h2>
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
    </MobileContainer>
  );
}