export const COMMUNITY_CATEGORIES = [
  "전체",
  "공지",
  "홍보",
  "이벤트",
  "기타",
];

export function getCommunityCategoryLabel(name: string): string {
  return name === "알쓸잡생" || name === "알쓸생잡" ? "이벤트" : name;
}
