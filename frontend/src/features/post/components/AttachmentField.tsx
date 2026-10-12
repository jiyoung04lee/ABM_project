"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Attachment {
  key: string;
  kind: "image" | "pdf";
  name: string;
  // 브라우저가 그릴 수 없는 HEIC 등은 null (파일 이름으로 표시)
  previewUrl: string | null;
  file?: File;
  existingId?: number;
}

export interface ExistingPostFile {
  id: number;
  file: string;
  file_type: string;
}

// 크롬·파이어폭스는 HEIC를 그리지 못한다. 서버가 업로드 시 JPEG로 바꿔 저장한다
const isHeic = (name: string) => /\.(heic|heif)$/i.test(name);
const isPdf = (file: File) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name);

const fileNameFromUrl = (url: string) => {
  const last = url.split("?")[0].split("/").pop() ?? url;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
};

export function toExistingAttachments(files: ExistingPostFile[]): Attachment[] {
  return files.map((f) => {
    const kind = f.file_type === "pdf" ? "pdf" : "image";
    return {
      key: `existing-${f.id}`,
      kind,
      name: fileNameFromUrl(f.file),
      previewUrl: kind === "image" ? f.file : null,
      existingId: f.id,
    };
  });
}

const firstImageKey = (list: Attachment[]) =>
  list.find((a) => a.kind === "image")?.key ?? null;

/** 첨부파일 목록 + 대표 이미지 상태. 글쓰기·글 수정이 같이 쓴다. */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [mainKey, setMainKey] = useState<string | null>(null);
  const seq = useRef(0);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const reset = useCallback((list: Attachment[], main?: string | null) => {
    setAttachments(list);
    setMainKey(main ?? firstImageKey(list));
  }, []);

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const added: Attachment[] = Array.from(fileList).map((file) => {
      const kind = isPdf(file) ? "pdf" : "image";
      let previewUrl: string | null = null;
      if (kind === "image" && !isHeic(file.name)) {
        previewUrl = URL.createObjectURL(file);
        objectUrls.current.add(previewUrl);
      }
      seq.current += 1;
      return { key: `new-${seq.current}`, kind, name: file.name, previewUrl, file };
    });
    if (!added.length) return;

    setAttachments((prev) => [...prev, ...added]);
    setMainKey((prev) => prev ?? firstImageKey(added));
  }, []);

  const remove = (key: string) => {
    const target = attachments.find((a) => a.key === key);
    if (target?.file && target.previewUrl) {
      URL.revokeObjectURL(target.previewUrl);
      objectUrls.current.delete(target.previewUrl);
    }
    const next = attachments.filter((a) => a.key !== key);
    setAttachments(next);
    // 대표 이미지를 지우면 남은 첫 번째 이미지가 대표가 된다
    if (mainKey === key) setMainKey(firstImageKey(next));
  };

  const selectMain = (key: string) => setMainKey(key);

  /** 서버의 thumbnail_index: 저장된 순서 기준 이미지들 중 대표 이미지의 위치 */
  const mainImageIndex = (() => {
    const index = attachments
      .filter((a) => a.kind === "image")
      .findIndex((a) => a.key === mainKey);
    return index === -1 ? null : index;
  })();

  return { attachments, mainKey, mainImageIndex, addFiles, remove, selectMain, reset };
}

interface Props {
  attachments: Attachment[];
  mainKey: string | null;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (key: string) => void;
  onSelectMain: (key: string) => void;
}

export default function AttachmentField({
  attachments,
  mainKey,
  onAdd,
  onRemove,
  onSelectMain,
}: Props) {
  return (
    <div className="mb-8">
      <label className="block text-sm mb-3 text-[#6A7282]">
        첨부파일 (이미지, PDF)
      </label>

      <label
        htmlFor="fileUpload"
        className="border-2 border-dashed border-[#E5E7EB] rounded-xl py-12 flex flex-col items-center justify-center text-[#6A7282] cursor-pointer"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onAdd(e.dataTransfer.files);
            e.dataTransfer.clearData();
          }
        }}
      >
        <input
          type="file"
          multiple
          accept="image/*,.heic,.heif,application/pdf"
          onChange={(e) => {
            if (e.target.files) onAdd(e.target.files);
            // 같은 파일을 지웠다가 다시 고를 수 있도록 비운다
            e.target.value = "";
          }}
          className="hidden"
          id="fileUpload"
        />
        <img src="/icons/upload.svg" alt="upload" className="w-10 h-10" />
        <p className="mt-4 text-sm">클릭하여 파일 업로드</p>
        <p className="text-xs mt-1">이미지(최대 20MB) 또는 PDF 파일(최대 10MB)</p>
      </label>

      {/* 미리보기 + 대표 선택 + 삭제 */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mt-6">
          {attachments.map((item) => {
            const isMain = item.key === mainKey;
            return (
              <div
                key={item.key}
                onClick={() => item.kind === "image" && onSelectMain(item.key)}
                className={`relative border-2 rounded-lg ${
                  item.kind === "image" ? "cursor-pointer" : ""
                } ${isMain ? "border-[#2B7FFF]" : "border-transparent"}`}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-24 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-24 rounded-lg bg-[#F3F4F6] flex flex-col items-center justify-center px-2 text-center">
                    <span className="text-xs font-semibold text-[#6A7282]">
                      {item.kind === "pdf" ? "PDF" : "이미지"}
                    </span>
                    <span className="mt-1 w-full truncate text-[11px] text-[#9CA3AF]">
                      {item.name}
                    </span>
                  </div>
                )}

                {isMain && (
                  <div className="absolute top-1 left-1 bg-[#2B7FFF] text-white text-xs px-2 py-0.5 rounded">
                    대표
                  </div>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.key);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded"
                >
                  삭제
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
