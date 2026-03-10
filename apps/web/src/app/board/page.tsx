"use client";

import { useRouter } from "next/navigation";
import { CreateDelusionContent } from "@/components/create-delusion-content";

export default function BoardPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background h-screen overflow-hidden">
      <CreateDelusionContent onClose={() => router.push("/")} />
    </div>
  );
}

