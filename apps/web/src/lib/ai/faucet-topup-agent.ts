import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkFaucetBalance,
  checkIpRate,
  checkWalletActivity,
  executeRejectClaim,
  executeSendGas,
} from "./faucet-tools";

export type TopupAgentResult =
  | { outcome: "sent"; txHash: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "error"; error: string };

const SYSTEM_PROMPT = `You are a CELO gas top-up agent for the Delulu app. A user with an existing profile has run out of gas mid-session. Your job is to approve a small 0.1 CELO top-up ONLY for genuinely active users — not for people trying to game the system.

EXACT PROTOCOL — follow this order strictly:
1. Call check_wallet_activity with the user's address.
   - If nonce <= 10 → call reject_claim("low_nonce") and stop. Low nonce means this wallet has not been meaningfully active. This is the strongest abuse signal.
   - If days_since_last_claim is not null AND days_since_last_claim < 30 → call reject_claim("too_soon") and stop.
2. Call check_ip_rate with the user's IP.
   - If count >= 2 → call reject_claim("ip_rate_exceeded") and stop.
3. Call check_faucet_balance.
   - If balance_celo < 0.3 → call reject_claim("insufficient_faucet_funds") and stop.
4. All checks passed → call send_gas with address and amount_celo=0.1.

STRICT RULES:
- You MUST end every response by calling either send_gas or reject_claim. Never stop early.
- Never call send_gas more than once per conversation.
- Nonce is the most important signal. A high nonce proves genuine app usage. When in doubt, reject.

REJECTION REASONS — use one of these exact strings only:
- "low_nonce"
- "too_soon"
- "ip_rate_exceeded"
- "insufficient_faucet_funds"`;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_wallet_activity",
      description: "Get the wallet's on-chain transaction count (nonce) and days since last gas claim. High nonce = genuinely active user.",
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
      name: "check_ip_rate",
      description: "Count top-up requests from this IP in the last 24 hours.",
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
      description: "Send 0.1 CELO to the user's wallet.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Recipient wallet address" },
          amount_celo: { type: "number", description: "Amount of CELO to send (use 0.1)" },
        },
        required: ["address", "amount_celo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reject_claim",
      description: "Reject the top-up request and record the reason.",
      parameters: {
        type: "object",
        properties: {
          reason: {
            type: "string",
            enum: ["low_nonce", "too_soon", "ip_rate_exceeded", "insufficient_faucet_funds"],
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
  ctx: { claimId: string; supabase: SupabaseClient },
): Promise<unknown> {
  switch (name) {
    case "check_wallet_activity":
      return checkWalletActivity(args.address as string, ctx.supabase);
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

export async function runTopupAgent(params: {
  claimId: string;
  address: string;
  ip: string;
  supabase: SupabaseClient;
}): Promise<TopupAgentResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { outcome: "error", error: "OPENAI_API_KEY not configured" };

  const openai = new OpenAI({ apiKey });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: `Evaluate gas top-up request:
address: ${params.address}
ip: ${params.ip}`,
    },
  ];

  let result: TopupAgentResult | null = null;
  const MAX_ITERATIONS = 10;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      tool_choice: "auto",
      messages,
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming);

    const choice = response.choices[0];
    if (!choice) break;

    messages.push({ role: "assistant", content: choice.message.content ?? null, tool_calls: choice.message.tool_calls });

    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

      for (const call of choice.message.tool_calls) {
        if (call.type !== "function") continue;
        const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
        const toolResult = await executeTool(call.function.name, args, params);

        if (call.function.name === "send_gas") {
          const r = toolResult as { success: boolean; tx_hash?: string; error?: string };
          result = r.success && r.tx_hash
            ? { outcome: "sent", txHash: r.tx_hash }
            : { outcome: "error", error: r.error ?? "send_failed" };
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
      if (result) return result;
    }

    if (choice.finish_reason === "stop") break;
  }

  return result ?? { outcome: "error", error: "agent_did_not_terminate" };
}
