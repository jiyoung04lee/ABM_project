"use client";

import { useEffect, useState } from "react";
import api from "@/shared/api/axios";

export function useRequireAuth(): { isReady: boolean } {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    api.get("users/me/")
      .then(() => {
        setIsReady(true);
      })
      .catch(() => {
        window.location.replace("/login");
      });
  }, []);

  return { isReady };
}