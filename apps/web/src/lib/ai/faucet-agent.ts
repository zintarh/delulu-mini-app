import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkEmailClaim,
  checkFaucetBalance,
  checkIpRate,
  checkWalletClaim,
  executeRejectClaim,
  executeSendGas,
} from "./faucet-tools";

export type FaucetAgentResult =
  | { outcome: "sent"; txHash: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "error"; error: string };

const SYSTEM_PROMPT = `You are a CELO gas faucet agent for the Delulu app. Your ONLY job is to decide whether a new user should receive 0.5 CELO for gas fees.

EXACT PROTOCOL — follow this order strictly:
1. Call check_wallet_claim with the user's address.
   - If already_received is true → call reject_claim("already_received_wallet") and stop.
2. Call check_email_claim with the user's email.
   - If already_received is true → call reject_claim("already_received_email") and stop.
3. Call check_ip_rate with the user's IP.
   - If count >= 3 → call reject_claim("ip_rate_exceeded") and stop.
4. Call check_faucet_balance.
   - If balance_celo < 0.6 → call reject_claim("insufficient_faucet_funds") and stop.
5. All checks passed → call send_gas with address and amount_celo=0.5.

STRICT RULES:
- You MUST end every response by calling either send_gas or reject_claim. Never stop early.
- Never call send_gas more than once per conversation.
- When in doubt, reject. Security is the priority.

REJECTION REASONS — use one of these exact strings only:
- "already_received_wallet"
- "already_received_email"
- "ip_rate_exceeded"
- "insufficient_faucet_funds"`;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_wallet_claim",
      description: "Check if this wallet address has already received gas (status=sent) from the faucet.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Lowercase 0x wallet address" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_email_claim",
      description: "Check if this email address has already received gas (status=sent) from the faucet. Returns already_received=false if email is null.",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "User email address, or empty string if unknown" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_ip_rate",
      description: "Count how many faucet claims this IP address has made in the last 24 hours.",
      parameters: {
        type: "object",
        properties: {
          ip: { type: "string", description: "IP address string" },
        },
        required: ["ip"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_faucet_balance",
      description: "Get the current CELO balance of the faucet wallet.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "send_gas",
      description: "Send CELO to the user's wallet and record the claim as sent.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Recipient wallet address" },
          amount_celo: { type: "number", description: "Amount of CELO to send (use 0.5)" },
        },
        required: ["address", "amount_celo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reject_claim",
      description: "Reject the gas claim and record the reason.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: [
              "already_received_wallet",
              "already_received_email",
              "ip_rate_exceeded",
              "insufficient_faucet_funds",
            ],
          },
        },
        required: ["reason"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { claimId: string; email: string | null; supabase: SupabaseClient },
): Promise<unknown> {
  switch (name) {
    case "check_wallet_claim":
      return checkWalletClaim(args.address as string, ctx.supabase);
    case "check_email_claim":
      return checkEmailClaim(args.email as string || ctx.email, ctx.supabase);
    case "check_ip_rate":
      return checkIpRate(args.ip as string, ctx.supabase);
    case "check_faucet_balance":
      return checkFaucetBalance();
    case "send_gas":
      return executeSendGas(
        args.address as string,
        args.amount_celo as number,
        ctx.claimId,
        ctx.supabase,
      );
    case "reject_claim":
      return executeRejectClaim(args.reason as string, ctx.claimId, ctx.supabase);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function runFaucetAgent(params: {
  claimId: string;
  address: string;
  email: string | null;
  ip: string;
  supabase: SupabaseClient;
}): Promise<FaucetAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { outcome: "error", error: "OPENAI_API_KEY not configured" };

  const openai = new OpenAI({ apiKey });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Evaluate gas faucet claim:
address: ${params.address}
email: ${params.email ?? "unknown"}
ip: ${params.ip}`,
    },
  ];

  let result: FaucetAgentResult | null = null;
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      tools: TOOLS,
      tool_choice: "auto",
      messages,
    });

    const choice = response.choices[0];
    if (!choice) break;

    messages.push({ role: "assistant", content: choice.message.content ?? null, tool_calls: choice.message.tool_calls });

    // Process tool calls
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

      for (const call of choice.message.tool_calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const toolResult = await executeTool(call.function.name, args, params);

        // Track terminal outcomes
        if (call.function.name === "send_gas") {
          const r = toolResult as { success: boolean; tx_hash?: string; error?: string };
          if (r.success && r.tx_hash) {
            result = { outcome: "sent", txHash: r.tx_hash };
          } else {
            result = { outcome: "error", error: r.error ?? "send_failed" };
          }
        } else if (call.function.name === "reject_claim") {
          const r = toolResult as { reason: string };
          result = { outcome: "rejected", reason: r.reason };
        }

        toolResults.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(toolResult),
        });
      }

      messages.push(...toolResults);

      // Stop once a terminal action has been taken
      if (result) return result;
    }

    if (choice.finish_reason === "stop") break;
  }

  return result ?? { outcome: "error", error: "agent_did_not_terminate" };
}
