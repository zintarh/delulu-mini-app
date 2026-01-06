import { z } from "zod";

const gatekeeperSchema = z
  .object({
    enabled: z.boolean(),
    type: z.string().optional(),
    value: z.string().optional(),
    label: z.string().optional(),
  })
  .optional();

export const createDeluluSchema = z.object({
  onChainId: z
    .union([z.string(), z.number(), z.bigint()])
    .transform((val) => BigInt(val)),
  contentHash: z.string().min(1, "Content hash is required"),
  content: z.string().optional(),
  creatorAddress: z
    .string()
    .min(1, "Creator address is required")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  stakingDeadline: z
    .union([z.string(), z.number(), z.date()])
    .transform((val) => new Date(val)),
  resolutionDeadline: z
    .union([z.string(), z.number(), z.date()])
    .transform((val) => new Date(val)),
  bgImageUrl: z.string().min(1, "Background image URL is required").optional(),
  gatekeeper: gatekeeperSchema,
});

export type CreateDeluluInput = z.infer<typeof createDeluluSchema>;
