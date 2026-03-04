"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchCategories,
  fetchPosts,
  NetworkType,
  Category,
  PostListItem,
} from "@/shared/api/network";
import { useRequireAuth } from "@/shared/hooks/useRequireAuth";

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
  useRequireAuth();
  const [tab, setTab] = useState<NetworkType>("student");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | undefined>(undefined);

  const [pinned, setPinned] = useState<PostListItem | null>(null);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    (async () => {
      const cats = await fetchCategories(tab);
      setCategories(cats);
      setCategorySlug(undefined);
    })();
  }, [tab]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetchPosts({
          type: tab,
          category: categorySlug,
        });
        setPinned(res.pinned ?? null);
        setPosts(res.posts ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, categorySlug]);

  const merged = useMemo(() => {
    const arr: PostListItem[] = [];
    if (pinned) arr.push(pinned);
    arr.push(...posts);
    return arr;
  }, [pinned, posts]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((p) => {
      const t = (p.title ?? "").toLowerCase();
      const a = (p.author_name ?? "").toLowerCase();
      const c = (p.category_name ?? "").toLowerCase();
      return t.includes(q) || a.includes(q) || c.includes(q);
    });
  }, [merged, keyword]);

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
                      onClick={() => setTab(t.key)}
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
                  onClick={() => setCategorySlug(undefined)}
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
                    onClick={() => setCategorySlug(c.slug)}
                    style={{
                      ...styles.chip,
                      ...(categorySlug === c.slug ? styles.chipActive : null),
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div style={styles.searchWrap}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="제목, 내용, 태그로 검색..."
                  style={styles.searchInput}
                />
              </div>
            </div>
          </div>
        </div>

        <div style={styles.sectionInner}>
          <div style={styles.gridWrap}>
            {loading ? (
              <div style={{ padding: "24px 0", color: "#4A5565" }}>로딩중...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "24px 0", color: "#4A5565" }}>게시글이 없습니다.</div>
            ) : (
              <div style={styles.grid}>
                {filtered.map((p) => {
                  const badgeLabel = p.category_name ?? "전체";
                  const author = p.author_name ?? "-";
                  const date = formatDotDate((p as any).created_at);
                  const views = (p as any).view_count ?? (p as any).views ?? 0;
                  const comments = (p as any).comment_count ?? 0;

                  const authorInitial =
                    author && author !== "-" ? author.trim().slice(0, 1) : "?";

                  const desc =
                    (p as any).excerpt ??
                    (p as any).summary ??
                    (p as any).content_preview ??
                    "";

                  return (
                    <a key={p.id} href={`/network/${p.id}`} style={styles.cardLink}>
                      <div style={styles.cardImage} />
                      <div style={styles.cardBody}>
                        <div style={styles.badge}>
                          <span style={styles.badgeDot} />
                          <span style={styles.badgeText}>{badgeLabel}</span>
                        </div>

                        <h3 style={styles.cardTitle}>{p.title}</h3>

                        <p style={styles.cardDesc}>{desc}</p>

                        <div style={styles.cardFooter}>
                          <div style={styles.authorLeft}>
                            <div style={styles.avatar}>{authorInitial}</div>
                            <div style={styles.authorText}>
                              {author}
                              {date ? `·${date}` : ""}
                            </div>
                          </div>

                          <div style={styles.stats}>
                            <div style={styles.stat}>
                              <span style={styles.statIcon}>👁️</span>
                              <span>{views}</span>
                            </div>
                            <div style={styles.stat}>
                              <span style={styles.statIcon}>💬</span>
                              <span>{comments}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <a href={`/network/write?type=${tab}`} style={styles.fab} aria-label="글쓰기">
          <span style={styles.plus}>
            <span style={styles.plusH} />
            <span style={styles.plusV} />
          </span>
        </a>
      </div>
    </div>
  );
}