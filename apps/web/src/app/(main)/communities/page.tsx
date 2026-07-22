"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MainPage } from "@/components/main-app-header";

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

function CommunitySkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4">
          <div className="h-12 w-12 shrink-0 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded-lg bg-muted" />
            <div className="h-3 w-2/3 rounded-lg bg-muted/70" />
          </div>
          <div className="h-4 w-4 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function CommunityAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-delulu-blue/10 text-sm font-black text-delulu-blue">
      {initials}
    </div>
  );
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/community/communities");
        const json = await res.json();
        setCommunities(json.communities ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <MainPage className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6">
        <h1
          className="text-2xl font-black tracking-tight text-foreground"
        >
          Communities
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join a community and take on challenges with others.
        </p>
      </div>

      {loading ? (
        <CommunitySkeleton />
      ) : communities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-sm font-semibold text-foreground">No communities yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Check back soon.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {communities.map((c) => (
            <li key={c.id}>
              <Link
                href={`/communities/${c.slug}`}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 transition-all hover:border-delulu-blue/40 hover:shadow-sm"
              >
                <CommunityAvatar name={c.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-foreground group-hover:text-delulu-blue transition-colors">
                    {c.name}
                  </p>
                  {c.description ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.description}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">View campaigns →</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-delulu-blue" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MainPage>
  );
}
