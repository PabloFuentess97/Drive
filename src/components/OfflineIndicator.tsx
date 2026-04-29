"use client";

import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setOnline(navigator.onLine);
    const goOn = () => setOnline(true);
    const goOff = () => setOnline(false);
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => {
      window.removeEventListener("online", goOn);
      window.removeEventListener("offline", goOff);
    };
  }, []);

  if (online) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-full bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-lg">
      You are offline · showing cached content
    </div>
  );
}
