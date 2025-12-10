"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  SelfAppBuilder,
  SelfQRcodeWrapper,
  type SelfApp,
} from "@selfxyz/qrcode";
import { Loader2, Info, CheckCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import isoCountries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
isoCountries.registerLocale(enLocale);
import { SELF_CONFIG } from "@/lib/self-config";

interface SelfGateProps {
  countryCode: string;
  onVerified: () => void;
}

export function SelfGate({ countryCode, onVerified }: SelfGateProps) {
  const [selfApp, setSelfApp] = useState<SelfApp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const userId = useMemo(() => uuidv4(), []);
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
    if (!countryCodeAlpha3) {
      throw new Error(
        `Invalid country code: ${countryCode}. Could not convert to Alpha-3 format.`
      );
    }

    if (isVerified) {
      return;
    }

    const initializeQR = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!countryCodeAlpha3) {
          throw new Error(
            `Invalid country code: ${countryCode}. Could not convert to Alpha-3 format.`
          );
        }

        const endpointWithCountry = `${SELF_CONFIG.getEndpoint()}?targetCountry=${encodeURIComponent(
          countryCodeAlpha3
        )}`;

        const app = new SelfAppBuilder({
          version: 2,
          appName: SELF_CONFIG.APP_NAME,
          scope: SELF_CONFIG.SCOPE,
          endpoint: endpointWithCountry,
          devMode: SELF_CONFIG.MOCK_PASSPORT,
          logoBase64: "https://i.postimg.cc/mrmVf9hm/self.png",
          endpointType: "staging_https",
          userId: userId,
          userIdType: "uuid",

          disclosures: {
            ...SELF_CONFIG.DISCLOSURES,
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
  }, [countryCode, countryCodeAlpha3, userId, countryName, isVerified]);

  const handleSuccess = useCallback(() => {
    setIsVerified(true);
    onVerified();
  }, [onVerified]);

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
          <p className="text-xs font-semibold text-white/80 mb-1">
            Verify that you&apos;re a {countryName} citizen to stake
          </p>
          <p className="text-xs text-white/50">
            Age {SELF_CONFIG.MINIMUM_AGE}+ & Nationality required
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-blue-400 mb-1">
                  Testing Mode
                </p>
                <p className="text-xs text-blue-300/80">
                  Please use a
                  <span className="font-semibold">mock passport</span> for
                  verification during testing.
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

        {error && !isVerified && (
          <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {isVerified && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <p className="text-lg font-bold text-white/90 mb-2">
                Verification Successful! ✅
              </p>
              <p className="text-sm text-white/60">
                Verified as {countryName} citizen
              </p>
            </div>
          </div>
        )}

        {selfApp && !error && !isVerified && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-blue-400 mb-1">
                  Testing Mode
                </p>
                <p className="text-xs text-blue-300/80">
                  Please use a{" "}
                  <span className="font-semibold">mock passport</span> for
                  verification during testing.
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="p-2 bg-white rounded-xl inline-block">
                <div className="w-50 h-50 overflow-hidden flex items-center justify-center">
                  <div
                    style={{ transform: "scale(1)", transformOrigin: "center" }}
                  >
                    <SelfQRcodeWrapper
                      selfApp={selfApp}
                      onSuccess={handleSuccess}
                      onError={handleError}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-white/40 text-center">
              Scan QR code to verify
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
