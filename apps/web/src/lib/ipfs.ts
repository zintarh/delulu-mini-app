export interface GatekeeperConfig {
  enabled: boolean;
  type: "country";
  value: string; // ISO Code e.g., "NG"
  label: string; // Human readable e.g., "Nigeria"
}

export interface DeluluMetadata {
  content: string;
  username?: string;
  pfpUrl?: string;
  createdAt?: string;
  gatekeeper?: GatekeeperConfig;
  bgImageUrl?: string; // Background image URL (template or IPFS)
}

export async function uploadToIPFS(
  content: string,
  username?: string,
  pfpUrl?: string,
  createdAt?: Date,
  gatekeeper?: GatekeeperConfig | null,
  bgImageUrl?: string
): Promise<string> {
  try {
    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        content,
        username,
        pfpUrl,
        createdAt: createdAt ? createdAt.toISOString() : undefined,
        gatekeeper: gatekeeper || undefined,
        bgImageUrl: bgImageUrl || undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to upload to IPFS");
    }

    const data = await response.json();
    
    if (!data.hash) {
      throw new Error("No IPFS hash returned");
    }

    return data.hash;
  } catch (error) {
    console.error("IPFS upload error:", error);
    throw new Error(
      error instanceof Error
        ? `IPFS upload failed: ${error.message}`
        : "IPFS upload failed"
    );
  }
}

