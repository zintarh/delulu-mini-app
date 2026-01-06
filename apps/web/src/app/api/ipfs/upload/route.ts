import { NextRequest, NextResponse } from "next/server";

// Retry helper for Pinata uploads
async function uploadWithRetry(
  pinataJWT: string,
  pinataContent: Record<string, unknown>,
  maxRetries = 3
): Promise<{ IpfsHash: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pinataJWT}`,
        },
        body: JSON.stringify({
          pinataContent,
          pinataMetadata: {
            name: "delulu-content",
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Pinata error: ${response.status} - ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[IPFS] Upload attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

export async function POST(request: NextRequest) {
  try {
    const { content, username, pfpUrl, createdAt, gatekeeper, bgImageUrl } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required and must be a string" },
        { status: 400 }
      );
    }

    const pinataJWT = process.env.PINATA_JWT;

    if (!pinataJWT) {
      console.error("PINATA_JWT is not set in environment variables");
      return NextResponse.json(
        { error: "IPFS service not configured" },
        { status: 500 }
      );
    }

    // Build pinataContent object
    const pinataContent: Record<string, unknown> = {
      text: content,
    };

    if (username && typeof username === "string") {
      pinataContent.username = username;
    }

    if (pfpUrl && typeof pfpUrl === "string") {
      pinataContent.pfpUrl = pfpUrl;
    }

    if (createdAt && typeof createdAt === "string") {
      pinataContent.createdAt = createdAt;
    }

    if (gatekeeper && typeof gatekeeper === "object" && gatekeeper.enabled) {
      pinataContent.gatekeeper = {
        enabled: gatekeeper.enabled,
        type: gatekeeper.type || "country",
        value: gatekeeper.value,
        label: gatekeeper.label,
      };
    }

    if (bgImageUrl && typeof bgImageUrl === "string") {
      pinataContent.bgImageUrl = bgImageUrl;
    }

    // Upload with retry
    const data = await uploadWithRetry(pinataJWT, pinataContent);
    const ipfsHash = data.IpfsHash;

    if (!ipfsHash) {
      return NextResponse.json(
        { error: "No IPFS hash returned from Pinata" },
        { status: 500 }
      );
    }

    return NextResponse.json({ hash: ipfsHash });
  } catch (error) {
    console.error("IPFS upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload to IPFS",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
