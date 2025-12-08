"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  SelfAppBuilder,
  countries,
  SelfQRcodeWrapper,
  type SelfApp,
} from "@selfxyz/qrcode";
import { Loader2, Info } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

// Register English locale for country names
isoCountries.registerLocale(enLocale);

const SCOPE = process.env.NEXT_PUBLIC_SELF_SCOPE || "delulu-app-v1";
const APP_NAME = process.env.NEXT_PUBLIC_SELF_APP_NAME || "Delulu";

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

  // Generate a UUID for the user ID (generated once per component instance)
  const userId = useMemo(() => uuidv4(), []);

  // Get country name and convert Alpha-2 to Alpha-3 (reactive to countryCode changes)
  const countryName = useMemo(
    () =>
      isoCountries.getName(countryCode, "en", { select: "official" }) ||
      countryCode,
    [countryCode]
  );
  const countryCodeAlpha3 = useMemo(
    () => isoCountries.alpha2ToAlpha3(countryCode),
    [countryCode]
  );

  useEffect(() => {
    const initializeQR = async () => {
      // For this test, we ignore countryCode validation to isolate the Age check
      // if (!countryCode || typeof countryCode !== "string") ...

      try {
        setIsLoading(true);
        setError(null);

        // Convert Alpha-2 country code to Alpha-3 format
        // The countries object from @selfxyz/qrcode uses Alpha-3 codes (e.g., "NGA")
        // but countryCode prop is Alpha-2 (e.g., "NG")
        if (!countryCodeAlpha3) {
          throw new Error(
            `Invalid country code: ${countryCode}. Could not convert to Alpha-3 format.`
          );
        }

        // Get all Alpha-3 country codes from the countries object
        const allCountryCodes = Object.values(countries);

        // Filter out the target country (using Alpha-3) to create the exclusion list
        // Type assertion needed as SDK expects Country3LetterCode[] but countries object values are strings
        const excludedCountriesList = allCountryCodes.filter(
          (code) => code !== countryCodeAlpha3
        ) as any;

        console.log(excludedCountriesList);
        console.log(countryCodeAlpha3);

        const app = new SelfAppBuilder({
          version: 2,
          appName: APP_NAME,
          scope: SCOPE,
          endpoint: getSelfEndpoint(),
          devMode: true,
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
          endpointType: "staging_https",
          userId: userId,
          userIdType: "uuid",
          userDefinedData: JSON.stringify({
            message: `Verify 18+ and Nationality: ${countryName}`,
            targetCountry: countryCodeAlpha3,
          }),
          disclosures: {
            minimumAge: 18,
            // excludedCountries: excludedCountriesList as any,
            nationality: true,
            gender: true,
          } as any,
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
  }, [countryCode, countryCodeAlpha3, userId, countryName]);

  const handleSuccess = useCallback(async (data?: any) => {
    try {
      if (!data) {
        setError("No verification data received");
        return;
      }

      console.log("Proof received:", data); // Check console to see if we get here

      // Check if verification was successful based on status field
      // Successful verification returns: { status: 'proof_verified', error_code: null, proof: null, reason: null }
      if (data.status === "proof_verified") {
        // Make explicit backend API call to verify with targetCountry
        try {
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
              targetCountry: countryCodeAlpha3, // Pass the Alpha-3 country code
            }),
          });

          const result = await response.json();

          if (result.status === "success" && result.result === true) {
            // Backend verification successful - call the onVerified callback
            onVerified();
          } else {
            // Backend verification failed
            setError(result.reason || "Backend verification failed. Please try again.");
          }
        } catch (backendErr) {
          console.error("Backend verification error:", backendErr);
          // Even if backend call fails, if Self SDK says it's verified, we can proceed
          // Or you can choose to show an error instead
          setError("Backend verification error. Please try again.");
        }
      } else {
        // Verification failed - show error message
        const errorMessage =
          data.reason ||
          data.error_code ||
          "Verification failed. Please try again.";
        setError(errorMessage);
      }
    } catch (err) {
      console.error("Verification error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Please try again."
      );
    }
  }, [countryCodeAlpha3, onVerified]);

  const handleError = (error: any) => {
    console.error("Self verification error:", error);
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
          <p className="text-base text-white/70">
            Age Verification Required (18+)
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {/* Mock Passport Notice */}
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-blue-400 mb-1">
                  Testing Mode
                </p>
                <p className="text-xs text-blue-300/80">
                  Please use a <span className="font-semibold">mock passport</span> for verification during testing.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-delulu-yellow mb-4" />
              <p className="text-sm text-white/60">
                Generating verification code...
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {selfApp && !error && (
          <div className="space-y-4">
            {/* Mock Passport Notice */}
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-blue-400 mb-1">
                  Testing Mode
                </p>
                <p className="text-xs text-blue-300/80">
                  Please use a <span className="font-semibold">mock passport</span> for verification during testing.
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="p-4 bg-white rounded-xl">
                <SelfQRcodeWrapper
                  selfApp={selfApp}
                  onSuccess={handleSuccess}
                  onError={handleError}
                />
              </div>
            </div>
            <p className="text-sm text-white/60">Scan to verify age</p>
          </div>
        )}
      </div>
    </div>
  );
}
