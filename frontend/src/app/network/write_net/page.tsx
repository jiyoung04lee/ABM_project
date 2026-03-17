"use client";

import { AxiosError } from "axios";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createPost, updatePost, fetchCategories } from "@/shared/api/network";
import { API_BASE } from "@/shared/api/api";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import ResizeImage from "tiptap-extension-resize-image";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import Placeholder from "@tiptap/extension-placeholder";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { LinkCard } from "@/features/network/ui/LinkCard";

type NetworkType = "student" | "graduate" | "qa";

interface Category {
  id: number;
  type: NetworkType;
  name: string;
  slug: string;
}

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) {
            return {};
          }

          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },
});

function WriteContent() {

  const router = useRouter();
  const sp = useSearchParams();

  const type = (sp.get("type") as NetworkType) ?? "student";

  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [useRealName, setUseRealName] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- TipTap Editor ---------------- */

  const editor = useEditor({
    extensions: [
      StarterKit,
      HorizontalRule,
      LinkCard,
      Link.configure({
        openOnClick: true,
        autolink: true,
        linkOnPaste: true,
      }),
      Gapcursor,
      Dropcursor,
      FontSize,
      Color.configure({
        types: ["textStyle"],
      }),
      ResizeImage,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: "내용을 입력하세요",
      }),
    ],

    editorProps: {
      handlePaste(view, event) {

        const text = event.clipboardData?.getData("text")

        if (text && /(https?:\/\/[^\s]+)/.test(text)) {

          event.preventDefault()

          const node = view.state.schema.nodes.linkCard.create({
            url: text
          })

          const transaction = view.state.tr.replaceSelectionWith(node)

          view.dispatch(transaction)

          return true
        }

        return false
      },
    },

    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
  });

  /* ---------------- 이미지 삽입 ---------------- */

  const addImageFiles = (fileList: FileList | File[]) => {
    if (!editor) return;
    const imageFiles = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) return;

    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      editor
        .chain()
        .focus()
        .setImage({ src: url })
        .createParagraphNear()
        .run();
      setFiles((prev) => [...prev, file]);
      setPreviewImages((prev) => [...prev, url]);
    });

    if (mainImageIndex === null) {
      setMainImageIndex(0);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    addImageFiles(fileList);
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

  /* ---------------- 카테고리 ---------------- */

  useEffect(() => {

    (async () => {

      try {

        const results = await fetchCategories(type);

        setCategories(results);

        if (results.length > 0) {
          setCategory(String(results[0].id));
        }

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

    // blob URL → 플레이스홀더로 교체 (blob URL 순서 = files 배열 순서)
    const blobUrls: string[] = [];
    const PLACEHOLDER_RE = /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>"/gi;
    let contentWithPlaceholders = content.replace(
      /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
      (_match, before, blobUrl, after) => {
        const idx = blobUrls.length;
        blobUrls.push(blobUrl);
        return `<img${before}src="__BLOB_${idx}__"${after}>`;
      }
    );
    // 실제로 사용한 void reference 방지
    void PLACEHOLDER_RE;

    const formData = new FormData();

    formData.append("type", type);
    formData.append("title", title);
    formData.append("content", contentWithPlaceholders);
    formData.append("is_anonymous", "false");
    formData.append("use_real_name", String(useRealName));
    formData.append("category", category);

    // blob URL 순서와 files 배열 순서가 동일
    files.forEach((file) => {
      formData.append("new_files", file);
    });

    if (mainImageIndex !== null) {
      formData.append("thumbnail_index", String(mainImageIndex));
    }

    try {

      setSubmitting(true);

      const created = await createPost(formData);

      // 응답의 files 배열로 플레이스홀더를 실제 절대 URL로 교체 후 PATCH
      if (blobUrls.length > 0 && created.files && created.files.length > 0) {
        const imageFiles = created.files
          .filter((f) => f.file_type === "image")
          .sort((a, b) => a.order - b.order);
        const base = API_BASE.replace(/\/$/, "");

        let fixedContent = contentWithPlaceholders;
        blobUrls.forEach((_, idx) => {
          const raw = imageFiles[idx]?.file ?? "";
          const realUrl = raw
            ? raw.startsWith("http://") || raw.startsWith("https://")
              ? raw
              : `${base}${raw.startsWith("/") ? raw : `/${raw}`}`
            : "";
          fixedContent = fixedContent.replace(
            `src="__BLOB_${idx}__"`,
            `src="${realUrl}"`
          );
        });

        // 플레이스홀더가 남아있으면(파일 매핑 실패) 제거
        fixedContent = fixedContent.replace(
          /<img[^>]*src="__BLOB_\d+__"[^>]*\/?>/gi,
          ""
        );

        const patchData = new FormData();
        patchData.append("content", fixedContent);
        created.files.forEach((f) => {
          patchData.append("existing_files", String(f.id));
        });
        await updatePost(created.id, patchData);
      }

      alert("작성 완료");

      router.push(`/network?type=${type}`);

    } catch (err) {

      if (err instanceof AxiosError) {
        console.error(err.response?.data);
      }

      alert("작성 실패");

    } finally {

      setSubmitting(false);

    }

  };

  /* ---------------- UI ---------------- */

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-xl flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-[#2B7FFF]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">게시물을 업로드하고 있습니다...</p>
          </div>
        </div>
      )}
      {/* 상단 헤더 */}
      <div className="flex-shrink-0 bg-white z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b">

          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}>
              <Image src="/icons/back.svg" alt="back" width={22} height={22} />
            </button>
            <span className="text-lg font-semibold">네트워크</span>
          </div>

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

        {/* 툴바 */}
        {editor && (
          <div className="flex items-center gap-3 px-6 py-3 border-b">
            {/* 이미지 삽입 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1 hover:bg-gray-100 rounded"
            >
              <Image
                  src="/icons/image_upload.svg"
                  alt="upload"
                  width={22}
                  height={22}
              />
            </button>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageUpload}
              className="hidden"
            />

            <input
              type="color"
              onInput={(e) =>
                  editor
                  ?.chain()
                  .focus()
                  .setColor((e.target as HTMLInputElement).value)
                  .run()
              }
              className="w-6 h-6 border-none cursor-pointer"
            />

            {/* 텍스트 스타일 */}
            <select
              onChange={(e) =>
                editor
                  ?.chain()
                  .focus()
                  .setMark("textStyle", { fontSize: e.target.value })
                  .run()
              }
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="14px">14</option>
              <option value="16px">16</option>
              <option value="18px">18</option>
              <option value="24px">24</option>
            </select>

            <button 
              onClick={() => editor.chain().focus().toggleBold().run()}
              className="p-3 hover:bg-gray-100 rounded">
              <b>B</b>
            </button>

            <button 
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className="p-3 hover:bg-gray-100 rounded">
              <i>I</i>
            </button>

            <button 
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className="p-3 hover:bg-gray-100 rounded">
              <u>U</u>
            </button>

            <button 
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className="p-3 hover:bg-gray-100 rounded">
              <s>S</s>
            </button>

            <button
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="p-3 hover:bg-gray-100 rounded"
            >
              ─
            </button>

            {/* 정렬 */}
            <button
              onClick={() => editor.chain().focus().setTextAlign("left").run()}
              className="p-3 hover:bg-gray-100 rounded"
              >
              <Image src="/icons/left.svg" alt="left" width={18} height={18} />
            </button>

            <button
              onClick={() => editor.chain().focus().setTextAlign("center").run()}
              className="p-3 hover:bg-gray-100 rounded"
              >
              <Image src="/icons/center.svg" alt="center" width={18} height={18} />
            </button>

            <button
              onClick={() => editor.chain().focus().setTextAlign("right").run()}
              className="p-3 hover:bg-gray-100 rounded"
              >
              <Image src="/icons/right.svg" alt="right" width={18} height={18} />
            </button>

            <button
              onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              className="p-3 hover:bg-gray-100 rounded"
            >
              <Image src="/icons/both.svg" alt="justify" width={18} height={18} />
            </button>

            {/* 링크 */}
            <button
            onClick={() => {
              const url = prompt("링크를 입력하세요")
              if (!url) return
              editor
                ?.chain()
                .focus()
                .insertContent({
                  type: "linkCard",
                  attrs: { url }
                })
                .run()
              }
            }
            className="p-3 hover:bg-gray-100 rounded"
          >
            🔗
          </button>

          </div>

        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 max-w-4xl mx-auto w-full pb-20">
      {/* 카테고리 */}

      <div className="mt-6 mb-4">

        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value)}
          className="px-4 py-2 bg-gray-100 rounded-md text-sm outline-none"
        >

          {categories.map((cat) => (

            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>

          ))}

        </select>

      </div>

      {/* 제목 */}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full text-3xl font-normal border-b pb-4 mb-6 outline-none placeholder-gray-300"
      />

      {/* 에디터 - 이미지 드래그 앤 드롭 지원 */}
      <div
        className={`min-h-[350px] mb-8 rounded-lg border-2 border-dashed transition-colors ${
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
        <EditorContent
          editor={editor}
          className="outline-none w-full prose max-w-none"
        />
      </div>

      {/* 실명 */}
      <div className="flex items-center gap-2 mt-24 pt-4 pb-6 border-t border-gray-200">
        <input
          type="checkbox"
          id="use-real-name"
          checked={useRealName}
          onChange={() => setUseRealName((prev) => !prev)}
          className="w-4 h-4 accent-[#2B7FFF]"
        />
        <label htmlFor="use-real-name" className="text-sm text-gray-500 cursor-pointer">
          실명으로 작성
        </label>
      </div>

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