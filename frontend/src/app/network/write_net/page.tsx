"use client";

import { AxiosError } from "axios";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { createPost, fetchCategories } from "@/shared/api/network";
import { fetchDraft, saveDraft, deleteDraft, uploadDraftImage } from "@/shared/api/draft";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { LinkCard } from "@/features/network/ui/LinkCard";
import ResizableImage from "@/shared/editor/ResizableImage";

type NetworkType = "student" | "graduate" | "qa";

interface Category {
  id: number;
  type: NetworkType;
  name: string;
  slug: string;
}

interface ImageEntry {
  file: File;
  url: string; // blob URL
  postFileId?: number;
}

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

/* ---------------- 이미지 압축 유틸 ---------------- */

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("이미지 로드 실패")); };
    img.src = objectUrl;
  });
}

function getResizedSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  let w = width, h = height;
  if (w > maxWidth) { const r = maxWidth / w; w = Math.round(w * r); h = Math.round(h * r); }
  if (h > maxHeight) { const r = maxHeight / h; w = Math.round(w * r); h = Math.round(h * r); }
  return { width: w, height: h };
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const img = await loadImage(file);
  const { width, height } = getResizedSize(img.width, img.height, 1600, 1600);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context 생성 실패");
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
  if (!blob) throw new Error("이미지 압축 실패");
  const name = file.name.replace(/\.[^/.]+$/, "");
  return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
}

/* ---------------- 빈 내용 체크 유틸 ---------------- */
function isContentEmpty(html: string): boolean {
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").trim().replace(/\u00A0/g, "") === "";
}

function extractImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<img[^>]*\ssrc="([^"]+)"[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    srcs.push(m[1]);
  }
  return srcs;
}

function WriteContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const type = (sp.get("type") as NetworkType) ?? "student";

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [content, setContent] = useState("");

  // 이미지: { file, url(blob) } 배열로 통합 관리
  const [newImages, setNewImages] = useState<ImageEntry[]>([]);
  // 썸네일: blob URL로 추적 (인덱스 기반보다 삭제 시 안전)
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("16px");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 임시저장 상태
  const [draftSaving, setDraftSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{ title: string; content: string; image_ids: number[] } | null>(null);

  const draftCheckedRef = useRef(false);
  const justSavedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // onDelete는 ref로 들고 있어서 에디터 재생성 없이 항상 최신 콜백 유지
  const onDeleteRef = useRef<(src: string) => void>(() => {});
  useEffect(() => {
    onDeleteRef.current = (src: string) => {
      setNewImages((prev) => prev.filter((img) => img.url !== src));
      setMainImageUrl((prev) => (prev === src ? null : prev));
      if (src.startsWith("blob:")) URL.revokeObjectURL(src);
    };
  }, []);

  /* ---------------- TipTap Editor ---------------- */

  const editor = useEditor({
    extensions: [
      StarterKit,
      HorizontalRule,
      LinkCard,
      Link.configure({ openOnClick: true, autolink: true, linkOnPaste: true }),
      Underline,
      Gapcursor,
      Dropcursor,
      FontSize,
      Color.configure({ types: ["textStyle"] }),
      // 커스텀 ResizableImage: 리사이즈 핸들 + 삭제 버튼 통합
      ResizableImage.configure({
        HTMLAttributes: { class: "editor-image" },
        onDelete: (src) => onDeleteRef.current(src),
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "내용을 입력하세요" }),
    ],

    editorProps: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text");
        if (text && /(https?:\/\/[^\s]+)/.test(text)) {
          event.preventDefault();
          const node = view.state.schema.nodes.linkCard.create({ url: text });
          view.dispatch(view.state.tr.replaceSelectionWith(node));
          return true;
        }
        return false;
      },
    },

    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      setContent(html);
      setIsDirty(true);

      // 에디터에서 이미지가 직접 삭제/이동될 수 있으므로 상태를 HTML 기준으로 동기화
      const orderedSrcs = extractImageSrcs(html);
      const srcSet = new Set(orderedSrcs);
      setNewImages((prev) => {
        const next = prev.filter((img) => srcSet.has(img.url));
        const removed = prev.filter((img) => !srcSet.has(img.url));
        removed.forEach((img) => {
          if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
        });
        return next;
      });
      setMainImageUrl((prev) => {
        if (prev && srcSet.has(prev)) return prev;
        const firstBlob = orderedSrcs.find((s) => s.startsWith("blob:"));
        return firstBlob ?? null;
      });
    },
    onSelectionUpdate: ({ editor: e }) => {
      setCurrentFontSize(e.getAttributes("textStyle").fontSize || "16px");
    },
  });

  /* ---------------- 이미지 삽입 ---------------- */

  const addImageFiles = async (fileList: FileList | File[]) => {
    if (!editor) return;
    const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    try {
      const compressed = await Promise.all(imageFiles.map(compressImage));
      compressed.forEach((file) => {
        const url = URL.createObjectURL(file);
        editor.chain().focus().setImage({ src: url }).createParagraphNear().run();
        setNewImages((prev) => {
          const isFirst = prev.length === 0;
          if (isFirst) setMainImageUrl(url);
          return [...prev, { file, url }];
        });
      });
    } catch (err) {
      console.error(err);
      alert("이미지 처리 중 오류가 발생했습니다.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    await addImageFiles(e.target.files);
    e.target.value = "";
  };

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files?.length) return;
    await addImageFiles(e.dataTransfer.files);
    e.dataTransfer.clearData();
  };

  /* ---------------- 재진입 시 draft 복원 ---------------- */
  useEffect(() => {
    if (!editor || draftCheckedRef.current) return;
    if (type === "qa") return;
    draftCheckedRef.current = true;
    (async () => {
      try {
        const draft = await fetchDraft(type as "student" | "graduate");
        if (!draft) return;
        setPendingDraft({ title: draft.title, content: draft.content, image_ids: draft.image_ids ?? [] });
        setShowRestoreModal(true);
      } catch (e) { console.error(e); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, type]);

  const handleRestoreConfirm = () => {
    if (!pendingDraft || !editor) return;
    setTitle(pendingDraft.title);
    editor.commands.setContent(pendingDraft.content);
    setContent(pendingDraft.content);

    const srcs = extractImageSrcs(pendingDraft.content);
    const imageIds = pendingDraft.image_ids ?? [];  // ← 추가

    const restoredImages = srcs
      .filter((src) => !src.startsWith("blob:"))
      .map((src, idx) => ({
        file: new File([], src),
        url: src,
        postFileId: imageIds[idx],  // ← 추가: id 매핑
      }));
    setNewImages(restoredImages);
    setMainImageUrl(restoredImages[0]?.url ?? null);

    setIsDirty(false);
    setShowRestoreModal(false);
    setPendingDraft(null);
  };

  const handleRestoreCancel = () => { setShowRestoreModal(false); setPendingDraft(null); };

  /* ---------------- 자동저장 (debounce) ---------------- */
  useEffect(() => {
    if (type === "qa") return;
    if (!isDirty) return;
    if (!title.trim() && isContentEmpty(content)) return;
    if (content.includes('src="blob:')) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveDraft({
          type: type as "student" | "graduate",
          title,
          content,
          image_ids: newImages
            .filter((img) => img.postFileId)
            .map((img) => img.postFileId as number),
        });
        justSavedRef.current = true;
        setIsDirty(false);
        setTimeout(() => { justSavedRef.current = false; }, 500);
        console.log("자동저장 완료");
      } catch (e) {
        console.error("자동저장 실패", e);
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, content, isDirty, type, newImages]);

  /* ---------------- 이탈 경고 ---------------- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !justSavedRef.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* ---------------- 임시저장 ---------------- */

  const executeSave = useCallback(async () => {
    if (type === "qa") return;
    if (!title.trim() && isContentEmpty(content)) {
      alert("제목과 내용을 입력해야 임시저장할 수 있습니다."); return;
    }

    try {
      setIsSavingDraft(true);
      setSubmitting(true);

      let savedContent = content;
      const blobToResult = new Map<string, { url: string; id: number }>();
      const uploadedIds: number[] = [];

      // blob URL이 있으면 서버에 업로드 후 실제 URL로 교체
      if (content.includes('src="blob:')) {
        const blobToUrl = new Map<string, string>();

        // blob URL 수집
        const blobUrls: string[] = [];
        content.replace(/<img[^>]*src="(blob:[^"]+)"[^>]*\/?>/gi, (_, src) => {
          if (!blobUrls.includes(src)) blobUrls.push(src);
          return _;
        });

        // blob URL → File → 서버 업로드
        const blobToFile = new Map<string, File>(newImages.map((img) => [img.url, img.file]));

        await Promise.all(
          blobUrls.map(async (blobUrl) => {
            const file = blobToFile.get(blobUrl);
            if (!file) return;
            const result = await uploadDraftImage(file);  // 이제 { url, id } 반환
            blobToResult.set(blobUrl, result);
            blobToUrl.set(blobUrl, result.url);
            uploadedIds.push(result.id);
          })
        );

        // content 교체 후, newImages에 postFileId 업데이트
        setNewImages((prev) => prev.map((img) => {
          const result = blobToResult.get(img.url);
          if (!result) return img;
          return { ...img, url: result.url, postFileId: result.id };
        }));

        // content 내 blob URL을 실제 URL로 교체
        savedContent = content.replace(
          /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
          (_m, before, blobUrl, after) => {
            const realUrl = blobToUrl.get(blobUrl) ?? blobUrl;
            return `<img${before}src="${realUrl}"${after}>`;
          }
        );
      }

      const existingIds = newImages
        .filter((img) => img.postFileId)
        .map((img) => img.postFileId as number);

      await saveDraft({
        type: type as "student" | "graduate",
        title,
        content: savedContent,
        image_ids: [...existingIds, ...uploadedIds], // ← 로컬 변수 사용
      });
      justSavedRef.current = true;
      setIsDirty(false);
      setTimeout(() => { justSavedRef.current = false; }, 500);
      router.push(`/network?type=${type}`);
    } catch (e) {
      console.error(e);
      alert("임시저장에 실패했습니다.");
      setIsSavingDraft(false);
      setSubmitting(false);
    }
  }, [type, title, content, newImages, router]);

  const handleDraftSave = useCallback(async () => {
    if (draftSaving) return;
    await executeSave();
  }, [draftSaving, executeSave]);

  /* ---------------- 카테고리 ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const results = await fetchCategories(type);
        setCategories(results);
        if (results.length > 0) setCategory(String(results[0].id));
      } catch (e) { console.error(e); }
    })();
  }, [type]);

  /* ---------------- 글 작성 ---------------- */

  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim() || !content.trim()) { alert("제목과 내용을 입력해주세요."); return; }
    if (!category) { alert("카테고리를 선택해주세요."); return; }

    // 1) HTML에서 blob URL을 등장 순서대로 수집하면서 플레이스홀더로 교체
    //    → __BLOB_N__ 의 N 과 new_files[N] 이 항상 일치하게 만들기 위함
    const orderedBlobUrls: string[] = [];
    let blobIdx = 0;
    const contentWithPlaceholders = content.replace(
      /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
      (_m, before: string, blobUrl: string, after: string) => {
        orderedBlobUrls.push(blobUrl);
        return `<img${before}src="__BLOB_${blobIdx++}__"${after}>`;
      }
    );

    // 2) blob URL → File 매핑
    const blobToFile = new Map<string, File>(newImages.map((img) => [img.url, img.file]));

    const formData = new FormData();
    formData.append("type", type);
    formData.append("title", title);
    formData.append("content", contentWithPlaceholders);
    formData.append("is_anonymous", "false");
    formData.append("use_real_name", "false");
    formData.append("category", category);

    // 3) HTML 등장 순서대로 new_files 추가 (순서 버그 핵심 수정)
    orderedBlobUrls.forEach((blobUrl) => {
      const file = blobToFile.get(blobUrl);
      if (file) formData.append("new_files", file);
    });

    // 임시저장에서 불러온 이미지(PostFile id 있음)를 existing_files로 전달
    newImages
      .filter((img) => !img.url.startsWith("blob:") && img.postFileId)
      .forEach((img) => formData.append("existing_files", String(img.postFileId)));

    // 4) 썸네일 처리
    if (mainImageUrl !== null) {
      if (mainImageUrl.startsWith("blob:")) {
        // 새로 추가한 이미지 → blob 기준 인덱스
        const thumbIdx = orderedBlobUrls.indexOf(mainImageUrl);
        if (thumbIdx !== -1) formData.append("thumbnail_index", String(thumbIdx));
      } else {
        // 복원된 이미지 → URL에서 fetch해서 파일로 변환 후 업로드
        try {
          const res = await fetch(mainImageUrl);
          const blob = await res.blob();
          const file = new File([blob], "thumbnail.jpg", { type: blob.type });
          // new_files 맨 앞에 추가하고 thumbnail_index = 0
          // 단, content에 이미 포함된 이미지라 new_files에 추가하면 안 됨
          // → thumbnail만 별도로 처리
          formData.append("thumbnail_file", file);
        } catch (e) {
          console.error("썸네일 변환 실패", e);
        }
      }
    }

    try {
      setIsSavingDraft(false);
      setSubmitting(true);
      await createPost(formData);
      if (type !== "qa") {
        try { await deleteDraft(type as "student" | "graduate"); }
        catch (e) { console.error("draft 삭제 실패 (무시)", e); }
      }
      setIsDirty(false);
      alert("작성 완료");
      router.push(`/network?type=${type}`);
    } catch (err) {
      if (err instanceof AxiosError) console.error(err.response?.data);
      alert("작성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen pt-[1px] bg-white">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-[#2B7FFF]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">
              {isSavingDraft ? "임시저장 중입니다..." : "게시물을 업로드하고 있습니다..."}
            </p>
          </div>
        </div>
      )}

      {/* draft 불러오기 모달 */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl px-8 py-7 shadow-xl flex flex-col items-center gap-4 min-w-[280px]">
            <p className="text-sm font-semibold text-gray-800 text-center">
              임시저장된 글이 있습니다.<br />불러올까요?
            </p>
            <div className="flex gap-3 w-full">
              <button onClick={handleRestoreCancel} className="flex-1 py-2 rounded-md border border-gray-200 text-sm text-gray-500 hover:bg-gray-50">취소</button>
              <button onClick={handleRestoreConfirm} className="flex-1 py-2 rounded-md bg-black text-white text-sm hover:bg-gray-800">불러오기</button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <div className="sticky top-[72px] z-30 bg-white flex-shrink-0">
        <div className="max-w-4xl mx-auto w-full px-6">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()}>
                <Image src="/icons/back.svg" alt="back" width={22} height={22} />
              </button>
              <span className="text-lg font-semibold">네트워크</span>
            </div>
            <div className="flex items-center gap-2">
              {type !== "qa" && (
                <button
                  onClick={handleDraftSave}
                  disabled={draftSaving}
                  className="px-4 py-2 rounded-md text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {draftSaving && (
                    <svg className="animate-spin h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  임시저장
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-black text-white px-6 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting && (
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {submitting ? "게시 중..." : "완료"}
              </button>
            </div>
          </div>

          {/* 툴바 */}
          {editor && (
            <div className="flex items-center flex-wrap gap-1 py-2 border-t border-b border-gray-200">
              <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 hover:bg-gray-100 rounded">
                <Image src="/icons/image_upload.svg" alt="upload" width={22} height={22} />
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" multiple />

              <input
                type="color"
                onInput={(e) => editor?.chain().focus().setColor((e.target as HTMLInputElement).value).run()}
                className="w-6 h-6 border-none cursor-pointer"
              />

              <select
                value={currentFontSize}
                onChange={(e) => { setCurrentFontSize(e.target.value); editor?.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run(); }}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="24px">24</option>
              </select>

              <button onClick={() => editor.chain().focus().toggleBold().run()} className="p-3 hover:bg-gray-100 rounded"><b>B</b></button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className="p-3 hover:bg-gray-100 rounded"><i>I</i></button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="p-3 hover:bg-gray-100 rounded"><u>U</u></button>
              <button onClick={() => editor.chain().focus().toggleStrike().run()} className="p-3 hover:bg-gray-100 rounded"><s>S</s></button>
              <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-3 hover:bg-gray-100 rounded">─</button>

              <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className="p-3 hover:bg-gray-100 rounded">
                <Image src="/icons/left.svg" alt="left" width={18} height={18} />
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className="p-3 hover:bg-gray-100 rounded">
                <Image src="/icons/center.svg" alt="center" width={18} height={18} />
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className="p-3 hover:bg-gray-100 rounded">
                <Image src="/icons/right.svg" alt="right" width={18} height={18} />
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign("justify").run()} className="p-3 hover:bg-gray-100 rounded">
                <Image src="/icons/both.svg" alt="justify" width={18} height={18} />
              </button>

              <button
                onClick={() => {
                  const url = prompt("링크를 입력하세요");
                  if (!url) return;
                  editor?.chain().focus().insertContent({ type: "linkCard", attrs: { url } }).run();
                }}
                className="p-3 hover:bg-gray-100 rounded"
              >
                🔗
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 max-w-4xl mx-auto w-full pb-20">
        {/* 카테고리 */}
        <div className="mt-12 mb-4">
          <select value={category ?? ""} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2 bg-gray-100 rounded-md text-sm outline-none">
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* 제목 */}
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }}
          placeholder="제목을 입력하세요"
          className="w-full text-3xl font-normal border-b pb-4 mb-6 outline-none placeholder-gray-300"
        />

        {/* 에디터 */}
        <div
          className={`min-h-[350px] mb-8 rounded-lg border-2 border-dashed transition-colors ${
            isDraggingOver ? "border-blue-400 bg-blue-50/50" : "border-transparent"
          }`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDraggingOver(false); }}
          onDrop={handleImageDrop}
        >
          <EditorContent editor={editor} className="outline-none w-full prose max-w-none" />
        </div>

        {/* 썸네일 선택 (이미지가 1장 이상 올라가 있을 때만 표시) */}
        {newImages.length > 0 && (
          <div className="mb-10 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">썸네일 선택</p>
                <p className="text-xs text-gray-500 mt-0.5">대표 이미지로 사용할 사진을 클릭하세요.</p>
              </div>
              <p className="text-xs text-gray-400">{mainImageUrl ? "선택됨" : "미선택"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {newImages.map((img) => {
                const selected = mainImageUrl === img.url;
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setMainImageUrl(img.url)}
                    className={[
                      "relative w-20 h-20 rounded-lg overflow-hidden border-2 transition flex-shrink-0",
                      selected ? "border-[#2B7FFF] ring-2 ring-[#2B7FFF]/30" : "border-gray-200 hover:border-gray-400",
                    ].join(" ")}
                    aria-pressed={selected}
                    aria-label="썸네일로 선택"
                  >
                    {/* blob URL 은 next/image 최적화 불필요 → <img> 사용 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {selected && (
                      <span className="absolute inset-0 bg-[#2B7FFF]/20 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#2B7FFF] drop-shadow" fill="none" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="p-10">로딩...</div>}>
      <WriteContent />
    </Suspense>
  );
}
