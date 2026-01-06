import { NextRequest, NextResponse } from "next/server";

// Retry helper for Pinata image uploads
async function uploadImageWithRetry(
  pinataJWT: string,
  formData: FormData,
  maxRetries = 3
): Promise<{ IpfsHash: string }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for images

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pinataJWT}`,
        },
        body: formData,
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
      console.warn(`[IPFS Image Upload] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    const pinataJWT = process.env.PINATA_JWT || process.env.PINATA_API_KEY;

    if (!pinataJWT) {
      console.error("PINATA_JWT or PINATA_API_KEY is not set in environment variables");
      return NextResponse.json(
        { error: "IPFS service not configured" },
        { status: 500 }
      );
    }

    // Create FormData for Pinata
    const pinataFormData = new FormData();
    pinataFormData.append("file", file);

    // Add metadata
    const metadata = JSON.stringify({
      name: `delulu-image-${Date.now()}`,
    });
    pinataFormData.append("pinataMetadata", metadata);

    // Add options (optional)
    const options = JSON.stringify({
      cidVersion: 0,
    });
    pinataFormData.append("pinataOptions", options);

    // Upload with retry
    const data = await uploadImageWithRetry(pinataJWT, pinataFormData);
    const ipfsHash = data.IpfsHash;

    if (!ipfsHash) {
      return NextResponse.json(
        { error: "No IPFS hash returned from Pinata" },
        { status: 500 }
      );
    }

    // Return the public IPFS gateway URL
    // Using Pinata's public gateway
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    return NextResponse.json({ url: ipfsUrl });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload image to IPFS",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
