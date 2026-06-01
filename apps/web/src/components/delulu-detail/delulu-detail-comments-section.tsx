"use client";

import { useState } from "react";
import { DeluluDetailComments } from "@/components/delulu-detail/delulu-detail-comments";

interface DeluluDetailCommentsSectionProps {
  deluluId: number;
  deluluCreator?: string | null;
  userAddress?: string | null;
  username?: string | null;
  onRequireAuth: () => void;
  onCountChange?: (count: number) => void;
}

export function DeluluDetailCommentsSection({
  deluluId,
  deluluCreator,
  userAddress,
  username,
  onRequireAuth,
  onCountChange,
}: DeluluDetailCommentsSectionProps) {
  const [count, setCount] = useState(0);

  const handleCount = (n: number) => {
    setCount(n);
    onCountChange?.(n);
  };

  return (
    <section
      id="delulu-comments-section"
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="delulu-comments-heading"
    >
      <h2
        id="delulu-comments-heading"
        className="mb-4 text-base font-black text-foreground sm:text-lg"
      >
        Comments
        {count > 0 ? (
          <span className="ml-2 text-sm font-bold tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </h2>
      <DeluluDetailComments
        deluluId={deluluId}
        deluluCreator={deluluCreator}
        userAddress={userAddress}
        username={username}
        onRequireAuth={onRequireAuth}
        onCountChange={handleCount}
      />
    </section>
  );
}
