"use client";

import { useState, useMemo } from "react";
import { GatekeeperConfig } from "@/lib/ipfs";
import { cn } from "@/lib/utils";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

countries.registerLocale(enLocale);
function getAllCountries() {
  const countryNames = countries.getNames("en", { select: "official" });
  return Object.entries(countryNames)
    .map(([code, name]) => ({
      code,
      name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

interface GatekeeperStepProps {
  value: GatekeeperConfig | null;
  onChange: (value: GatekeeperConfig | null) => void;
  variant?: "light" | "dark";
}

export function GatekeeperStep({ value, onChange, variant = "dark" }: GatekeeperStepProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled || false);
  const [selectedCountry, setSelectedCountry] = useState<string>(
    value?.value || "US"
  );

  // Get all countries, memoized
  const allCountries = useMemo(() => getAllCountries(), []);

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      const country =
        allCountries.find((c) => c.code === selectedCountry) || allCountries[0];
      onChange({
        enabled: true,
        type: "country",
        value: country.code,
        label: country.name,
      });
    } else {
      onChange(null);
    }
  };

  const handleCountryChange = (code: string) => {
    setSelectedCountry(code);
    const country = allCountries.find((c) => c.code === code);
    if (country) {
      onChange({
        enabled: true,
        type: "country",
        value: country.code,
        label: country.name,
      });
    }
  };

  const selectedCountryName =
    allCountries.find((c) => c.code === selectedCountry)?.name || "";

  const isLight = variant === "light";
  
  return (
    <div className="w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-between p-4 ">
        <p className={cn(
          "text-sm font-bold",
          isLight ? "text-delulu-charcoal" : "text-white/90"
        )}>
          Restrict to Region
        </p>
        <button
          type="button"
          onClick={() => handleToggle(!isEnabled)}
          className={cn(
            "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-delulu-yellow-reserved focus:ring-offset-2",
            isEnabled ? "bg-delulu-charcoal" : "bg-gray-400"
          )}
        >
          <span
            className={cn(
              "inline-block h-6 w-6 transform rounded-full bg-white transition-transform shadow-sm",
              isEnabled ? "translate-x-7" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {isEnabled && (
        <div className={cn(
          "p-4 rounded-2xl bg-transparent border",
          isLight ? "border-gray-300" : "border-white/30"
        )}>

          <select
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className={cn(
              "w-full bg-transparent font-bold focus:outline-none focus:border-transparent focus:ring-2 focus:ring-transparent transition-colors",
              isLight 
                ? "text-delulu-charcoal border-gray-300" 
                : "text-white"
            )}
          >
            {allCountries.map((country) => (
              <option key={country.code} value={country.code} className="bg-white text-delulu-charcoal">
                {country.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
