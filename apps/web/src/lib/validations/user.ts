import { z } from "zod";

const ethereumAddress = z
  .string()
  .min(1, "Address required")
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const createUserSchema = z
  .object({
    address: ethereumAddress,
    fid: z.number().int().positive().optional(),
    username: z.string().min(1).optional(),
    displayName: z.string().min(1).optional(),
    pfpUrl: z.string().url().optional(),
  })
  .transform((data) => {
    // Filter out undefined values to avoid sending blanks to db
    const cleaned: Record<string, unknown> = { address: data.address };
    if (data.fid !== undefined) cleaned.fid = data.fid;
    if (data.username) cleaned.username = data.username;
    if (data.displayName) cleaned.displayName = data.displayName;
    if (data.pfpUrl) cleaned.pfpUrl = data.pfpUrl;
    return cleaned as {
      address: string;
      fid?: number;
      username?: string;
      displayName?: string;
      pfpUrl?: string;
    };
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
