import { NextRequest, NextResponse } from "next/server";
import { SelfBackendVerifier, AllIds, DefaultConfigStore } from "@selfxyz/core";

const SCOPE = "delulu-app-v1";
const SELF_ENDPOINT =
  process.env.NEXT_PUBLIC_URL + "/api/verify-self" ||
  "https://playground.self.xyz/api/verify";
const MOCK_PASSPORT = process.env.NEXT_PUBLIC_SELF_MOCK_PASSPORT === "true"; // false = mainnet, true = staging/testnet

// Reuse a single verifier instance
const selfBackendVerifier = new SelfBackendVerifier(
  SCOPE,
  SELF_ENDPOINT,
  MOCK_PASSPORT,
  AllIds,
  new DefaultConfigStore({
    excludedCountries: [], // Can be configured via env vars if needed
    ofac: false, // OFAC sanctions check
  }),
  "hex" // userIdentifierType
);

export async function POST(request: NextRequest) {
  try {
    const { attestationId, proof, publicSignals, userContextData, country } =
      await request.json();

    // Verify all required fields are present
    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason:
            "Proof, publicSignals, attestationId and userContextData are required",
          error_code: "MISSING_FIELDS",
        },
        { status: 200 }
      );
    }

    if (!country || typeof country !== "string") {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Country code is required",
          error_code: "MISSING_COUNTRY",
        },
        { status: 200 }
      );
    }

    // Verify the proof
    const result = await selfBackendVerifier.verify(
      attestationId, // Document type (1 = passport, 2 = EU ID card, 3 = Aadhaar)
      proof, // The zero-knowledge proof
      publicSignals, // Public signals array
      userContextData // User context data (hex string)
    );

    // Check if verification was successful
    if (result.isValidDetails.isValid) {
      // Additional check: verify nationality matches the required country
      const disclosedNationality = result.discloseOutput?.nationality;
      if (disclosedNationality && disclosedNationality !== country) {
        return NextResponse.json(
          {
            status: "error",
            result: false,
            reason: `Nationality mismatch. Required: ${country}, Got: ${disclosedNationality}`,
            error_code: "NATIONALITY_MISMATCH",
            details: result.isValidDetails,
          },
          { status: 200 }
        );
      }

      // Verification successful
      return NextResponse.json({
        status: "success",
        result: true,
        credentialSubject: result.discloseOutput,
      });
    } else {
      // Verification failed
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Verification failed",
          error_code: "VERIFICATION_FAILED",
          details: result.isValidDetails,
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Self verification error:", error);
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: error instanceof Error ? error.message : "Unknown error",
        error_code: "UNKNOWN_ERROR",
      },
      { status: 200 }
    );
  }
}
