"use client";

import { AxiosError } from "axios";
import { Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { fetchPostDetail, fetchCategories, updatePost } from "@/shared/api/network";
import { API_BASE } from "@/shared/api/api";

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

interface NewImageEntry {
  file: File;
  url: string; // blob URL
}

interface ExistingImageEntry {
  id: number;
  url: string; // 서버 URL
}

type ThumbnailSrc = string;

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

function extractImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  const re = /<img[^>]*\ssrc="([^"]+)"[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    srcs.push(m[1]);
  }
  return srcs;
}

function EditContent() {
  const router = useRouter();
  const params = useParams();
  const postId = Number(params.id);

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [postType, setPostType] = useState<NetworkType>("student");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [useRealName, setUseRealName] = useState(false);

  // 기존 서버 이미지: id + url 로 관리 (삭제 버튼 클릭 시 목록에서 제거)
  const [existingImages, setExistingImages] = useState<ExistingImageEntry[]>([]);
  // 새로 업로드하는 이미지: file + blob url 로 관리
  const [newImages, setNewImages] = useState<NewImageEntry[]>([]);
  // 썸네일: src(URL)로 추적 (서버 URL 또는 blob URL)
  const [thumbnailSrc, setThumbnailSrc] = useState<ThumbnailSrc | null>(null);
  // 최초 로딩 시점의 썸네일. 이 값과 달라질 때만 thumbnail_index를 전송(서버 불필요 재생성 방지)
  const [initialThumbnailSrc, setInitialThumbnailSrc] = useState<ThumbnailSrc | null>(null);
  // onUpdate(텍스트 입력 등)에서 썸네일이 자동 리셋되지 않도록 잠금
  // - 기본적으로는 "서버에서 복원된 대표 썸네일"을 유지
  // - 사용자가 썸네일을 삭제하면(=thumbnailSrc가 null이 되면) 잠금을 해제
  const thumbnailLockedRef = useRef(false);
  // 잠금 구간에서 onUpdate가 prev=null 타이밍에 실행돼도 유지해야 할 URL을 ref로 보관
  const lockedThumbRef = useRef<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [currentFontSize, setCurrentFontSize] = useState("16px");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // onDelete ref: 에디터 재생성 없이 항상 최신 콜백 유지
  const onDeleteRef = useRef<(src: string) => void>(() => {});
  useEffect(() => {
    onDeleteRef.current = (src: string) => {
      if (src.startsWith("blob:")) {
        // 새로 업로드한 이미지 삭제
        setNewImages((prev) => prev.filter((img) => img.url !== src));
        URL.revokeObjectURL(src);
      } else {
        // 기존 서버 이미지 삭제 (저장 시 existing_files 에서 빠짐)
        setExistingImages((prev) => prev.filter((img) => img.url !== src));
      }
      setThumbnailSrc((prev) => {
        if (prev === src) {
          thumbnailLockedRef.current = false; // 선택 이미지가 삭제되면 자동 복구를 허용
          lockedThumbRef.current = null;
          return null;
        }
        return prev;
      });
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
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      setContent(html);

      // 에디터에서 직접 삭제/이동한 이미지까지 상태 동기화
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

      setExistingImages((prev) => prev.filter((img) => srcSet.has(img.url)));
      setThumbnailSrc((prev) => {
        // 잠금 구간: prev가 아직 null이더라도 lockedThumbRef에 보관된 값을 유지
        // (setContent 직후 onUpdate 타이밍 때 prev가 null이어도 첫번째 이미지로 덮어쓰지 않음)
        if (thumbnailLockedRef.current) {
          return lockedThumbRef.current ?? prev;
        }

        if (prev && srcSet.has(prev)) return prev;
        // 서버 URL 우선, 없으면 blob 중 첫 번째
        const firstServer = orderedSrcs.find((s) => !s.startsWith("blob:"));
        const firstBlob = orderedSrcs.find((s) => s.startsWith("blob:"));
        return firstServer ?? firstBlob ?? null;
      });
    },
    onSelectionUpdate: ({ editor: e }) => {
      setCurrentFontSize(e.getAttributes("textStyle").fontSize || "16px");
    },
  });

  /* ---------------- 글 불러오기 ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const post = await fetchPostDetail(postId);
        setTitle(post.title);
        setPostType(post.type);
        setIsAnonymous(post.is_anonymous);
        setUseRealName(post.use_real_name ?? false);

        if (post.category) setCategory(String(post.category));

        // 썸네일(URL) -> 원본 이미지 URL로 매칭하기 위한 함수
        const getBaseNameFromUrl = (url: string) => {
          try {
            const u = new URL(url);
            const last = u.pathname.split("/").filter(Boolean).pop() ?? "";
            return last.replace(/\.[^.]+$/, ""); // 확장자 제거
          } catch {
            const last = url.split("/").filter(Boolean).pop() ?? "";
            return last.replace(/\.[^.]+$/, "");
          }
        };

        // 기존 이미지: { id, url } 형태로 변환
        if (post.files?.length) {
          const base = API_BASE.replace(/\/$/, "");
          const imgs: ExistingImageEntry[] = post.files
            .filter((f: { file_type: string }) => f.file_type === "image")
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order)
            .map((f: { id: number; file: string }) => {
              const raw = f.file ?? "";
              const url =
                raw.startsWith("http://") || raw.startsWith("https://")
                  ? raw
                  : raw ? `${base}${raw.startsWith("/") ? raw : `/${raw}`}` : "";
              return { id: f.id, url };
            })
            .filter((img: ExistingImageEntry) => img.url);
          setExistingImages(imgs);

          // post.thumbnail은 network/thumbnails/.../{originalBase}_thumb.jpg 이므로
          // originalBase로 환산해서 기존 imgs 중 같은 base 이름을 가진 항목을 찾습니다.
          const thumbBase = post.thumbnail
            ? getBaseNameFromUrl(post.thumbnail).replace(/_thumb$/, "")
            : null;

          const matched =
            thumbBase
              ? imgs.find((img) => getBaseNameFromUrl(img.url) === thumbBase) ?? null
              : null;

          const initialThumb = matched ? matched.url : imgs.length > 0 ? imgs[0].url : null;
          setThumbnailSrc(initialThumb);
          setInitialThumbnailSrc(initialThumb);
          // onUpdate가 React state 커밋 전에 실행돼도 올바른 값을 반환하도록 ref에도 동기 저장
          lockedThumbRef.current = initialThumb;
          thumbnailLockedRef.current = true; // 서버에서 복원된 대표 썸네일은 텍스트 수정 중 유지

          // 본문의 __BLOB_N__ 을 실제 서버 URL 로 치환
          let contentToSet = post.content ?? "";
          imgs.forEach((img: ExistingImageEntry, idx: number) => {
            contentToSet = contentToSet.replace(
              new RegExp(`src="__BLOB_${idx}__"`, "g"),
              `src="${img.url}"`
            );
          });
          setContent(contentToSet);
          if (editor) editor.commands.setContent(contentToSet);
        } else {
          setContent(post.content ?? "");
          if (editor) editor.commands.setContent(post.content ?? "");
          setThumbnailSrc(null);
          setInitialThumbnailSrc(null);
          thumbnailLockedRef.current = false;
        }

        setLoaded(true);
      } catch (err) { console.error(err); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, editor]);

  // editor 준비 후 content 재주입 (타이밍 보정)
  useEffect(() => {
    if (loaded && editor && content && !editor.getHTML().includes("<img")) {
      editor.commands.setContent(content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, editor]);

  useEffect(() => {
    (async () => {
      const cats = await fetchCategories(postType);
      setCategories(cats);
    })();
  }, [postType]);

  /* ---------------- 이미지 삽입 ---------------- */

  const addImageFiles = (fileList: FileList | File[]) => {
    if (!editor) return;
    const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      editor.chain().focus().setImage({ src: url }).createParagraphNear().run();
      setThumbnailSrc((prev) => prev ?? url);
      setNewImages((prev) => [...prev, { file, url }]);
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    addImageFiles(e.target.files);
    e.target.value = "";
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (!e.dataTransfer.files?.length) return;
    addImageFiles(e.dataTransfer.files);
    e.dataTransfer.clearData();
  };

  /* ---------------- 저장 ---------------- */

  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim() || !content.trim()) { alert("제목과 내용을 입력해주세요."); return; }
    if (!category) { alert("카테고리를 선택해주세요."); return; }

    setSubmitting(true);

    try {
      // 1) HTML에서 blob URL을 등장 순서대로 수집하면서 플레이스홀더로 교체 (순서 버그 수정)
      const orderedBlobUrls: string[] = [];
      let blobIdx = 0;
      let contentToSave = content.replace(
        /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
        (_m, before: string, blobUrl: string, after: string) => {
          orderedBlobUrls.push(blobUrl);
          return `<img${before}src="__BLOB_${blobIdx++}__"${after}>`;
        }
      );

      // 2) blob URL → File 매핑
      const blobToFile = new Map<string, File>(newImages.map((img) => [img.url, img.file]));

      const formData = new FormData();
      formData.append("type", postType);
      formData.append("title", title);
      formData.append("content", contentToSave);
      formData.append("is_anonymous", String(isAnonymous));
      formData.append("use_real_name", String(useRealName));
      formData.append("category", category);

      // 3) 유지할 기존 이미지 id 빈 배열이어도 명시적으로 전송
      if (existingImages.length > 0) {
        existingImages.forEach((img) => formData.append("existing_files", String(img.id)));
      } else {
        // 기존 이미지 전부 삭제된 경우 → clear_files로 명시
        formData.append("clear_files", "true");
      }

      // 4) 새 이미지: HTML 등장 순서대로 (순서 버그 핵심 수정)
      orderedBlobUrls.forEach((blobUrl) => {
        const file = blobToFile.get(blobUrl);
        if (file) formData.append("new_files", file);
      });

      // 5) 썸네일 인덱스 전송 
      if (thumbnailSrc) {
        const existingIdx = existingImages.findIndex((img) => img.url === thumbnailSrc);
        if (existingIdx !== -1) {
          // 기존 이미지가 썸네일
          formData.append("thumbnail_index", String(existingIdx));
        } else {
          // 새 이미지가 썸네일 — orderedBlobUrls 우선, 없으면 newImages 기준으로 fallback
          let newIdx = orderedBlobUrls.indexOf(thumbnailSrc);
          if (newIdx === -1) {
            // thumbnailSrc가 content에 없는 경우 (onUpdate 타이밍 이슈) → newImages 기준
            newIdx = newImages.findIndex((img) => img.url === thumbnailSrc);
          }
          if (newIdx !== -1) {
            formData.append("thumbnail_index", String(existingImages.length + newIdx));
          } else if (orderedBlobUrls.length > 0) {
            // 그래도 못 찾으면 새 이미지 첫 번째를 썸네일로
            formData.append("thumbnail_index", String(existingImages.length));
          }
        }
      }

      const updated = await updatePost(postId, formData);

      alert("수정 완료");
      router.push(`/network?type=${postType}`);
    } catch (err) {
      if (err instanceof AxiosError) console.error(err.response?.data);
      alert("수정 실패");
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
            <p className="text-sm font-semibold text-gray-700">수정 중입니다...</p>
          </div>
        </div>
      )}

      {/* 상단 헤더 */}
      <div className="sticky top-[72px] z-30 bg-white flex-shrink-0">
        <div className="max-w-4xl mx-auto w-full px-6">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push(`/network?type=${postType}`)}>
                <Image src="/icons/back.svg" alt="back" width={22} height={22} />
              </button>
              <span className="text-lg font-semibold">네트워크 글 수정</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-black text-white px-6 py-2 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "수정 중..." : "완료"}
            </button>
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

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 max-w-4xl mx-auto w-full pb-20">
          {/* 카테고리 */}
          <div className="mt-12 mb-4">
            <select value={category ?? ""} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2 bg-gray-100 rounded-md text-sm outline-none">
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          {/* 제목 */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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

          {/* 썸네일 선택 (수정) */}
          {(existingImages.length > 0 || newImages.length > 0) && (
            <div className="mb-10 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">썸네일 선택</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    대표 이미지로 사용할 사진을 클릭하세요.
                  </p>
                </div>
                <p className="text-xs text-gray-400">{thumbnailSrc ? "선택됨" : "미선택"}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[...existingImages.map((i) => i.url), ...newImages.map((i) => i.url)].map((src) => {
                  const selected = thumbnailSrc === src;
                  return (
                    <button
                      key={src}
                      type="button"
                      onClick={() => {
                        thumbnailLockedRef.current = true; // 사용자가 지정했으면 텍스트 입력 중 유지
                        lockedThumbRef.current = src;
                        setThumbnailSrc(src);
                      }}
                      className={[
                        "relative w-20 h-20 rounded-lg overflow-hidden border-2 transition flex-shrink-0",
                        selected ? "border-[#2B7FFF] ring-2 ring-[#2B7FFF]/30" : "border-gray-200 hover:border-gray-400",
                      ].join(" ")}
                      aria-pressed={selected}
                      aria-label="썸네일로 선택"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      {selected && (
                        <span className="absolute left-1.5 top-1.5 text-[11px] font-semibold text-white bg-[#2B7FFF] px-2 py-0.5 rounded">
                          썸네일
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
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="p-10">로딩...</div>}>
      <EditContent />
    </Suspense>
  );
}
