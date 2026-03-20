"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  fetchCategories,
  togglePostLike,
  NetworkType,
  Category,
} from "@/shared/api/network";
import { useNetworkPosts } from "@/shared/hooks/useNetworkPosts";
import { API_BASE } from "@/shared/api/api";
import Image from "next/image";
import { Eye, MessageCircle, Tag, Search } from "lucide-react";

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function toPlainText(input: unknown) {
  if (typeof input !== "string") return "";
  const withoutTags = input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ");

  return withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDotDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

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

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [breakpoint]);

  return isMobile;
}

const TABS: { key: NetworkType; label: string }[] = [
  { key: "student", label: "재학생" },
  { key: "graduate", label: "졸업생" },
  { key: "qa", label: "Q&A" },
];

const styles = {
  page: {
    width: "100%",
    minHeight: "100vh",
    background: "#FFFFFF",
  } as React.CSSProperties,

  main: {
    width: "100%",
    maxWidth: "none",
    margin: 0,
  } as React.CSSProperties,

  sectionInner: {
    width: "100%",
    maxWidth: 1149,
    margin: "0 auto",
    padding: "0 32px",
    boxSizing: "border-box",
  } as React.CSSProperties,

  hero: {
    position: "relative",
    width: "100%",
    background: "linear-gradient(135deg, #DBEAFE 0%, #EEF2FF 50%, #EFF6FF 100%)",
    borderBottom: "1px solid #E5E7EB",
    overflow: "hidden",
  } as React.CSSProperties,

  blur1: {
    position: "absolute",
    width: 374.55,
    height: 374.55,
    left: 3.57,
    top: -1.66,
    background: "#8EC5FF",
    opacity: 0.3,
    filter: "blur(64px)",
    borderRadius: 999999,
  } as React.CSSProperties,

  blur2: {
    position: "absolute",
    width: 414.63,
    height: 414.63,
    left: 773.61,
    top: -55.2,
    background: "#A3B3FF",
    opacity: 0.3,
    filter: "blur(64px)",
    borderRadius: 999999,
  } as React.CSSProperties,

  blur3: {
    position: "absolute",
    width: 384,
    height: 384,
    left: 574.5,
    top: -18,
    background: "#51A2FF",
    opacity: 0.3,
    filter: "blur(64px)",
    borderRadius: 999999,
  } as React.CSSProperties,

  heroCenter: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: 14,
    paddingTop: 128,
    paddingBottom: 64,
  } as React.CSSProperties,

  pillWrap: {
    height: 36,
    padding: "0 14px",
    background: "#E0E7FF",
    borderRadius: 999999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  pillText: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontStyle: "normal",
    fontWeight: 600,
    fontSize: 14,
    lineHeight: "20px",
    textAlign: "center",
    letterSpacing: "-0.150391px",
    color: "#372AAC",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  h1: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontStyle: "normal",
    fontWeight: 700,
    fontSize: 48,
    lineHeight: "48px",
    textAlign: "center",
    letterSpacing: "0.351562px",
    color: "#101828",
    margin: 0,
  } as React.CSSProperties,

  subtitle: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontStyle: "normal",
    fontWeight: 400,
    fontSize: 18,
    lineHeight: "28px",
    textAlign: "center",
    letterSpacing: "-0.439453px",
    color: "#4A5565",
    margin: 0,
  } as React.CSSProperties,

  tabOuter: {
    boxSizing: "border-box",
    width: 448,
    height: 62,
    background: "rgba(255, 255, 255, 0.8)",
    border: "1px solid #E5E7EB",
    boxShadow:
      "0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px -1px rgba(0, 0, 0, 0.1)",
    borderRadius: 16,
    padding: "9px 9px 1px",
    backdropFilter: "blur(8px)",
    marginTop: 10,
  } as React.CSSProperties,

  tabRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    width: "100%",
    height: 44,
  } as React.CSSProperties,

  tabBtn: {
    flex: 1,
    height: 44,
    border: 0,
    background: "transparent",
    borderRadius: 12,
    cursor: "pointer",
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontStyle: "normal",
    fontWeight: 600,
    fontSize: 14,
    lineHeight: "20px",
    textAlign: "center" as const,
    letterSpacing: "-0.150391px",
    color: "#4A5565",
  } as React.CSSProperties,

  tabBtnActive: {
    background: "linear-gradient(180deg, #2563EB 0%, #4F46E5 100%)",
    boxShadow:
      "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -2px rgba(0, 0, 0, 0.1)",
    color: "#FFFFFF",
  } as React.CSSProperties,
};

type CommonPageProps = {
  tab: NetworkType;
  categories: Category[];
  categorySlug: string | undefined;
  keyword: string;
  setKeyword: (value: string) => void;
  handleChangeTab: (nextTab: NetworkType) => void;
  handleChangeCategory: (slug: string | undefined) => void;
  handleWriteClick: () => void;
  filtered: any[];
  loading: boolean;
  totalPages: number;
  page: number;
  handleChangePage: (nextPage: number) => void;
  handleCardClick: (id: number, isPinned?: boolean) => void;
  handleLikeClick: (e: React.MouseEvent, postId: number) => void;
};

function MobileNetworkPage({
  tab,
  categories,
  categorySlug,
  keyword,
  setKeyword,
  handleChangeTab,
  handleChangeCategory,
  handleWriteClick,
  filtered,
  loading,
  totalPages,
  page,
  handleChangePage,
  handleCardClick,
  handleLikeClick,
}: CommonPageProps) {
  const isQnaTab = tab === "qa";

  return (
    <div className="min-h-screen bg-[#f8fafc] -mt-20">
      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50">
        <div className="absolute left-[-40px] top-[-30px] h-56 w-56 rounded-full bg-blue-300/30 blur-3xl" />
        <div className="absolute right-[-40px] top-[-20px] h-56 w-56 rounded-full bg-indigo-300/30 blur-3xl" />

        <div className="px-4 pt-20 pb-5 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-semibold text-indigo-700">
            🌟 선배들의 생생한 경험을 공유합니다
          </div>

          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">네트워크</h1>
          <p className="mt-2 text-sm text-slate-600">실전 경험과 노하우를 한곳에서 찾아보세요</p>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm backdrop-blur">
            <div className="grid grid-cols-3 gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => handleChangeTab(t.key)}
                  className={`h-10 rounded-xl text-sm font-semibold transition ${
                    tab === t.key
                      ? "bg-gradient-to-b from-blue-600 to-indigo-600 text-white shadow"
                      : "bg-transparent text-slate-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            value={categorySlug ?? ""}
            onChange={(e) => handleChangeCategory(e.target.value || undefined)}
            className="h-10 w-[112px] rounded-full border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
          >
            <option value="">전체</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>

          <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="제목, 내용, 태그 검색..."
              className="w-full min-w-0 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-24 pt-4">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-44 bg-slate-200" />
                <div className="space-y-3 p-4">
                  <div className="h-4 w-16 rounded bg-slate-200" />
                  <div className="h-5 w-3/4 rounded bg-slate-200" />
                  <div className="h-4 w-full rounded bg-slate-100" />
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">게시글이 없습니다.</div>
        ) : isQnaTab ? (
          <div className="space-y-3">
            {filtered.map((p) => {
              const badgeLabel = p.category_name ?? "전체";
              const author = p.author_name ?? "-";
              const date = formatDotDate((p as any).created_at);
              const views = p.view_count ?? 0;
              const likes = p.like_count ?? 0;
              const comments = p.comment_count ?? 0;
              const answered = comments > 0;

              const desc =
                (p as any).excerpt ??
                (p as any).summary ??
                (p as any).content_preview ??
                (p as any).content ??
                "";
              const descText = toPlainText(desc);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleCardClick(p.id, p.is_pinned)}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#2563EB]"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">{date}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        answered ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {answered ? "답변완료" : "답변대기"}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-2">
                    {p.is_pinned && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        📌 상단 고정
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                      <Tag className="h-3 w-3" />
                      {badgeLabel}
                    </span>
                  </div>

                  <h3 className="mb-1 line-clamp-1 text-[16px] font-semibold text-slate-900">{p.title}</h3>
                  <p className="mb-3 line-clamp-2 text-[14px] leading-6 text-slate-600">{descText}</p>

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <img
                        src={(p as any).author_profile_image || "/icons/userbaseimage.svg"}
                        alt="profile"
                        loading="lazy"
                        className="h-7 w-7 rounded-full object-cover"
                      />
                      <span className="truncate text-xs text-slate-600">{author}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {views}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleLikeClick(e, p.id)}
                        className="flex items-center gap-1"
                      >
                        <Image
                          src={p.is_liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
                          alt="like"
                          width={14}
                          height={14}
                        />
                        {likes}
                      </button>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {comments}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((p) => {
              const badgeLabel = p.category_name ?? "전체";
              const author = p.author_name ?? "-";
              const date = formatDotDate((p as any).created_at);
              const views = p.view_count ?? 0;
              const likes = p.like_count ?? 0;
              const comments = p.comment_count ?? 0;

              const desc =
                (p as any).excerpt ??
                (p as any).summary ??
                (p as any).content_preview ??
                (p as any).content ??
                "";
              const descText = toPlainText(desc);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleCardClick(p.id, p.is_pinned)}
                  className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-[#2563EB]"
                >
                  <div className="relative h-[190px] w-full overflow-hidden bg-slate-100">
                    {p.thumbnail ? (
                      <img
                        src={resolveImageUrl(p.thumbnail)}
                        alt={p.title}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <img
                        src="/icons/networkimage.png"
                        alt="default thumbnail"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {p.is_pinned && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          📌 상단 고정
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#2563EB]">
                        <Tag className="h-3 w-3" />
                        {badgeLabel}
                      </span>
                    </div>

                    <h3 className="mb-2 line-clamp-2 text-[17px] font-bold text-slate-900 group-hover:text-[#2563EB]">
                      {p.title}
                    </h3>

                    <p className="mb-4 line-clamp-2 text-[14px] leading-6 text-slate-600">{descText}</p>

                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                      <img
                        src={(p as any).author_profile_image || "/icons/userbaseimage.svg"}
                        alt="profile"
                        loading="lazy"
                        className="h-6 w-6 rounded-full object-cover"
                      />
                      <div className="min-w-0 text-xs text-slate-600">
                        <span className="truncate font-medium">{author}</span>
                        {date && (
                          <>
                            <span className="mx-1">·</span>
                            <span>{date}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" />
                        {views}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleLikeClick(e, p.id)}
                        className="flex items-center gap-1"
                      >
                        <Image
                          src={p.is_liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
                          alt="like"
                          width={14}
                          height={14}
                        />
                        {likes}
                      </button>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {comments}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => handleChangePage(page - 1)}
              disabled={page === 1}
              className="rounded-lg border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              이전
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNumber = idx + 1;
              const isActive = pageNumber === page;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleChangePage(pageNumber)}
                  className={`min-w-[32px] rounded-lg border px-2 py-1 text-sm ${
                    isActive
                      ? "border-[#2563EB] bg-[#2563EB] text-white"
                      : "bg-white text-slate-700"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleChangePage(page + 1)}
              disabled={page === totalPages}
              className="rounded-lg border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleWriteClick}
        className="fixed bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg"
        aria-label="글쓰기"
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    </div>
  );
}

function DesktopNetworkPage({
  tab,
  categories,
  categorySlug,
  keyword,
  setKeyword,
  handleChangeTab,
  handleChangeCategory,
  handleWriteClick,
  filtered,
  loading,
  totalPages,
  page,
  handleChangePage,
  handleCardClick,
  handleLikeClick,
}: CommonPageProps) {
  const isQnaTab = tab === "qa";

  return (
    <div style={{ ...styles.page, marginTop: "-80px" }}>
      <div style={styles.main}>
        <section style={styles.hero}>
          <div style={styles.blur1} />
          <div style={styles.blur2} />
          <div style={styles.blur3} />

          <div style={styles.sectionInner}>
            <div style={styles.heroCenter}>
              <div style={styles.pillWrap}>
                <div style={styles.pillText}>🌟 선배들의 생생한 경험을 공유합니다</div>
              </div>

              <h1 style={styles.h1}>네트워크</h1>
              <p style={styles.subtitle}>실전 경험과 노하우를 한곳에서 찾아보세요</p>

              <div style={styles.tabOuter}>
                <div style={styles.tabRow}>
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => handleChangeTab(t.key)}
                      style={{
                        ...styles.tabBtn,
                        ...(tab === t.key ? styles.tabBtnActive : null),
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div style={{ width: "100%", background: "#FFFFFF", padding: "18px 0" }}>
          <div style={styles.sectionInner}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => handleChangeCategory(undefined)}
                  style={{
                    height: 40,
                    padding: "0 16px",
                    borderRadius: 999999,
                    border: !categorySlug ? "1px solid #2563EB" : "1px solid #E5E7EB",
                    background: !categorySlug ? "#2563EB" : "#F3F4F6",
                    color: !categorySlug ? "#FFFFFF" : "#101828",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  전체
                </button>

                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleChangeCategory(c.slug)}
                    style={{
                      height: 40,
                      padding: "0 16px",
                      borderRadius: 999999,
                      border: categorySlug === c.slug ? "1px solid #2563EB" : "1px solid #E5E7EB",
                      background: categorySlug === c.slug ? "#2563EB" : "#F3F4F6",
                      color: categorySlug === c.slug ? "#FFFFFF" : "#101828",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 330,
                    height: 40,
                    borderRadius: 999999,
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 14px",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ fontSize: 14, color: "#6A7282" }}>🔍</span>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="제목, 내용, 태그로 검색..."
                    style={{
                      border: 0,
                      outline: "none",
                      width: "100%",
                      fontSize: 14,
                      color: "#101828",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleWriteClick}
                  style={{
                    height: 40,
                    padding: "0 18px",
                    borderRadius: 999999,
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    whiteSpace: "nowrap",
                    boxSizing: "border-box",
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  + 글쓰기
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sectionInner}>
          <div style={{ padding: "0 0 80px" }}>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      border: "1px solid #E5E7EB",
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#fff",
                    }}
                  >
                    <div style={{ height: 192, background: "#E5E7EB" }} />
                    <div style={{ padding: 20 }}>
                      <div style={{ height: 20, width: 220, borderRadius: 6, background: "#E5E7EB" }} />
                      <div
                        style={{
                          marginTop: 12,
                          height: 16,
                          width: 260,
                          borderRadius: 6,
                          background: "#F3F4F6",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "24px 0", color: "#4A5565" }}>게시글이 없습니다.</div>
            ) : isQnaTab ? (
              <div className="mx-auto max-w-4xl space-y-4">
                {filtered.map((p) => {
                  const badgeLabel = p.category_name ?? "전체";
                  const author = p.author_name ?? "-";
                  const date = formatDotDate((p as any).created_at);
                  const views = p.view_count ?? 0;
                  const likes = p.like_count ?? 0;
                  const comments = p.comment_count ?? 0;
                  const answered = comments > 0;

                  const desc =
                    (p as any).excerpt ??
                    (p as any).summary ??
                    (p as any).content_preview ??
                    (p as any).content ??
                    "";
                  const descText = toPlainText(desc);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleCardClick(p.id, p.is_pinned)}
                      className="w-full cursor-pointer rounded-xl border border-gray-200 bg-white px-7 py-6 text-left shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all hover:border-[#2563EB] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">{date}</span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                answered
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {answered ? "답변완료" : "답변대기"}
                            </span>
                          </div>
                          <h3 className="mb-1 line-clamp-1 text-[17px] font-semibold text-gray-900">
                            {p.title}
                          </h3>
                          <p className="mb-3 line-clamp-2 text-[15px] leading-relaxed text-[#4A5565]">
                            {descText}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              {views}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleLikeClick(e, p.id)}
                              className="flex items-center gap-1 transition-opacity hover:opacity-80"
                            >
                              <Image
                                src={p.is_liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
                                alt="like"
                                width={14}
                                height={14}
                              />
                              {likes}
                            </button>
                            <span className="flex items-center gap-1">
                              <MessageCircle className="h-3.5 w-3.5" />
                              {comments}
                            </span>
                          </div>
                        </div>
                        <div className="hidden flex-col items-end gap-2 sm:flex">
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
                            <Tag className="h-3 w-3" />
                            {badgeLabel}
                          </span>
                          <img
                            src={(p as any).author_profile_image || "/icons/userbaseimage.svg"}
                            alt="profile"
                            loading="lazy"
                            className="mt-2 h-8 w-8 rounded-full object-cover"
                          />
                          <span className="mt-1 max-w-[120px] truncate text-right text-xs text-gray-600">
                            {author}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => {
                  const badgeLabel = p.category_name ?? "전체";
                  const author = p.author_name ?? "-";
                  const date = formatDotDate((p as any).created_at);
                  const views = p.view_count ?? 0;
                  const likes = p.like_count ?? 0;
                  const comments = p.comment_count ?? 0;

                  const desc =
                    (p as any).excerpt ??
                    (p as any).summary ??
                    (p as any).content_preview ??
                    (p as any).content ??
                    "";
                  const descText = toPlainText(desc);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleCardClick(p.id, p.is_pinned)}
                      className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-all duration-300 hover:border-[#2563EB] hover:shadow-xl"
                    >
                      <div className="relative isolate h-[200px] w-full flex-none shrink-0 overflow-hidden bg-gray-100">
                        {p.thumbnail ? (
                          <img
                            src={resolveImageUrl(p.thumbnail)}
                            alt={p.title}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <img
                            src="/icons/networkimage.png"
                            alt="default thumbnail"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        )}
                      </div>

                      <div className="flex-1 p-5">
                        <div className="mb-3 flex items-center gap-2">
                          {p.is_pinned && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              📌 상단 고정
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#2563EB]">
                            <Tag className="h-3 w-3" />
                            {badgeLabel}
                          </span>
                        </div>

                        <h3 className="mb-2 line-clamp-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-[#2563EB]">
                          {p.title}
                        </h3>

                        <p className="mb-4 line-clamp-2 text-[15px] leading-relaxed text-[#4A5565]">
                          {descText}
                        </p>

                        <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
                          <img
                            src={(p as any).author_profile_image || "/icons/userbaseimage.svg"}
                            alt="profile"
                            loading="lazy"
                            className="h-6 w-6 rounded-full object-cover"
                          />
                          <div className="text-xs text-gray-600">
                            <span className="font-medium">{author}</span>
                            {date && (
                              <>
                                <span className="mx-1">·</span>
                                <span>{date}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            {views}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleLikeClick(e, p.id)}
                            className="flex items-center gap-1 transition-opacity hover:opacity-80"
                          >
                            <Image
                              src={p.is_liked ? "/icons/like-filled.svg" : "/icons/like.svg"}
                              alt="like"
                              width={14}
                              height={14}
                            />
                            {likes}
                          </button>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {comments}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChangePage(page - 1)}
                  disabled={page === 1}
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNumber = idx + 1;
                  const isActive = pageNumber === page;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChangePage(pageNumber)}
                      className={`min-w-[32px] rounded-lg border px-2 py-1 text-sm ${
                        isActive
                          ? "border-[#2563EB] bg-[#2563EB] text-white"
                          : "bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleChangePage(page + 1)}
                  disabled={page === totalPages}
                  className="rounded-lg border px-3 py-1 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleWriteClick}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-lg"
        aria-label="글쓰기"
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    </div>
  );
}

function NetworkPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tab, setTab] = useState<NetworkType>("student");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    const t = searchParams.get("type") as NetworkType | null;
    if (t && ["student", "graduate", "qa"].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  const {
    pinned,
    posts,
    totalPages,
    isLoading: loading,
    mutate,
  } = useNetworkPosts(tab, categorySlug, page);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cats = await fetchCategories(tab);
        setCategories(cats);
        setCategorySlug(undefined);
        setPage(1);
      } catch (e) {
        console.error(e);
        setCategories([]);
      }
    })();
  }, [tab]);

  const filtered = useMemo(() => {
    const baseList = page === 1 ? [...pinned, ...posts] : posts;

    const q = keyword.trim().toLowerCase();
    if (!q) return baseList;

    return baseList.filter((p) => {
      const title = (p.title ?? "").toLowerCase();
      const author = (p.author_name ?? "").toLowerCase();
      const category = (p.category_name ?? "").toLowerCase();

      const rawContent =
        ((p as any).excerpt ??
          (p as any).summary ??
          (p as any).content_preview ??
          (p as any).content ??
          "") as string;

      const contentText = toPlainText(rawContent).toLowerCase();

      return (
        title.includes(q) ||
        author.includes(q) ||
        category.includes(q) ||
        contentText.includes(q)
      );
    });
  }, [pinned, posts, page, keyword]);

  const handleWriteClick = () => {
    if (!isLoggedIn) {
      router.push("/login?from=network&reason=write");
      return;
    }

    if (tab === "qa") {
      router.push(`/network/write?type=${tab}`);
    } else {
      router.push(`/network/write_net?type=${tab}`);
    }
  };

  const handleCardClick = (id: number, isPinned?: boolean) => {
    if (!isLoggedIn && !isPinned) {
      router.push("/login?from=network&reason=detail");
      return;
    }
    router.push(`/network/${id}`);
  };

  const handleLikeClick = async (e: React.MouseEvent, postId: number) => {
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push("/login?from=network&reason=like");
      return;
    }

    try {
      await togglePostLike(postId);
      mutate();
    } catch {
      //
    }
  };

  const handleChangeTab = (nextTab: NetworkType) => {
    setTab(nextTab);
    setPage(1);
    setKeyword("");
    router.replace(`/network?type=${nextTab}`, { scroll: false });
  };

  const handleChangeCategory = (slug: string | undefined) => {
    setCategorySlug(slug);
    setPage(1);
  };

  const handleChangePage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const sharedProps: CommonPageProps = {
    tab,
    categories,
    categorySlug,
    keyword,
    setKeyword,
    handleChangeTab,
    handleChangeCategory,
    handleWriteClick,
    filtered,
    loading,
    totalPages,
    page,
    handleChangePage,
    handleCardClick,
    handleLikeClick,
  };

  if (isMobile) {
    return <MobileNetworkPage {...sharedProps} />;
  }

  return <DesktopNetworkPage {...sharedProps} />;
}

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkPageContent />
    </Suspense>
  );
}