import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { content, username, pfpUrl } = await request.json();

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
    const pinataContent: { text: string; username?: string; pfpUrl?: string } = {
      text: content,
    };
    
    if (username && typeof username === "string") {
      pinataContent.username = username;
    }
    
    if (pfpUrl && typeof pfpUrl === "string") {
      pinataContent.pfpUrl = pfpUrl;
    }

    // Upload to Pinata
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
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Pinata upload error:", errorData);
      return NextResponse.json(
        { error: "Failed to upload to IPFS", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
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

