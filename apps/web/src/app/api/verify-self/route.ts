import { NextRequest, NextResponse } from "next/server";
import {
  SelfBackendVerifier,
  AllIds,
  DefaultConfigStore,
  countries,
} from "@selfxyz/core";
import { SELF_CONFIG } from "@/lib/self-config";

const SELF_ENDPOINT =
  (process.env.NEXT_PUBLIC_URL || "http://localhost:3000") + "/api/verify-self";

export async function POST(request: NextRequest) {
  try {
    const targetCountry = request.nextUrl.searchParams.get("targetCountry");

    const { attestationId, proof, publicSignals, userContextData } =
      await request.json();

    if (!proof || !publicSignals || !attestationId || !userContextData) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason:
            "Proof, publicSignals, attestationId and userContextData are required",
        },
        { status: 200 }
      );
    }

    // Validate targetCountry is provided
    if (!targetCountry) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason:
            "Target country is required. Please provide targetCountry as a query parameter.",
        },
        { status: 200 }
      );
    }

    const selfBackendVerifier = new SelfBackendVerifier(
      SELF_CONFIG.SCOPE,
      SELF_ENDPOINT,
      SELF_CONFIG.MOCK_PASSPORT,
      AllIds,
      new DefaultConfigStore({
        minimumAge: SELF_CONFIG.MINIMUM_AGE,
        ofac: SELF_CONFIG.OFAC_CHECK,
      }),
      "uuid"
    );

    // Verify the proof
    const result = await selfBackendVerifier.verify(
      attestationId,
      proof,
      publicSignals,
      userContextData
    );

    // Check specific validity flags
    const { isValid, isMinimumAgeValid } = result.isValidDetails;

    if (!isValid || !isMinimumAgeValid) {
      let reason = "Verification failed";
      if (!isMinimumAgeValid) reason = "Minimum age verification failed";

      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason,
          details: result.isValidDetails,
        },
        { status: 200 }
      );
    }

    // Verify nationality matches targetCountry if nationality is disclosed
    const disclosedNationality = result.discloseOutput?.nationality;
    if (disclosedNationality && disclosedNationality !== targetCountry) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: `Nationality mismatch. Required: ${targetCountry}, Got: ${disclosedNationality}`,
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
  } catch (error) {
    console.error("Self verification error:", error);
    return NextResponse.json(
      {
        status: "error",
        result: false,
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 200 }
    );
  }
}
