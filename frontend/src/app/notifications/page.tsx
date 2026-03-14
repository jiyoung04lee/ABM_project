"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import api from "@/shared/api/axios";
import Image from "next/image";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 6;

// 시간 포맷팅 함수 (10분 전, 1시간 전 등)
const formatRelativeTime = (dateString: string) => {
  const now = new Date();
  const past = new Date(dateString);
  const diffInMs = now.getTime() - past.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMinutes < 1) return "방금 전";
  if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  return `${diffInDays}일 전`;
};

interface Notification {
  id: number;
  type: string;
  display_message: string;
  redirect_url: string | null;
  is_read: boolean;
  created_at: string;
}

function NotificationsPageContent() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextPageNum, setNextPageNum] = useState<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (page: number = 1) => {
    const isFirst = page === 1;
    if (isFirst) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await api.get("notifications/", {
        params: { page_size: PAGE_SIZE, page },
      });
      const data = res.data?.results ?? res.data;
      const list = Array.isArray(data) ? data : [];
      const hasNext = !!res.data?.next;
      if (isFirst) {
        setNotifications(list);
      } else {
        setNotifications((prev) => [...prev, ...list]);
      }
      setNextPageNum(hasNext ? page + 1 : null);
    } catch (err) {
      console.error("알림 불러오기 실패", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const loadMore = useCallback(() => {
    if (nextPageNum == null || loadingMore) return;
    fetchNotifications(nextPageNum);
  }, [nextPageNum, loadingMore, fetchNotifications]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || nextPageNum == null || loadingMore) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 80) {
      loadMore();
    }
  }, [nextPageNum, loadingMore, loadMore]);

  const handleClick = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await api.patch(`notifications/${notification.id}/read/`);
      }
      if (notification.redirect_url) {
        router.push(notification.redirect_url);
      }
    } catch (err) {
      console.error("읽음 처리 실패", err);
    }
  };

  const handleReadAll = async () => {
    try {
      await api.patch("notifications/read_all/");
      fetchNotifications(1);
    } catch (err) {
      console.error("전체 읽음 실패", err);
    }
  };

  const getIconPath = (type: string) => {
    if (type.includes("LIKE")) return "/icons/like_white.svg";
    if (type.includes("COMMENT")) return "/icons/comment_white.svg";
    return "/icons/bell_white.svg";
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-50 flex items-center justify-center">
        <div className="p-10 text-center bg-white rounded-3xl shadow-lg">
          로딩중...
        </div>
      </div>
    );

  return (
    <div className="w-full py-6">
      <div className="max-w-5xl mx-auto w-full px-4 text-left">
        <div className="flex justify-between items-end mb-6">
          <h1 className="text-4xl font-bold text-gray-900">알림</h1>
          <button
            onClick={handleReadAll}
            className="text-[15px] text-[#2B7FFF] font-medium hover:underline"
          >
            모두 읽음으로 표시
          </button>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-y-auto max-h-[70vh]"
        >
          {notifications.length === 0 ? (
            <div className="p-20 text-center text-gray-400">
              새로운 알림이 없습니다.
            </div>
          ) : (
            <>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleClick(notification)}
                  className={`px-10 py-6 flex items-center gap-5 cursor-pointer transition relative
                  ${!notification.is_read ? "bg-[#F8FAFF]" : "bg-white"} 
                  hover:bg-gray-50 border-b border-gray-100 last:border-none`}
                >
                  <div className="w-12 h-12 bg-[#2B7FFF] rounded-full flex items-center justify-center flex-shrink-0">
                    <Image
                      src={getIconPath(notification.type)}
                      alt="icon"
                      width={22}
                      height={22}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="text-[17px] font-medium text-gray-800 leading-snug">
                      {notification.display_message}
                    </div>
                    <div className="text-[14px] text-gray-400 mt-1.5 font-normal">
                      {formatRelativeTime(notification.created_at)}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 bg-[#2B7FFF] rounded-full absolute right-8 top-1/2 -translate-y-1/2" />
                  )}
                </div>
              ))}
              {loadingMore && (
                <div className="py-4 text-center text-[14px] text-gray-400">
                  불러오는 중...
                </div>
              )}
              {nextPageNum != null && !loadingMore && (
                <div className="py-2 text-center text-[13px] text-gray-400">
                  아래로 스크롤하면 더 보기
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">로딩중...</div>}>
      <NotificationsPageContent />
    </Suspense>
  );
}