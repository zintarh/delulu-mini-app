"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Shield, Sparkles, TrendingUp } from "lucide-react";

export default function VerifyPage() {
  const router = useRouter();
  const [isVerified, setIsVerified] = useState(false);

  const handleVerify = () => {
    setIsVerified(!isVerified);
    setTimeout(() => router.push("/"), 500);
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      <PageHeader title="Verify Identity" />

      <div className="w-full max-w-5xl mx-auto px-6 space-y-6 mt-6">
        <Card className="p-6 bg-card border border-delulu-green/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-delulu-green/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-delulu-green" />
            </div>
            <div>
              <h2 className="font-black text-xl">Self Protocol</h2>
              <p className="text-xs text-muted-foreground font-medium">
                Biometric verification
              </p>
            </div>
          </div>

          <Button
            size="lg"
            className="w-full h-14 bg-delulu-green hover:bg-delulu-green/90 text-white font-black text-base rounded-xl"
            onClick={handleVerify}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {isVerified ? "VERIFIED" : "VERIFY NOW"}
          </Button>
        </Card>

        <Card className="p-6 bg-card border border-border">
          <h2 className="font-black text-xl mb-6">Connect Accounts</h2>

          <div className="space-y-3">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 justify-start font-bold rounded-xl border border-border hover:border-delulu-green/50 hover:bg-delulu-green/5 bg-transparent"
            >
              <div className="w-8 h-8 rounded-full bg-delulu-yellow/80 flex items-center justify-center mr-3">
                <TrendingUp className="w-4 h-4 text-delulu-dark" />
              </div>
              Strava
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 justify-start font-bold rounded-xl border border-border hover:border-delulu-green/50 hover:bg-delulu-green/5 bg-transparent"
            >
              <div className="w-8 h-8 rounded-full bg-delulu-purple/80 flex items-center justify-center mr-3">
                <Shield className="w-4 h-4 text-white" />
              </div>
              GitHub
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 justify-start font-bold rounded-xl border border-border hover:border-delulu-green/50 hover:bg-delulu-green/5 bg-transparent"
            >
              <div className="w-8 h-8 rounded-full bg-delulu-green/80 flex items-center justify-center mr-3">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              Duolingo
            </Button>
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4" />
              <span className="font-medium">Verified by vLayer</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
