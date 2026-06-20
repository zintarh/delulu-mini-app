"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  joined_at: string;
};

export default function CommunitiesPage() {
  const { address, authenticated } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authenticated || !address) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`/api/community/me?address=${encodeURIComponent(address)}`);
        const json = await res.json();
        setCommunities(json.communities ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [authenticated, address]);

  if (!authenticated) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm font-semibold text-foreground">Sign in to see your communities.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-foreground">My communities</h1>
      <p className="mb-6 text-sm text-muted-foreground">Campaigns you can join from each community.</p>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-delulu-blue" />
        </div>
      ) : communities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-semibold text-foreground">No communities yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask your organizer for an invite link.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {communities.map((c) => (
            <li key={c.id}>
              <Link
                href={`/communities/${c.slug}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 hover:border-delulu-blue/30 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-delulu-blue-light text-delulu-blue font-bold">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">View campaigns</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
