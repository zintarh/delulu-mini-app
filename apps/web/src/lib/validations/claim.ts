import { z } from "zod";

const ethereumAddress = z
  .string()
  .min(1, "Address required")
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const createClaimSchema = z.object({
  userAddress: ethereumAddress,
  deluluId: z.string().min(1, "Delulu ID required"),
  amount: z.number().positive("Amount must be positive"),
  txHash: z
    .string()
    .min(1, "Transaction hash required")
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
