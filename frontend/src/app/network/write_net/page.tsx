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
  url: string;
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
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 로드 실패"));
    };
    img.src = objectUrl;
  });
}

function getResizedSize(width: number, height: number, maxWidth: number, maxHeight: number) {
  let w = width;
  let h = height;

  if (w > maxWidth) {
    const r = maxWidth / w;
    w = Math.round(w * r);
    h = Math.round(h * r);
  }

  if (h > maxHeight) {
    const r = maxHeight / h;
    w = Math.round(w * r);
    h = Math.round(h * r);
  }

  return { width: w, height: h };
}

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const img = await loadImage(file);
  const { width, height } = getResizedSize(img.width, img.height, 1600, 1600);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context 생성 실패");

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.75)
  );

  if (!blob) throw new Error("이미지 압축 실패");

  const name = file.name.replace(/\.[^/.]+$/, "");

  return new File([blob], `${name}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
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

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const update = (matches: boolean) => setIsMobile(matches);
    update(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => update(event.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}

function WriteContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const type = (sp.get("type") as NetworkType) ?? "student";
  const isMobile = useIsMobile();

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [content, setContent] = useState("");

  const [newImages, setNewImages] = useState<ImageEntry[]>([]);
  const [mainImageUrl, setMainImageUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("16px");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [draftSaving, setDraftSaving] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<{
    title: string;
    content: string;
    image_ids: number[];
  } | null>(null);

  const [isMobileEditorFocused, setIsMobileEditorFocused] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const draftCheckedRef = useRef(false);
  const justSavedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalUpdateRef = useRef(false);

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

      if (isInternalUpdateRef.current) {
        isInternalUpdateRef.current = false;
        return;
      }

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

        setPendingDraft({
          title: draft.title,
          content: draft.content,
          image_ids: draft.image_ids ?? [],
        });
        setShowRestoreModal(true);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [editor, type]);

  const handleRestoreConfirm = () => {
    if (!pendingDraft || !editor) return;

    setTitle(pendingDraft.title);
    editor.commands.setContent(pendingDraft.content);
    setContent(pendingDraft.content);

    const srcs = extractImageSrcs(pendingDraft.content);
    const imageIds = pendingDraft.image_ids ?? [];

    const restoredImages = srcs
      .filter((src) => !src.startsWith("blob:"))
      .map((src, idx) => ({
        file: new File([], src),
        url: src,
        postFileId: imageIds[idx],
      }));

    setNewImages(restoredImages);
    setMainImageUrl(restoredImages[0]?.url ?? null);

    setIsDirty(false);
    setShowRestoreModal(false);
    setPendingDraft(null);
  };

  const handleRestoreCancel = () => {
    setShowRestoreModal(false);
    setPendingDraft(null);
  };

  /* ---------------- 자동저장 (debounce) ---------------- */

  useEffect(() => {
    if (type === "qa") return;
    if (!isDirty) return;
    if (!title.trim() && isContentEmpty(content)) return;

    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        let savedContent = content;
        const uploadedIds: number[] = [];

        if (content.includes('src="blob:')) {
          const blobToUrl = new Map<string, string>();
          const blobUrls: string[] = [];

          content.replace(/<img[^>]*src="(blob:[^"]+)"[^>]*\/?>/gi, (_, src) => {
            if (!blobUrls.includes(src)) blobUrls.push(src);
            return _;
          });

          const blobToFile = new Map<string, File>(newImages.map((img) => [img.url, img.file]));

          await Promise.all(
            blobUrls.map(async (blobUrl) => {
              const file = blobToFile.get(blobUrl);
              if (!file) return;

              const result = await uploadDraftImage(file);
              blobToUrl.set(blobUrl, result.url);
              uploadedIds.push(result.id);
            })
          );

          setNewImages((prev) =>
            prev.map((img) => {
              const newUrl = blobToUrl.get(img.url);
              if (!newUrl) return img;
              const id = uploadedIds[blobUrls.indexOf(img.url)];
              return { ...img, url: newUrl, postFileId: id };
            })
          );

          setMainImageUrl((prev) => {
            if (!prev) return prev;
            return blobToUrl.get(prev) ?? prev;
          });

          savedContent = content.replace(
            /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
            (_m, before, blobUrl, after) => {
              const realUrl = blobToUrl.get(blobUrl) ?? blobUrl;
              return `<img${before}src="${realUrl}"${after}>`;
            }
          );

          isInternalUpdateRef.current = true;
          if (editor) editor.commands.setContent(savedContent);
          setContent(savedContent);
        }

        const existingIds = newImages
          .filter((img) => img.postFileId)
          .map((img) => img.postFileId as number);

        await saveDraft({
          type: type as "student" | "graduate",
          title,
          content: savedContent,
          image_ids: [...existingIds, ...uploadedIds],
        });

        justSavedRef.current = true;
        setIsDirty(false);

        setTimeout(() => {
          justSavedRef.current = false;
        }, 500);

        console.log("자동저장 완료");
      } catch (e) {
        console.error("자동저장 실패", e);
      }
    }, 3000);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [title, content, isDirty, type, newImages, editor]);

  /* ---------------- 이탈 경고 ---------------- */

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !justSavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  /* ---------------- 임시저장 ---------------- */

  const executeSave = useCallback(async () => {
    if (type === "qa") return;

    if (!title.trim() && isContentEmpty(content)) {
      alert("제목과 내용을 입력해야 임시저장할 수 있습니다.");
      return;
    }

    try {
      setIsSavingDraft(true);
      setSubmitting(true);

      let savedContent = content;
      const blobToResult = new Map<string, { url: string; id: number }>();
      const uploadedIds: number[] = [];

      if (content.includes('src="blob:')) {
        const blobToUrl = new Map<string, string>();
        const blobUrls: string[] = [];

        content.replace(/<img[^>]*src="(blob:[^"]+)"[^>]*\/?>/gi, (_, src) => {
          if (!blobUrls.includes(src)) blobUrls.push(src);
          return _;
        });

        const blobToFile = new Map<string, File>(newImages.map((img) => [img.url, img.file]));

        await Promise.all(
          blobUrls.map(async (blobUrl) => {
            const file = blobToFile.get(blobUrl);
            if (!file) return;

            const result = await uploadDraftImage(file);
            blobToResult.set(blobUrl, result);
            blobToUrl.set(blobUrl, result.url);
            uploadedIds.push(result.id);
          })
        );

        setNewImages((prev) =>
          prev.map((img) => {
            const result = blobToResult.get(img.url);
            if (!result) return img;
            return { ...img, url: result.url, postFileId: result.id };
          })
        );

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
        image_ids: [...existingIds, ...uploadedIds],
      });

      justSavedRef.current = true;
      setIsDirty(false);

      setTimeout(() => {
        justSavedRef.current = false;
      }, 500);

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
      } catch (e) {
        console.error(e);
      }
    })();
  }, [type]);

  /* ---------------- 글 작성 ---------------- */

  const handleSubmit = async () => {
    if (submitting) return;

    if (!title.trim() || !content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }

    if (!category) {
      alert("카테고리를 선택해주세요.");
      return;
    }

    const orderedBlobUrls: string[] = [];
    let blobIdx = 0;

    const contentWithPlaceholders = content.replace(
      /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
      (_m, before: string, blobUrl: string, after: string) => {
        orderedBlobUrls.push(blobUrl);
        return `<img${before}src="__BLOB_${blobIdx++}__"${after}>`;
      }
    );

    const blobToFile = new Map<string, File>(newImages.map((img) => [img.url, img.file]));

    const formData = new FormData();
    formData.append("type", type);
    formData.append("title", title);
    formData.append("content", contentWithPlaceholders);
    formData.append("is_anonymous", "false");
    formData.append("use_real_name", "false");
    formData.append("category", category);

    orderedBlobUrls.forEach((blobUrl) => {
      const file = blobToFile.get(blobUrl);
      if (file) formData.append("new_files", file);
    });

    newImages
      .filter((img) => !img.url.startsWith("blob:") && img.postFileId)
      .forEach((img) => formData.append("existing_files", String(img.postFileId)));

    if (mainImageUrl !== null) {
      if (mainImageUrl.startsWith("blob:")) {
        const existingCount = newImages.filter(
          (img) => !img.url.startsWith("blob:") && img.postFileId
        ).length;

        const thumbIdx = orderedBlobUrls.indexOf(mainImageUrl);
        if (thumbIdx !== -1) {
          formData.append("thumbnail_index", String(existingCount + thumbIdx));
        }
      } else {
        const existingImgs = newImages.filter(
          (img) => !img.url.startsWith("blob:") && img.postFileId
        );

        const thumbExistingIdx = existingImgs.findIndex((img) => img.url === mainImageUrl);

        if (thumbExistingIdx !== -1) {
          formData.append("thumbnail_index", String(thumbExistingIdx));
        }
      }
    }

    try {
      setIsSavingDraft(false);
      setSubmitting(true);
      await createPost(formData);

      if (type !== "qa") {
        try {
          await deleteDraft(type as "student" | "graduate");
        } catch (e) {
          console.error("draft 삭제 실패 (무시)", e);
        }
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

  /* ---------------- 모바일 키보드 감지 ---------------- */

  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;

    const updateKeyboardState = () => {
      const viewportHeight = vv.height;
      const fullHeight = window.innerHeight;
      const diff = fullHeight - viewportHeight - vv.offsetTop;
      const open = diff > 120;

      setIsKeyboardOpen(open);
      setKeyboardOffset(open ? Math.max(diff, 0) : 0);
    };

    updateKeyboardState();

    vv.addEventListener("resize", updateKeyboardState);
    vv.addEventListener("scroll", updateKeyboardState);

    return () => {
      vv.removeEventListener("resize", updateKeyboardState);
      vv.removeEventListener("scroll", updateKeyboardState);
    };
  }, [isMobile]);

  const desktopView = (
    <div className="flex flex-col h-screen pt-[1px] bg-white">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-xl">
            <svg className="h-8 w-8 animate-spin text-[#2B7FFF]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-semibold text-gray-700">
              {isSavingDraft ? "임시저장 중입니다..." : "게시물을 업로드하고 있습니다..."}
            </p>
          </div>
        </div>
      )}

      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex min-w-[280px] flex-col items-center gap-4 rounded-2xl bg-white px-8 py-7 shadow-xl">
            <p className="text-center text-sm font-semibold text-gray-800">
              임시저장된 글이 있습니다.
              <br />
              불러올까요?
            </p>
            <div className="flex w-full gap-3">
              <button
                onClick={handleRestoreCancel}
                className="flex-1 rounded-md border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 rounded-md bg-black py-2 text-sm text-white hover:bg-gray-800"
              >
                불러오기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-[72px] z-30 flex-shrink-0 bg-white">
        <div className="mx-auto w-full max-w-4xl px-6">
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
                  className="flex items-center gap-1.5 rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-500 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {draftSaving && (
                    <svg className="h-3.5 w-3.5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  임시저장
                </button>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-md bg-black px-6 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && (
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                )}
                {submitting ? "게시 중..." : "완료"}
              </button>
            </div>
          </div>

          {editor && (
            <div className="flex flex-wrap items-center gap-1 border-y border-gray-200 py-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded px-2 py-1 hover:bg-gray-100"
              >
                <Image src="/icons/image_upload.svg" alt="upload" width={22} height={22} />
              </button>

              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                multiple
              />

              <input
                type="color"
                onInput={(e) =>
                  editor?.chain().focus().setColor((e.target as HTMLInputElement).value).run()
                }
                className="h-6 w-6 cursor-pointer border-none"
              />

              <select
                value={currentFontSize}
                onChange={(e) => {
                  setCurrentFontSize(e.target.value);
                  editor?.chain().focus().setMark("textStyle", { fontSize: e.target.value }).run();
                }}
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="14px">14</option>
                <option value="16px">16</option>
                <option value="18px">18</option>
                <option value="24px">24</option>
              </select>

              <button onClick={() => editor.chain().focus().toggleBold().run()} className="rounded p-3 hover:bg-gray-100">
                <b>B</b>
              </button>
              <button onClick={() => editor.chain().focus().toggleItalic().run()} className="rounded p-3 hover:bg-gray-100">
                <i>I</i>
              </button>
              <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="rounded p-3 hover:bg-gray-100">
                <u>U</u>
              </button>
              <button onClick={() => editor.chain().focus().toggleStrike().run()} className="rounded p-3 hover:bg-gray-100">
                <s>S</s>
              </button>
              <button onClick={() => editor.chain().focus().setHorizontalRule().run()} className="rounded p-3 hover:bg-gray-100">
                ─
              </button>

              <button onClick={() => editor.chain().focus().setTextAlign("left").run()} className="rounded p-3 hover:bg-gray-100">
                <Image src="/icons/left.svg" alt="left" width={18} height={18} />
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign("center").run()} className="rounded p-3 hover:bg-gray-100">
                <Image src="/icons/center.svg" alt="center" width={18} height={18} />
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign("right").run()} className="rounded p-3 hover:bg-gray-100">
                <Image src="/icons/right.svg" alt="right" width={18} height={18} />
              </button>
              <button onClick={() => editor.chain().focus().setTextAlign("justify").run()} className="rounded p-3 hover:bg-gray-100">
                <Image src="/icons/both.svg" alt="justify" width={18} height={18} />
              </button>

              <button
                onClick={() => {
                  const url = prompt("링크를 입력하세요");
                  if (!url) return;
                  editor?.chain().focus().insertContent({ type: "linkCard", attrs: { url } }).run();
                }}
                className="rounded p-3 hover:bg-gray-100"
              >
                🔗
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto flex-1 w-full max-w-4xl overflow-y-auto px-6 pb-20">
        <div className="mb-4 mt-12">
          <select
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          placeholder="제목을 입력하세요"
          className="mb-6 w-full border-b pb-4 text-3xl font-normal outline-none placeholder-gray-300"
        />

        <div
          className={`mb-8 min-h-[350px] rounded-lg border-2 border-dashed transition-colors ${
            isDraggingOver ? "border-blue-400 bg-blue-50/50" : "border-transparent"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
          }}
          onDrop={handleImageDrop}
        >
          <EditorContent editor={editor} className="prose w-full max-w-none outline-none" />
        </div>

        {newImages.length > 0 && (
          <div className="mb-10 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">썸네일 선택</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  대표 이미지로 사용할 사진을 클릭하세요.
                </p>
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
                      "relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition",
                      selected
                        ? "border-[#2B7FFF] ring-2 ring-[#2B7FFF]/30"
                        : "border-gray-200 hover:border-gray-400",
                    ].join(" ")}
                    aria-pressed={selected}
                    aria-label="썸네일로 선택"
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-[#2B7FFF]/20">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6 text-[#2B7FFF] drop-shadow"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
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

  const mobileView = (
    <div className="flex min-h-screen flex-col bg-white md:hidden">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-xl">
            <svg className="h-8 w-8 animate-spin text-[#2B7FFF]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-sm font-semibold text-gray-700">
              {isSavingDraft ? "임시저장 중입니다..." : "게시물을 업로드하고 있습니다..."}
            </p>
          </div>
        </div>
      )}

      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="flex min-w-[280px] flex-col items-center gap-4 rounded-2xl bg-white px-8 py-7 shadow-xl">
            <p className="text-center text-sm font-semibold text-gray-800">
              임시저장된 글이 있습니다.
              <br />
              불러올까요?
            </p>
            <div className="flex w-full gap-3">
              <button
                onClick={handleRestoreCancel}
                className="flex-1 rounded-md border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 rounded-md bg-black py-2 text-sm text-white hover:bg-gray-800"
              >
                불러오기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <button onClick={() => router.back()} className="text-sm text-gray-600">
            취소
          </button>

          <span className="text-base font-semibold">네트워크</span>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitting ? "게시 중..." : "완료"}
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 pb-32 pt-4">
        <div className="mb-4 flex items-center gap-2">
          <select
            value={category ?? ""}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-md bg-gray-100 px-4 text-sm outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-10 rounded-md bg-gray-100 px-4 text-sm text-gray-700"
          >
            이미지
          </button>

          {type !== "qa" && (
            <button
              type="button"
              onClick={handleDraftSave}
              disabled={draftSaving}
              className="h-10 rounded-md bg-gray-100 px-4 text-sm text-gray-700 disabled:opacity-50"
            >
              임시저장
            </button>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageUpload}
          className="hidden"
          multiple
        />

        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setIsDirty(true);
          }}
          onFocus={() => setIsMobileEditorFocused(true)}
          onBlur={() => {
            setTimeout(() => {
              if (!editor?.isFocused) setIsMobileEditorFocused(false);
            }, 100);
          }}
          placeholder="제목을 입력하세요"
          className="mb-5 w-full border-b pb-4 text-[28px] font-normal outline-none placeholder-gray-300"
        />

        <div
          className={`mb-8 min-h-[320px] rounded-lg border-2 border-dashed transition-colors ${
            isDraggingOver ? "border-blue-400 bg-blue-50/50" : "border-transparent"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
          }}
          onDrop={handleImageDrop}
        >
          <div
            onClick={() => {
              editor?.commands.focus();
              setIsMobileEditorFocused(true);
            }}
            onFocus={() => setIsMobileEditorFocused(true)}
            onBlur={() => {
              setTimeout(() => {
                if (!editor?.isFocused) setIsMobileEditorFocused(false);
              }, 100);
            }}
          >
            <EditorContent editor={editor} className="prose w-full max-w-none outline-none" />
          </div>
        </div>

        {newImages.length > 0 && (
          <div className="mb-10 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">썸네일 선택</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  대표 이미지로 사용할 사진을 클릭하세요.
                </p>
              </div>
              <p className="text-xs text-gray-400">{mainImageUrl ? "선택됨" : "미선택"}</p>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
              {newImages.map((img) => {
                const selected = mainImageUrl === img.url;

                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setMainImageUrl(img.url)}
                    className={[
                      "relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition",
                      selected
                        ? "border-[#2B7FFF] ring-2 ring-[#2B7FFF]/30"
                        : "border-gray-200 hover:border-gray-400",
                    ].join(" ")}
                    aria-pressed={selected}
                    aria-label="썸네일로 선택"
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                    {selected && (
                      <span className="absolute inset-0 flex items-center justify-center bg-[#2B7FFF]/20">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-6 w-6 text-[#2B7FFF] drop-shadow"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
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

      {editor && isMobileEditorFocused && isKeyboardOpen && (
        <div
          className="fixed left-0 right-0 z-40 border-t bg-white px-3 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
          style={{ bottom: `${keyboardOffset}px` }}
        >
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              이미지
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                editor.isActive("bold") ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              B
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                editor.isActive("underline") ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              U
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const url = prompt("링크를 입력하세요");
                if (!url) return;
                editor.chain().focus().insertContent({ type: "linkCard", attrs: { url } }).run();
              }}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              링크
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              좌
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              중
            </button>

            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className="shrink-0 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              우
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return isMobile ? mobileView : desktopView;
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="p-10">로딩...</div>}>
      <WriteContent />
    </Suspense>
  );
}