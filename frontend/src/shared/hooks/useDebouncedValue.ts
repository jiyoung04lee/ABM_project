"use client";

import { useEffect, useState } from "react";

/** 입력이 delayMs 동안 멈췄을 때의 값을 돌려준다 (검색어 입력 중 요청·로그 폭주 방지). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
