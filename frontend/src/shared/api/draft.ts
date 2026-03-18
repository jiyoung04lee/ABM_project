import api from "@/shared/api/axios";

export interface Draft {
  id: number;
  type: "student" | "graduate";
  title: string;
  content: string;
  updated_at: string;
}

// draft 조회
export async function fetchDraft(type: "student" | "graduate"): Promise<Draft | null> {
  const { data } = await api.get("/networks/drafts/", { params: { type } });
  return data ?? null;
}

// draft 저장 / 덮어쓰기
export async function saveDraft(payload: {
  type: "student" | "graduate";
  title: string;
  content: string;
}): Promise<Draft> {
  const { data } = await api.post("/networks/drafts/", payload);
  return data;
}

// draft 삭제 (글 완료 시)
export async function deleteDraft(type: "student" | "graduate"): Promise<void> {
  await api.delete("/networks/drafts/", { params: { type } });
}

// 이미지 단독 업로드 (임시저장용)
export async function uploadDraftImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);
  const { data } = await api.post<{ url: string }>("/networks/images/upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.url;
}