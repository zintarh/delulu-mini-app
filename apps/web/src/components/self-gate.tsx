"use client";

import { useState, useEffect } from "react";
import {
  SelfAppBuilder,
  SelfQRcodeWrapper,
  type SelfApp,
} from "@selfxyz/qrcode";
import { ethers } from "ethers";
import { Loader2 } from "lucide-react";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);

const SCOPE = process.env.NEXT_PUBLIC_SELF_SCOPE || "delulu-app-v1";
const APP_NAME = process.env.NEXT_PUBLIC_SELF_APP_NAME || "Delulu";
// The endpoint should point to our own verification API, not Self's playground
const getSelfEndpoint = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/verify-self`;
  }
  return (
    process.env.NEXT_PUBLIC_SELF_ENDPOINT ||
    "https://playground.self.xyz/api/verify"
  );
};

interface SelfGateProps {
  countryCode: string;
  onVerified: () => void;
}

export function SelfGate({ countryCode, onVerified }: SelfGateProps) {
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const countryName =
    countries.getName(countryCode, "en", { select: "official" }) || countryCode;

  useEffect(() => {
    const initializeQR = async () => {
      // Guard clause: Strictly check if countryCode is missing/empty
      if (!countryCode || typeof countryCode !== "string" || countryCode.trim() === "") {
        console.warn("[SelfGate] Country code is missing or empty. Skipping QR code generation.", {
          countryCode,
          type: typeof countryCode,
        });
        setError("Country code is required for verification");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const app = new SelfAppBuilder({
          version: 2,
          appName: APP_NAME,
          scope: SCOPE,
          endpoint: getSelfEndpoint(),
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png", 
          userId: ethers.ZeroAddress, 
          endpointType: "staging_https",
          userIdType: "hex",
          userDefinedData: JSON.stringify({
            country: countryCode,
            requiredCountry: countryCode,
          }),
          // Use array format with allowedCountries as specified by Self Protocol SDK
          disclosures: [
            {
              type: "nationality",
              allowedCountries: [countryCode], // Ensure countryCode is a string like "NG"
            },
          ] as any, // Type assertion needed as SDK types may not reflect runtime API
        }).build();

        setSelfApp(app);
        setIsLoading(false);
      } catch (err) {
        console.error("QR Code initialization error:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to initialize verification. Please try again."
        );
        setIsLoading(false);
      }
    };

    initializeQR();
  }, [countryCode]);

  const handleSuccess = async (data?: any) => {
    try {
      if (!data) {
        setError("No verification data received");
        return;
      }

      // Send proof to backend for verification
      const response = await fetch("/api/verify-self", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          attestationId: data.attestationId,
          proof: data.proof,
          publicSignals: data.publicSignals,
          userContextData: data.userContextData,
          country: countryCode,
        }),
      });

      const result = await response.json();

      if (result.status === "success" && result.result === true) {
        onVerified();
      } else {
        setError(result.reason || "Verification failed. Please try again.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Please try again."
      );
    }
  };

  const handleError = (error: any) => {
    console.error("Self verification error:", error);

    // Extract error message from error object
    let errorMessage = "Failed to verify identity. Please try again.";

    if (error?.reason) {
      errorMessage = error.reason;
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    setError(errorMessage);
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-center space-y-4">
        <div>
          <p className="text-lg font-bold text-white/90 mb-2">
            Restricted Access
          </p>
          <p className="text-base text-white/70">{countryName} Only</p>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-delulu-yellow mb-4" />
            <p className="text-sm text-white/60">
              Generating verification code...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {selfApp && !error && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl">
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </div>
            </div>
            <p className="text-sm text-white/60">
              Scan to verify your nationality
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
