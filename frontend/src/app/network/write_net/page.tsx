"use client";

import { AxiosError } from "axios";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createPost, fetchCategories } from "@/shared/api/network";

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

type NetworkType = "student" | "graduate" | "qa";

interface Category {
  id: number;
  type: NetworkType;
  name: string;
  slug: string;
}

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

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------- TipTap Editor ---------------- */

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link,
      Gapcursor,
      Dropcursor,
      TextStyle,
      Color.configure({
        types: ["textStyle"],
      }),
      ImageExtension.configure({
        inline: true,
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
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML());
    },
  });

  /* ---------------- 이미지 삽입 ---------------- */

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {

    const files = e.target.files;
    if (!files || !editor) return;

    Array.from(files).forEach((file) => {
        const url = URL.createObjectURL(file);

        editor
            .chain()
            .focus()
            .setImage({ src: url })
            .run();

        setFiles((prev) => [...prev, file]);
        setPreviewImages((prev) => [...prev, url]);
    });

    if (mainImageIndex === null) {
      setMainImageIndex(0);
    }

    e.target.value = "";
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

    const formData = new FormData();

    formData.append("type", type);
    formData.append("title", title);
    formData.append("content", content);
    formData.append("is_anonymous", "false");
    formData.append("use_real_name", String(useRealName));
    formData.append("category", category);

    files.forEach((file) => {
      formData.append("new_files", file);
    });

    if (mainImageIndex !== null) {
      formData.append("thumbnail_index", String(mainImageIndex));
    }

    try {

      setSubmitting(true);

      await createPost(formData);

      alert("작성 완료");

      router.push("/network");

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

    <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col min-h-screen">

      {/* 상단 헤더 */}

      <div className="flex items-center justify-between mb-6">

        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}>
            <Image src="/icons/back.svg" alt="back" width={22} height={22} />
          </button>
          <span className="text-lg font-semibold">네트워크</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="bg-black text-white px-6 py-2 rounded-md text-sm"
        >
          완료
        </button>

      </div>

      {/* 툴바 */}

      {editor && (

        <div className="flex items-center gap-3 border-b py-3 text-gray-700 text-sm">

          {/* 이미지 삽입 */}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 hover:bg-gray-100 rounded"
          >
            <Image
                src="/icons/upload.svg"
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

        </div>

      )}

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

      {/* 에디터 */}

      <div className="min-h-[350px] mb-10">
        <EditorContent
          editor={editor}
          className="outline-none w-full prose max-w-none"
        />
      </div>

      {/* 실명 */}
      <div className="flex items-center gap-2 mt-auto pt-4 pb-6 border-t border-gray-200">
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

  );

}

export default function WritePage() {

  return (

    <Suspense fallback={<div className="p-10">로딩...</div>}>
      <WriteContent />
    </Suspense>

  );

}