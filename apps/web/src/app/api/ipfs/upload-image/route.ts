import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const pinataJWT = process.env.PINATA_JWT;
  if (!pinataJWT) {
    return NextResponse.json({ error: "IPFS service not configured" }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
    }

    const pinataForm = new FormData();
    pinataForm.append("file", file);
    pinataForm.append(
      "pinataMetadata",
      JSON.stringify({ name: `delulu-pfp-${Date.now()}` })
    );

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${pinataJWT}` },
      body: pinataForm,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Pinata error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const url = `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
    return NextResponse.json({ hash: data.IpfsHash, url });
  } catch (error) {
    console.error("[upload-image]", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
