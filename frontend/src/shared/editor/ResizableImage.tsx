"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import React, { useRef, useCallback, useEffect } from "react";

/* ─────────────────────────────────────────────
   ResizableImage NodeView (삭제 버튼 + 리사이즈 핸들 통합)
───────────────────────────────────────────────*/

interface ResizableImageComponentProps {
  node: {
    attrs: { src: string; width?: string | number; alt?: string; title?: string };
  };
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
  selected: boolean;
}

function ResizableImageComponent({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: ResizableImageComponentProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      startX.current = e.clientX;
      startW.current = imgRef.current?.offsetWidth ?? 300;

      const onMouseMove = (moveEvt: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = moveEvt.clientX - startX.current;
        const newW = Math.max(80, startW.current + delta);
        updateAttributes({ width: `${newW}px` });
      };

      const onMouseUp = () => {
        isResizing.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [updateAttributes]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode]
  );

  const width = node.attrs.width ?? "auto";

  return (
    <NodeViewWrapper
      as="span"
      className="inline-block relative group"
      style={{ width: typeof width === "number" ? `${width}px` : width }}
      data-drag-handle
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        title={node.attrs.title ?? ""}
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

      {/* 리사이즈 핸들 - 우하단 */}
      {selected && (
        <span
          onMouseDown={handleResizeStart}
          className="absolute bottom-1 right-1 w-4 h-4 bg-white border-2 border-[#2B7FFF] rounded-sm cursor-se-resize z-10"
          style={{ userSelect: "none" }}
        />
      )}
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

const ResizableImage = Node.create<ResizableImageOptions>({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onDelete: undefined,
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "img[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addNodeView() {
    const onDelete = this.options.onDelete;

    return ReactNodeViewRenderer((props: ResizableImageComponentProps) => {
      const wrappedDeleteNode = () => {
        const src = props.node.attrs.src as string;
        if (onDelete) onDelete(src);
        props.deleteNode();
      };

      return (
        <ResizableImageComponent
          {...props}
          deleteNode={wrappedDeleteNode}
        />
      );
    });
  },
});

export default ResizableImage;
