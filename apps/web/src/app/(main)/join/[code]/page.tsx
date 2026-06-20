"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function JoinCommunityPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { address, authenticated } = useAuth();
  const [status, setStatus] = useState<"idle" | "joining" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [communityName, setCommunityName] = useState("");

  useEffect(() => {
    if (!authenticated || !address || status !== "idle") return;

    const join = async () => {
      setStatus("joining");
      try {
        const res = await fetch("/api/community/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: address, inviteCode: params.code }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          setCommunityName(json.community?.name ?? "the community");
          setStatus("success");
          const slug = json.community?.slug;
          setTimeout(() => router.replace(slug ? `/communities/${slug}` : "/communities"), 2500);
        } else {
          setMessage(json.error ?? "Failed to join.");
          setStatus("error");
        }
      } catch {
        setMessage("Something went wrong. Try again.");
        setStatus("error");
      }
    };

    void join();
  }, [authenticated, address, params.code, status, router]);

  if (!authenticated) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
        <p className="text-sm font-semibold" style={{ color: "#1a1a19" }}>
          Connect your wallet to join this community.
        </p>
        <p className="text-xs" style={{ color: "#6b7280" }}>
          Sign in from the home page, then visit this link again.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 gap-4">
      {(status === "idle" || status === "joining") && (
        <>
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#2563eb" }} />
          <p className="text-sm font-semibold" style={{ color: "#1a1a19" }}>Joining community…</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle className="h-10 w-10" style={{ color: "#16a34a" }} />
          <p className="text-base font-bold" style={{ color: "#1a1a19" }}>
            You joined {communityName}!
          </p>
          <p className="text-xs" style={{ color: "#6b7280" }}>Redirecting you home…</p>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="h-10 w-10" style={{ color: "#ef4444" }} />
          <p className="text-sm font-semibold" style={{ color: "#1a1a19" }}>Couldn&apos;t join</p>
          <p className="text-xs" style={{ color: "#6b7280" }}>{message}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-2 text-xs font-semibold"
            style={{ color: "#2563eb" }}
          >
            Go home
          </button>
        </>
      )}
    </main>
  );
}
