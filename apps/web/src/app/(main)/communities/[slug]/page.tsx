"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, Target } from "lucide-react";
import { MainPage } from "@/components/main-app-header";

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  proof_cadence: string;
  proposed_pool_amount: number;
  status: string;
};

type Community = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export default function CommunityHubPage() {
  const params = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/community/communities/${params.slug}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "Not found");
          return;
        }
        setCommunity(json.community);
        setCampaigns(json.campaigns ?? []);
      } catch {
        setError("Failed to load community");
      } finally {
        setLoading(false);
      }
    })();
  }, [params.slug]);

  if (loading) {
    return (
      <MainPage className="flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-delulu-blue" />
      </MainPage>
    );
  }

  if (error || !community) {
    return (
      <MainPage className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        {error ?? "Community not found"}
      </MainPage>
    );
  }

  return (
    <MainPage className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/communities"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Communities
      </Link>

      <h1 className="text-xl font-bold text-foreground">{community.name}</h1>
      {community.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{community.description}</p>
      ) : null}

      <h2 className="mt-8 mb-3 text-sm font-semibold text-foreground">Active campaigns</h2>

      {campaigns.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          No active campaigns right now.
        </p>
      ) : (
        <ul className="space-y-3">
          {campaigns.map((c) => (
            <li key={c.id}>
              <Link
                href={`/communities/${community.slug}/campaigns/${c.id}`}
                className="block rounded-2xl border border-border bg-card px-4 py-4 hover:border-delulu-blue/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-5 w-5 text-delulu-blue shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground">{c.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.status === "active" && c.proposed_pool_amount > 0
                        ? `${c.proposed_pool_amount} G$ pool · `
                        : ""}
                      {c.proof_cadence}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MainPage>
  );
}
