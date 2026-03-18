"use client";

import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import React, { useRef, useCallback } from "react";

/* ─────────────────────────────────────────────
   ResizableImage NodeView (삭제 버튼 + 리사이즈 핸들 통합)
───────────────────────────────────────────────*/

type ResizableImageAttrs = {
  src?: string;
  width?: string | number | null;
  alt?: string | null;
  title?: string | null;
};

function ResizableImageComponent(props: NodeViewProps & { onDelete?: (src: string) => void }) {
  const { node, updateAttributes, deleteNode, selected, onDelete } = props;
  const attrs = node.attrs as ResizableImageAttrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dir = (e.currentTarget as HTMLElement).dataset.dir ?? "right";
      isResizing.current = true;
      startX.current = e.clientX;
      startW.current = imgRef.current?.offsetWidth ?? 300;

      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

      const onPointerMove = (moveEvt: PointerEvent) => {
        if (!isResizing.current) return;
        const delta =
          dir === "left"
            ? startX.current - moveEvt.clientX
            : moveEvt.clientX - startX.current;
        const newW = Math.max(80, startW.current + delta);
        updateAttributes({ width: `${newW}px` });
      };

      const onPointerUp = () => {
        isResizing.current = false;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    },
    [updateAttributes]
  );

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

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block relative group"
      style={{ width: typeof width === "number" ? `${width}px` : width }}
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

      {/* 삭제 버튼 - hover 또는 selected 시 표시 */}
      <button
        type="button"
        onMouseDown={handleDelete}
        className="absolute top-2 right-2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
        aria-label="이미지 삭제"
        title="이미지 삭제"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 리사이즈 핸들 - 4 코너 (투명, 넓은 터치 영역) */}
      {(
        [
          { key: "nw", pos: "top-0 left-0", cursor: "cursor-nwse-resize", dir: "left" as const },
          { key: "ne", pos: "top-0 right-0", cursor: "cursor-nesw-resize", dir: "right" as const },
          { key: "sw", pos: "bottom-0 left-0", cursor: "cursor-nesw-resize", dir: "left" as const },
          { key: "se", pos: "bottom-0 right-0", cursor: "cursor-nwse-resize", dir: "right" as const },
        ] as const
      ).map((h) => (
        <span
          key={h.key}
          data-dir={h.dir}
          onPointerDown={handleResizeStart}
          className={["absolute w-5 h-5 z-10", h.pos, h.cursor].join(" ")}
          style={{ userSelect: "none", background: "transparent" }}
        />
      ))}
    </NodeViewWrapper>
  );
}

/* ─────────────────────────────────────────────
   TipTap Extension
───────────────────────────────────────────────*/

export interface ResizableImageOptions {
  HTMLAttributes: Record<string, unknown>;
  /** 이미지 삭제 시 호출 - src를 받아서 상태 동기화에 사용 */
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
    };
  },

  addNodeView() {
    const onDelete = this.options.onDelete;
    return ReactNodeViewRenderer((props) => <ResizableImageComponent {...props} onDelete={onDelete} />);
  },
});

export default ResizableImage;
