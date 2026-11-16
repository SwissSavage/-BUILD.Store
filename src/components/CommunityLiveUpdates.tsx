"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function CommunityLiveUpdates() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const stream = new EventSource("/api/community/stream");
    stream.onopen = refresh;
    stream.onmessage = refresh;
    document.addEventListener("visibilitychange", refresh);
    // Catch up if the database listener is reconnecting or the network drops.
    const timer = setInterval(refresh, 30_000);
    return () => {
      stream.close();
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
