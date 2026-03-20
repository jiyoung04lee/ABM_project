"use client";

import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const update = (matches: boolean) => {
      setIsMobile(matches);
    };

    update(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      update(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}