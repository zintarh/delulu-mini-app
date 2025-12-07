import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// https://env.t3.gg/docs/nextjs
export const env = createEnv({
  server: {
    JWT_SECRET: z.string().min(1).optional().default("build-time-placeholder"),
  },
  client: {
    NEXT_PUBLIC_URL: z.string().min(1).optional().default("http://localhost:3000"),
    NEXT_PUBLIC_APP_ENV: z
      .enum(["development", "production"])
      .optional()
      .default("development"),
    NEXT_PUBLIC_FARCASTER_HEADER: z.string().min(1).optional().default("build-time-placeholder"),
    NEXT_PUBLIC_FARCASTER_PAYLOAD: z.string().min(1).optional().default("build-time-placeholder"),
    NEXT_PUBLIC_FARCASTER_SIGNATURE: z.string().min(1).optional().default("build-time-placeholder"),
    NEXT_PUBLIC_SELF_SCOPE: z.string().min(1).optional().default("delulu-app-v1"),
    NEXT_PUBLIC_SELF_APP_NAME: z.string().min(1).optional().default("Delulu"),
    NEXT_PUBLIC_SELF_ENDPOINT: z.string().url().optional().default("https://playground.self.xyz/api/verify"),
    NEXT_PUBLIC_SELF_MOCK_PASSPORT: z.string().optional().default("false"),
  },
  // For Next.js >= 13.4.4, you only need to destructure client variables:
  experimental__runtimeEnv: {
    NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_FARCASTER_HEADER: process.env.NEXT_PUBLIC_FARCASTER_HEADER,
    NEXT_PUBLIC_FARCASTER_PAYLOAD: process.env.NEXT_PUBLIC_FARCASTER_PAYLOAD,
    NEXT_PUBLIC_FARCASTER_SIGNATURE: process.env.NEXT_PUBLIC_FARCASTER_SIGNATURE,
    NEXT_PUBLIC_SELF_SCOPE: process.env.NEXT_PUBLIC_SELF_SCOPE,
    NEXT_PUBLIC_SELF_APP_NAME: process.env.NEXT_PUBLIC_SELF_APP_NAME,
    NEXT_PUBLIC_SELF_ENDPOINT: process.env.NEXT_PUBLIC_SELF_ENDPOINT,
    NEXT_PUBLIC_SELF_MOCK_PASSPORT: process.env.NEXT_PUBLIC_SELF_MOCK_PASSPORT,
  },
});
