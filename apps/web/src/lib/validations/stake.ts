import { z } from "zod";
import type { StakeSide } from "@/lib/types";

const ethereumAddress = z
  .string()
  .min(1, "Address required")
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

const STAKE_SIDE_VALUES: [StakeSide, StakeSide] = ["believe", "doubt"];

export const createStakeSchema = z.object({
  userAddress: ethereumAddress,
  deluluId: z.string().min(1, "Delulu ID required"),
  amount: z.number().positive("Amount must be positive"),
  side: z.enum(STAKE_SIDE_VALUES, {
    required_error: "Side is required",
    invalid_type_error: "Side must be either 'believe' or 'doubt'",
  }).transform((val) => val === "believe"),
  txHash: z
    .string()
    .min(1, "Transaction hash required")
    .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

export type CreateStakeInput = z.infer<typeof createStakeSchema>;
