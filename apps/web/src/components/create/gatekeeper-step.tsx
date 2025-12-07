"use client";

import { useState, useMemo } from "react";
import { GatekeeperConfig } from "@/lib/ipfs";
import { cn } from "@/lib/utils";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";

// Register English locale
countries.registerLocale(enLocale);

// Get all countries as an array of { code, name }
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
}

export function GatekeeperStep({ value, onChange }: GatekeeperStepProps) {
  const [isEnabled, setIsEnabled] = useState(value?.enabled || false);
  const [selectedCountry, setSelectedCountry] = useState<string>(
    value?.value || "US"
  );

  // Get all countries, memoized
  const allCountries = useMemo(() => getAllCountries(), []);

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (enabled) {
      const country = allCountries.find((c) => c.code === selectedCountry) || allCountries[0];
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

  const selectedCountryName = allCountries.find((c) => c.code === selectedCountry)?.name || "";

  return (
    <div className="w-full max-w-2xl space-y-6">
      {/* Toggle Switch */}
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/20">
        <div>
          <p className="text-base font-bold text-delulu-dark mb-1">
            Restrict to Region? <span className="text-xs font-normal text-delulu-dark/50">(Optional)</span>
          </p>
          <p className="text-sm text-delulu-dark/60">
            Optionally limit this delulu to participants from a specific country
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleToggle(!isEnabled)}
          className={cn(
            "relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-delulu-dark focus:ring-offset-2",
            isEnabled ? "bg-delulu-dark" : "bg-white/30"
          )}
        >
          <span
            className={cn(
              "inline-block h-6 w-6 transform rounded-full bg-white transition-transform",
              isEnabled ? "translate-x-7" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Country Dropdown */}
      {isEnabled && (
        <div className="p-4 rounded-2xl bg-white/10 border border-white/20">
          <label className="block text-sm font-bold text-delulu-dark mb-3">
            Select Country
          </label>
          <select
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white text-delulu-dark font-bold border-2 border-delulu-dark/20 focus:outline-none focus:border-delulu-dark transition-colors"
          >
            {allCountries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-delulu-dark/50 mt-2">
            Only users from {selectedCountryName} will be able to stake
          </p>
        </div>
      )}
    </div>
  );
}
