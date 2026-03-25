"use client";

import { env } from "@/lib/env";
import dynamic from "next/dynamic";
import { ReactNode } from "react";

const Eruda = dynamic(() => import("./eruda-provider").then((c) => c.Eruda), {
  ssr: false,
});

export const ErudaProvider = (props: { children: ReactNode }) => {
  // Never show the Eruda console in real production builds.
  // Rely on Next.js' NODE_ENV, not NEXT_PUBLIC_APP_ENV (which can be unset/misconfigured).
  if (process.env.NODE_ENV === "production") {
    return props.children;
  }
  return <Eruda>{props.children}</Eruda>;
};
