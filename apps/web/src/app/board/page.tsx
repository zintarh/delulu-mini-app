"use client";

import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@/components/login-screen";
import { CreateDelusionContent } from "@/components/create-delusion-content";

export default function BoardPage() {
  const { isConnected } = useAccount();
  const router = useRouter();

  if (!isConnected) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-white h-screen overflow-hidden">
      <CreateDelusionContent onClose={() => router.push("/")} />
    </div>
  );
}

