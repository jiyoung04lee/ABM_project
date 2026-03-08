"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import api from "@/shared/api/axios";
import type { SiteNoticeItem } from "@/shared/api/announcements";

export default function AnnouncementBanner() {
  const [items, setItems] = useState<SiteNoticeItem[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    api
      .get<SiteNoticeItem[] | { results: SiteNoticeItem[] }>("announcements/")
      .then((r) => {
        const raw = r.data;
        const list = Array.isArray(raw) ? raw : (raw as { results: SiteNoticeItem[] })?.results ?? [];
        setItems(list);
      })
      .catch(() => setItems([]));
  }, []);

  const visible = items.filter((n) => !dismissed.has(n.id));
  const banners = visible.filter((n) => n.notice_type === "banner");
  const notices = visible.filter((n) => n.notice_type === "notice");

  if (visible.length === 0) return null;

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      {banners.map((b) => (
        <div
          key={b.id}
          className="relative flex items-center justify-center gap-4 px-4 py-3 min-h-[48px] bg-gradient-to-r from-[#2563EB]/10 to-[#8B5CF6]/10"
        >
          {b.link ? (
            <Link href={b.link} className="flex-1 text-center font-medium text-gray-900 hover:text-[#2563EB]">
              {b.title}
              {b.content && <span className="ml-2 text-gray-600 font-normal">{b.content}</span>}
            </Link>
          ) : (
            <span className="flex-1 text-center font-medium text-gray-900">
              {b.title}
              {b.content && <span className="ml-2 text-gray-600 font-normal">{b.content}</span>}
            </span>
          )}
          <button
            type="button"
            onClick={() => setDismissed((s) => new Set(s).add(b.id))}
            className="p-1.5 rounded-lg hover:bg-black/5 text-gray-500"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      {notices.length > 0 && (
        <div className="max-w-[1200px] mx-auto px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
          <span className="font-medium text-gray-500">공지:</span>
          {notices.map((n) => (
            <span key={n.id} className="flex items-center gap-2">
              {n.link ? (
                <Link href={n.link} className="hover:text-[#2563EB]">
                  {n.title}
                </Link>
              ) : (
                <span>{n.title}</span>
              )}
              <button
                type="button"
                onClick={() => setDismissed((s) => new Set(s).add(n.id))}
                className="p-0.5 rounded hover:bg-black/5 text-gray-400"
                aria-label="닫기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
