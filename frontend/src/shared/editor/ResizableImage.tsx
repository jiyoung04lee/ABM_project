"use client";

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   ResizableImage NodeView (삭제 버튼 + 리사이즈 + 정렬 툴바 통합)
───────────────────────────────────────────────*/

type AlignValue = "left" | "center" | "right";

type ResizableImageAttrs = {
  src?: string;
  width?: string | number | null;
  alt?: string | null;
  title?: string | null;
  align?: AlignValue | null;
};

/* ── 정렬 SVG 아이콘 ── */
function IconAlignLeft({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={active ? "#000" : "#e5e7eb"} strokeWidth="1.6" strokeLinecap="round">
      <line x1="1" y1="3" x2="13" y2="3" />
      <line x1="1" y1="6" x2="9" y2="6" />
      <line x1="1" y1="9" x2="13" y2="9" />
      <line x1="1" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconAlignCenter({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={active ? "#000" : "#e5e7eb"} strokeWidth="1.6" strokeLinecap="round">
      <line x1="1" y1="3" x2="13" y2="3" />
      <line x1="3" y1="6" x2="11" y2="6" />
      <line x1="1" y1="9" x2="13" y2="9" />
      <line x1="3" y1="12" x2="11" y2="12" />
    </svg>
  );
}

function IconAlignRight({ active }: { active: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={active ? "#000" : "#e5e7eb"} strokeWidth="1.6" strokeLinecap="round">
      <line x1="1" y1="3" x2="13" y2="3" />
      <line x1="5" y1="6" x2="13" y2="6" />
      <line x1="1" y1="9" x2="13" y2="9" />
      <line x1="5" y1="12" x2="13" y2="12" />
    </svg>
  );
}

/* ── 코너 핸들 ── */
const HANDLES = [
  { key: "nw", cls: "top-0 left-0", cursor: "cursor-nwse-resize", dir: "left"  as const },
  { key: "ne", cls: "top-0 right-0", cursor: "cursor-nesw-resize", dir: "right" as const },
  { key: "sw", cls: "bottom-0 left-0", cursor: "cursor-nesw-resize", dir: "left"  as const },
  { key: "se", cls: "bottom-0 right-0", cursor: "cursor-nwse-resize", dir: "right" as const },
] as const;

/* ── 컴포넌트 ── */
function ResizableImageComponent(props: NodeViewProps & { onDelete?: (src: string) => void }) {
  const { node, updateAttributes, deleteNode, selected, onDelete } = props;
  const attrs = node.attrs as ResizableImageAttrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  /* 정렬 */
  const handleAlign = useCallback(
    (a: AlignValue) => { updateAttributes({ align: a }); },
    [updateAttributes]
  );

  /* 리사이즈 */
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = (e.currentTarget as HTMLElement).dataset.dir ?? "right";
      isResizing.current = true;
      startX.current = e.clientX;
      startW.current = imgRef.current?.offsetWidth ?? 300;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

      const onMove = (mv: PointerEvent) => {
        if (!isResizing.current) return;
        const delta = dir === "left"
          ? startX.current - mv.clientX
          : mv.clientX - startX.current;
        updateAttributes({ width: `${Math.max(80, startW.current + delta)}px` });
      };
      const onUp = () => {
        isResizing.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [updateAttributes]
  );

  /* 삭제 */
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const src = String(attrs.src ?? "");
      if (src && onDelete) onDelete(src);
      deleteNode();
    },
    [deleteNode, onDelete, attrs.src]
  );

  const width = attrs.width ?? "auto";
  const align: AlignValue = attrs.align ?? "left";

  /* 정렬에 따라 컨테이너 정렬 */
  const justifyContent =
    align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  return (
    <NodeViewWrapper
      as="div"
      className="relative group w-full"
      style={{ display: "flex", justifyContent }}
    >
      {/* 이미지 래퍼 (핸들/툴바는 이 안에 배치) */}
      <div
        className="relative inline-block"
        style={{ width: typeof width === "number" ? `${width}px` : width, maxWidth: "100%" }}
      >
        <img
          ref={imgRef}
          src={String(attrs.src ?? "")}
          alt={String(attrs.alt ?? "")}
          title={String(attrs.title ?? "")}
          style={{
            width: "100%",
            display: "block",
            outline: selected ? "2px solid #2B7FFF" : "none",
            borderRadius: 4,
          }}
          draggable={false}
        />

        {/* 삭제 버튼 */}
        <button
          type="button"
          onMouseDown={handleDelete}
          className="absolute top-2 right-2 z-20 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
          aria-label="이미지 삭제"
          title="이미지 삭제"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 정렬 툴바 (선택 시 이미지 상단 중앙) */}
        <div
          className={[
            "absolute -top-9 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 px-2 py-1 rounded-full bg-black/75 shadow-md transition-all duration-150",
            selected ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
          ].join(" ")}
        >
          {(
            [
              { value: "left"   as const, Icon: IconAlignLeft   },
              { value: "center" as const, Icon: IconAlignCenter },
              { value: "right"  as const, Icon: IconAlignRight  },
            ]
          ).map(({ value, Icon }) => (
            <button
              key={value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleAlign(value); }}
              className={[
                "w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                align === value ? "bg-white" : "hover:bg-white/15",
              ].join(" ")}
              title={value === "left" ? "왼쪽 정렬" : value === "center" ? "가운데 정렬" : "오른쪽 정렬"}
            >
              <Icon active={align === value} />
            </button>
          ))}
        </div>

        {/* 리사이즈 핸들 - 4 코너 (hover 시 연한 점 표시, 터치 영역 넉넉) */}
        {HANDLES.map((h) => (
          <span
            key={h.key}
            data-dir={h.dir}
            onPointerDown={handleResizeStart}
            className={[
              "absolute w-8 h-8 z-20",
              h.cls,
              h.cursor,
              "flex items-center justify-center",
            ].join(" ")}
            style={{ userSelect: "none" }}
          >
            {/* 실제 눈에 보이는 작은 점 */}
            <span
              className={[
                "w-2.5 h-2.5 rounded-full bg-white border-2 border-[#2B7FFF] transition-opacity",
                selected ? "opacity-100" : "opacity-0 group-hover:opacity-80",
              ].join(" ")}
              style={{ pointerEvents: "none" }}
            />
          </span>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

/* ─────────────────────────────────────────────
   TipTap Extension
───────────────────────────────────────────────*/

export interface ResizableImageOptions {
  HTMLAttributes: Record<string, unknown>;
  onDelete?: (src: string) => void;
}

const ResizableImage = Image.extend<ResizableImageOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {},
      onDelete: undefined,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null },
      // align 속성 등록 - 없으면 저장/로드 시 값이 유지되지 않는다
      align: {
        default: "left",
        parseHTML: (el) => el.getAttribute("data-align") ?? "left",
        renderHTML: (attrs) =>
          attrs.align ? { "data-align": attrs.align } : {},
      },
    };
  },

  addNodeView() {
    const onDelete = this.options.onDelete;
    return ReactNodeViewRenderer((props) => (
      <ResizableImageComponent {...props} onDelete={onDelete} />
    ));
  },
});

export default ResizableImage;
