export interface GatekeeperConfig {
  enabled: boolean;
  type: "country";
  value: string; // ISO Code e.g., "NG"
  label: string; // Human readable e.g., "Nigeria"
}

export async function uploadToIPFS(
  content: string,
  username?: string,
  pfpUrl?: string,
  createdAt?: Date,
  gatekeeper?: GatekeeperConfig | null
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

