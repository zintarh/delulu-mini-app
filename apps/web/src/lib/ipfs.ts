export async function uploadToIPFS(content: string): Promise<string> {
  try {
    const response = await fetch("/api/ipfs/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
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

