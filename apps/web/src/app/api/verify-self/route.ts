import { NextRequest, NextResponse } from "next/server";
import {
  SelfBackendVerifier,
  AllIds,
  DefaultConfigStore,
  countries,
} from "@selfxyz/core";

const SCOPE = process.env.NEXT_PUBLIC_SELF_SCOPE || "delulu-app-v1";
const SELF_ENDPOINT =
  (process.env.NEXT_PUBLIC_URL || "http://localhost:3000") + "/api/verify-self";
// Force true for testing based on your provided context
const MOCK_PASSPORT = true;

export async function POST(request: NextRequest) {
  try {
    const {
      attestationId,
      proof,
      publicSignals,
      userContextData,
      targetCountry,
    } = await request.json();

    // Verify all required fields are present
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

    if (!targetCountry) {
      return NextResponse.json(
        {
          status: "error",
          result: false,
          reason: "Target country required for verification",
        },
        { status: 200 }
      );
    }

    const allCountryCodes = Object.values(countries);

    // 2. Filter out the target country to create the exclusion list
    const excludedCountriesList = allCountryCodes.filter(
      (code) => code !== targetCountry
    );
    // Reuse a single verifier instance
    const selfBackendVerifier = new SelfBackendVerifier(
      SCOPE,
      SELF_ENDPOINT,
      MOCK_PASSPORT,
      AllIds,
      new DefaultConfigStore({
        minimumAge: 18,
        // excludedCountries: excludedCountriesList as any,
        ofac: false,
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

    // Adapted logic from Express snippet: Check specific validity flags
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
