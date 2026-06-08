"use client";

import { useEffect, useState } from "react";

export function MiniPayGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "ok" | "blocked">("checking");

  useEffect(() => {
    if (typeof window !== "undefined" && (window.ethereum as any)?.isMiniPay) {
      setStatus("ok");
    } else {
      setStatus("blocked");
    }
  }, []);

  if (status === "checking") return null;

  if (status === "blocked") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
        <img src="/icon.png" alt="Delulu" className="w-16 h-16 mb-6 rounded-2xl" />
        <h1
          className="text-3xl font-black text-[#1a1a19] mb-3"
          style={{ fontFamily: "var(--font-gloria), cursive" }}
        >
          Open in MiniPay
        </h1>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          This app is designed exclusively for MiniPay. Open it inside the MiniPay wallet to continue.
        </p>
        <a
          href="https://minipay.to/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-block rounded-full bg-[#1a1a19] px-6 py-3 text-sm font-bold text-white"
        >
          Get MiniPay
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
