"use client";

import { useEffect, useRef } from "react";
import { sendTrackEvent } from "@/shared/api/logs";
import { pushDataLayer } from "@/shared/utils/tracking";

/**
 * 글쓰기 화면 진입을 한 번만 기록한다 (쓰기 시작 대비 게시 완료율 분석용).
 * 네트워크는 글 유형(student/graduate/qa)이 바뀌면 새로 기록한다.
 */
export function useTrackWriteStart(section: "community" | "network", postType?: string) {
  const trackedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = `${section}:${postType ?? ""}`;
    if (trackedKeyRef.current === key) return;
    trackedKeyRef.current = key;
    sendTrackEvent({ event_type: "write_start", section, post_type: postType });
    pushDataLayer("write_start", { section, post_type: postType ?? "" });
  }, [section, postType]);
}
