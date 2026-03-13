"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchCategories,
  fetchPosts,
  togglePostLike,
  NetworkType,
  Category,
  PostListItem,
} from "@/shared/api/network";
import { API_BASE } from "@/shared/api/api";
import Image from "next/image";
import { Eye, MessageCircle, Tag } from "lucide-react";

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = API_BASE.replace(/\/$/, "");
  return url.startsWith("/") ? `${base}${url}` : `${base}/${url}`;
}

function toPlainText(input: unknown) {
  if (typeof input !== "string") return "";
  // TipTap/HTML → plain text preview
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

  // 상위 레이아웃의 max-w / mx-auto 영향 줄이기
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

  filterBar: {
    width: "100%",
    background: "#FFFFFF",
    padding: "18px 0",
  } as React.CSSProperties,

  filterInnerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  } as React.CSSProperties,

  chipRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  } as React.CSSProperties,

  chip: {
    height: 40,
    padding: "0 16px",
    borderRadius: 999999,
    border: "1px solid #E5E7EB",
    background: "#F3F4F6",
    cursor: "pointer",
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 600,
    fontSize: 14,
    color: "#101828",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  chipActive: {
    background: "#2563EB",
    border: "1px solid #2563EB",
    color: "#FFFFFF",
  } as React.CSSProperties,

  searchWrap: {
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
  } as React.CSSProperties,

  searchIcon: {
    fontSize: 14,
    color: "#6A7282",
  } as React.CSSProperties,

  searchInput: {
    border: 0,
    outline: "none",
    width: "100%",
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontSize: 14,
    color: "#101828",
  } as React.CSSProperties,

  gridWrap: {
    padding: "0 0 80px",
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 350px)",
    gap: 24,
    justifyContent: "space-between",
  } as React.CSSProperties,

  cardLink: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    padding: 1,
    width: 350,
    height: 392,
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    textDecoration: "none",
    color: "inherit",
    overflow: "hidden",
  } as React.CSSProperties,

  cardImage: {
    width: 348,
    height: 192,
    background: "#4A5565",
    flex: "none",
    alignSelf: "stretch",
  } as React.CSSProperties,

  cardBody: {
    position: "relative",
    width: 348,
    height: 199,
  } as React.CSSProperties,

  badge: {
    position: "absolute",
    left: 20,
    top: 20,
    width: 56.75,
    height: 24,
    background: "#EFF6FF",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 6,
    paddingLeft: 10,
    boxSizing: "border-box",
  } as React.CSSProperties,

  badgeDot: {
    width: 12,
    height: 12,
    borderRadius: 999999,
    border: "1px solid #2563EB",
    background: "#2563EB",
    boxSizing: "border-box",
  } as React.CSSProperties,

  badgeText: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 600,
    fontSize: 12,
    lineHeight: "16px",
    color: "#2563EB",
  } as React.CSSProperties,

  cardTitle: {
    position: "absolute",
    left: 20,
    top: 56,
    width: 303.66,
    height: 28,
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 18,
    lineHeight: "28px",
    letterSpacing: "-0.439453px",
    color: "#101828",
    margin: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  } as React.CSSProperties,

  cardDesc: {
    position: "absolute",
    left: 20,
    top: 92,
    width: 303.66,
    height: 44,
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 400,
    fontSize: 14,
    lineHeight: "23px",
    letterSpacing: "-0.150391px",
    color: "#4A5565",
    margin: 0,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical" as any,
  } as React.CSSProperties,

  cardFooter: {
    boxSizing: "border-box",
    position: "absolute",
    left: 20,
    top: 152,
    width: 303.66,
    height: 41,
    borderTop: "1px solid #F3F4F6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
  } as React.CSSProperties,

  authorLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,

  avatar: {
    width: 24,
    height: 24,
    borderRadius: 999999,
    background: "linear-gradient(135deg, #51A2FF 0%, #615FFF 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#FFFFFF",
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 700,
    fontSize: 12,
    lineHeight: "16px",
  } as React.CSSProperties,

  authorText: {
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: "16px",
    color: "#4A5565",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  stats: {
    display: "flex",
    alignItems: "center",
    gap: 18,
  } as React.CSSProperties,

  stat: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontWeight: 400,
    fontSize: 12,
    lineHeight: "16px",
    color: "#6A7282",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  statIcon: {
    width: 14,
    height: 14,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#6A7282",
    fontSize: 12,
  } as React.CSSProperties,

  fab: {
    position: "fixed",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    background: "#2563EB",
    borderRadius: 999999,
    boxShadow:
      "0px 10px 15px -3px rgba(0, 0, 0, 0.1), 0px 4px 6px -4px rgba(0, 0, 0, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
  } as React.CSSProperties,

  plus: {
    position: "relative",
    width: 24,
    height: 24,
  } as React.CSSProperties,

  plusH: {
    position: "absolute",
    left: "20.83%",
    right: "20.83%",
    top: "50%",
    borderTop: "2px solid #FFFFFF",
    transform: "translateY(-50%)",
  } as React.CSSProperties,

  plusV: {
    position: "absolute",
    top: "20.83%",
    bottom: "20.83%",
    left: "50%",
    borderLeft: "2px solid #FFFFFF",
    transform: "translateX(-50%)",
  } as React.CSSProperties,
};

function formatDotDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export default function NetworkPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tab, setTab] = useState<NetworkType>("student");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);

  const [pinned, setPinned] = useState<PostListItem[]>([]);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    (async () => {
      const cats = await fetchCategories(tab);
      setCategories(cats);
      setCategorySlug(undefined);
      setPage(1);
    })();
  }, [tab]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetchPosts({
          type: tab,
          category: categorySlug,
          page,
        });
        setPinned(res.pinned);
        setPosts(res.posts ?? []);

        const apiTotalPages = res.total_pages;
        const apiCount = res.count ?? 0;
        const PAGE_SIZE = 9;
        if (apiTotalPages && apiTotalPages > 0) {
          setTotalPages(apiTotalPages);
        } else {
          setTotalPages(Math.max(1, Math.ceil(apiCount / PAGE_SIZE)));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, categorySlug, page]);

  const filtered = useMemo(() => {
    const baseList =
      page === 1
        ? [...pinned, ...posts]
        : posts;

    const q = keyword.trim().toLowerCase();
    if (!q) return baseList;
    return baseList.filter((p) => {
      const t = (p.title ?? "").toLowerCase();
      const a = (p.author_name ?? "").toLowerCase();
      const c = (p.category_name ?? "").toLowerCase();
      return t.includes(q) || a.includes(q) || c.includes(q);
    });
  }, [pinned, posts, page, keyword]);

  const isQnaTab = tab === "qa";

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

  const handleCardClick = (id: number) => {
    if (!isLoggedIn) {
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
      const res = await togglePostLike(postId);
      const updateItem = (p: PostListItem) =>
        p.id === postId
          ? { ...p, like_count: res.like_count, is_liked: res.liked }
          : p;
      setPosts((prev) => prev.map(updateItem));
      setPinned((prev) => prev.map(updateItem));
    } catch {
      // 좋아요 실패 시 무시
    }
  };

  const handleChangeTab = (nextTab: NetworkType) => {
    setTab(nextTab);
    setPage(1);
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

        <div style={styles.filterBar}>
          <div style={styles.sectionInner}>
            <div style={styles.filterInnerRow}>
              <div style={styles.chipRow}>
                <button
                  onClick={() => handleChangeCategory(undefined)}
                  style={{
                    ...styles.chip,
                    ...(!categorySlug ? styles.chipActive : null),
                  }}
                >
                  전체
                </button>

                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleChangeCategory(c.slug)}
                    style={{
                      ...styles.chip,
                      ...(categorySlug === c.slug ? styles.chipActive : null),
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={styles.searchWrap}>
                  <span style={styles.searchIcon}>🔍</span>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="제목, 내용, 태그로 검색..."
                    style={styles.searchInput}
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
                    fontFamily:
                      "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    textDecoration: "none",
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
          <div style={styles.gridWrap}>
            {loading ? (
              <div style={styles.grid}>
                {Array.from({ length: 6 }).map((_, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={i} style={styles.cardLink}>
                    <div
                      style={{
                        ...styles.cardImage,
                        background: "#E5E7EB",
                      }}
                    />
                    <div style={styles.cardBody}>
                      <div
                        style={{
                          position: "absolute",
                          left: 20,
                          top: 60,
                          width: 220,
                          height: 20,
                          borderRadius: 6,
                          background: "#E5E7EB",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: 20,
                          top: 90,
                          width: 260,
                          height: 16,
                          borderRadius: 6,
                          background: "#F3F4F6",
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          left: 20,
                          top: 150,
                          width: 180,
                          height: 14,
                          borderRadius: 6,
                          background: "#E5E7EB",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "24px 0", color: "#4A5565" }}>게시글이 없습니다.</div>
            ) : isQnaTab ? (
              <div className="space-y-4 max-w-4xl mx-auto">
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
                      onClick={() => handleCardClick(p.id)}
                      className="w-full bg-white rounded-xl border border-gray-200 px-7 py-6 text-left shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:border-[#2563EB] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-500">{date}</span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                answered
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {answered ? "답변완료" : "답변대기"}
                            </span>
                          </div>
                          <h3 className="text-[17px] font-semibold text-gray-900 mb-1 line-clamp-1">
                            {p.title}
                          </h3>
                        <p className="text-[15px] text-[#4A5565] mb-3 leading-relaxed line-clamp-2">
                            {descText}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              {views}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleLikeClick(e, p.id)}
                              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
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
                              <MessageCircle className="w-3.5 h-3.5" />
                              {comments}
                            </span>
                          </div>
                        </div>
                        <div className="hidden sm:flex flex-col items-end gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#2563EB] rounded-md text-xs font-semibold">
                            <Tag className="w-3 h-3" />
                            {badgeLabel}
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(p as any).author_profile_image || "/icons/userbaseimage.svg"}
                            alt="profile"
                            loading="lazy"
                            className="mt-2 w-8 h-8 rounded-full object-cover"
                          />
                          <span className="mt-1 text-xs text-gray-600 max-w-[120px] text-right truncate">
                            {author}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      onClick={() => handleCardClick(p.id)}
                      className="group block bg-white rounded-xl overflow-hidden border border-gray-200 hover:border-[#2563EB] hover:shadow-xl transition-all duration-300 text-left cursor-pointer"
                    >
                      {/* 썸네일 - 이미지 1개/여러 개 동일하게 영역 꽉 채움 */}
                      <div
                        className={`relative w-full aspect-video overflow-hidden ${
                          !p.thumbnail
                            ? "bg-gradient-to-br from-[#D6E4F7] to-[#C5D9F2]"
                            : "bg-gray-100"
                        }`}
                      >
                        {p.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveImageUrl(p.thumbnail)}
                            alt={p.title}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full min-w-full min-h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                          />
                        )}
                      </div>

                      {/* 내용 */}
                      <div className="p-5">
                        {/* 뱃지 */}
                        <div className="flex items-center gap-2 mb-3">
                          {p.is_pinned && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                              📌 상단 고정
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#2563EB] rounded-md text-xs font-semibold">
                            <Tag className="w-3 h-3" />
                            {badgeLabel}
                          </span>
                        </div>

                        {/* 제목 */}
                        <h3 className="text-lg font-bold mb-2 text-gray-900 line-clamp-2 group-hover:text-[#2563EB] transition-colors">
                          {p.title}
                        </h3>

                        {/* 본문 요약 */}
                        <p className="text-[15px] text-[#4A5565] line-clamp-2 mb-4 leading-relaxed">
                          {descText}
                        </p>

                        {/* 작성자 / 날짜 */}
                        <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={(p as any).author_profile_image || "/icons/userbaseimage.svg"}
                            alt="profile"
                            loading="lazy"
                            className="w-6 h-6 rounded-full object-cover"
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

                        {/* 통계 */}
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" />
                            {views}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleLikeClick(e, p.id)}
                            className="flex items-center gap-1 hover:opacity-80 transition-opacity"
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
                            <MessageCircle className="w-3.5 h-3.5" />
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
                  className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  이전
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNumber = idx + 1;
                  const isActive = pageNumber === page;
                  return (
                    <button
                      // eslint-disable-next-line react/no-array-index-key
                      key={idx}
                      type="button"
                      onClick={() => handleChangePage(pageNumber)}
                      className={`min-w-[32px] px-2 py-1 rounded-lg text-sm border ${
                        isActive
                          ? "bg-[#2563EB] text-white border-[#2563EB]"
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
                  className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}