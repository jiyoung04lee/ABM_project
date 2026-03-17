"use client";

import { AxiosError } from "axios";
import { Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  fetchPostDetail,
  fetchCategories,
  updatePost,
} from "@/shared/api/network";
import { API_BASE } from "@/shared/api/api";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import ImageExtension from "@tiptap/extension-image";
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

  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFileIds, setExistingFileIds] = useState<number[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
      ImageExtension.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: "editor-image",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: "내용을 입력하세요",
      }),
    ],

    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => {
      setContent(e.getHTML());
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const post = await fetchPostDetail(postId);
        setTitle(post.title);
        setPostType(post.type);
        setIsAnonymous(post.is_anonymous);
        setUseRealName(post.use_real_name ?? false);

        if (post.category) setCategory(String(post.category));
        if (post.files) {
          setExistingFileIds(post.files.map((f) => f.id));
        }

        let contentToSet = post.content ?? "";
        if (post.files?.length) {
          const base = API_BASE.replace(/\/$/, "");
          const imageFiles = post.files
            .filter((f: { file_type: string }) => f.file_type === "image")
            .sort((a: { order: number }, b: { order: number }) => a.order - b.order);
          imageFiles.forEach((f: { file: string }, idx: number) => {
            const raw = f.file ?? "";
            const realUrl =
              raw && (raw.startsWith("http://") || raw.startsWith("https://"))
                ? raw
                : raw
                  ? `${base}${raw.startsWith("/") ? raw : `/${raw}`}`
                  : "";
            if (realUrl)
              contentToSet = contentToSet.replace(
                new RegExp(`src="__BLOB_${idx}__"`, "g"),
                `src="${realUrl}"`
              );
          });
        }
        setContent(contentToSet);
        if (editor) {
          editor.commands.setContent(contentToSet);
        }
        setLoaded(true);
      } catch (err) {
        console.error(err);
      }
    })();
  }, [postId, editor]);

  useEffect(() => {
    if (loaded && editor && content && !editor.getHTML().includes("<img")) {
      editor.commands.setContent(content);
    }
  }, [loaded, editor]);

  useEffect(() => {
    (async () => {
      const cats = await fetchCategories(postType);
      setCategories(cats);
    })();
  }, [postType]);

  const addImageFiles = (fileList: FileList | File[]) => {
    if (!editor) return;
    const imageFiles = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) return;

    imageFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      editor.chain().focus().setImage({ src: url }).createParagraphNear().run();
      setNewFiles((prev) => [...prev, file]);
    });
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

    setSubmitting(true);

    try {
      const blobUrls: string[] = [];
      let contentToSave = content.replace(
        /<img([^>]*?)src="(blob:[^"]+)"([^>]*?)\/?>/gi,
        (_match, before, blobUrl, after) => {
          const idx = blobUrls.length;
          blobUrls.push(blobUrl);
          return `<img${before}src="__BLOB_${idx}__"${after}>`;
        }
      );

      const formData = new FormData();
      formData.append("type", postType);
      formData.append("title", title);
      formData.append("content", contentToSave);
      formData.append("is_anonymous", String(isAnonymous));
      formData.append("use_real_name", String(useRealName));
      formData.append("category", category);

      existingFileIds.forEach((id) => {
        formData.append("existing_files", String(id));
      });
      newFiles.forEach((file) => {
        formData.append("new_files", file);
      });

      const updated = await updatePost(postId, formData);

      if (blobUrls.length > 0 && updated.files && updated.files.length > 0) {
        const imageFiles = updated.files
          .filter((f: any) => f.file_type === "image")
          .sort((a: any, b: any) => a.order - b.order);
        const base = API_BASE.replace(/\/$/, "");

        const newImageFiles = imageFiles.filter(
          (f: any) => !existingFileIds.includes(f.id)
        );

        let fixedContent = contentToSave;
        blobUrls.forEach((_, idx) => {
          const raw = newImageFiles[idx]?.file ?? "";
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

        fixedContent = fixedContent.replace(
          /<img[^>]*src="__BLOB_\d+__"[^>]*\/?>/gi,
          ""
        );

        if (fixedContent !== contentToSave) {
          const patchData = new FormData();
          patchData.append("content", fixedContent);
          updated.files.forEach((f: any) => {
            patchData.append("existing_files", String(f.id));
          });
          await updatePost(postId, patchData);
        }
      }

      alert("수정 완료");
      router.push(`/network/${postId}`);
    } catch (err) {
      if (err instanceof AxiosError) console.error(err.response?.data);
      alert("수정 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen pt-0 bg-white overflow-hidden">
      
      <div className="sticky top-0 z-30 bg-white flex-shrink-0">
        <div className="max-w-4xl mx-auto w-full px-6">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={() => router.back()}>
                <Image src="/icons/back.svg" alt="back" width={22} height={22} />
              </button>
              <span className="text-lg font-semibold">네트워크 글 수정</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-black text-white px-6 py-2 rounded-md text-sm"
            >
              {submitting ? "수정 중..." : "완료"}
            </button>
          </div>

          {editor && (
            <div className="flex items-center flex-wrap gap-1 py-2 border-t border-b border-gray-200">

            {/* 이미지 업로드 */}
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

            {/* 색상 */}
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

            {/* 글씨 크기 */}
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

            {/* 텍스트 스타일 */}
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className="p-3 hover:bg-gray-100 rounded"
            >
              <b>B</b>
            </button>

            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className="p-3 hover:bg-gray-100 rounded"
            >
              <i>I</i>
            </button>

            <button
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className="p-3 hover:bg-gray-100 rounded"
            >
              <u>U</u>
            </button>

            <button
              onClick={() => editor.chain().focus().toggleStrike().run()}
              className="p-3 hover:bg-gray-100 rounded"
            >
              <s>S</s>
            </button>

            {/* 구분선 */}
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
          <div className="mt-12 mb-4">
            <select
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value)}
              className="px-4 py-2 bg-gray-100 rounded-md text-sm outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            className="w-full text-3xl font-normal border-b pb-4 mb-6 outline-none placeholder-gray-300"
          />

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
