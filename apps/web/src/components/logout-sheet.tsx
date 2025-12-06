"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUserStore } from "@/stores/useUserStore";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/utils";

interface LogoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

export function LogoutSheet({ open, onOpenChange, onLogout }: LogoutSheetProps) {
  const { user } = useUserStore();
  const { address } = useAccount();

  const displayName = user?.username 
    ? `@${user.username}` 
    : user?.displayName 
    ? user.displayName 
    : address 
    ? formatAddress(address)
    : "User";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-dark border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      >
        <SheetTitle className="sr-only">Logout</SheetTitle>
        <div className="max-w-lg mx-auto pt-8 px-6">
          {/* Username/Address */}
          <div className="text-center mb-4">
            <h2 className="text-sm text-white/60">
              {displayName}
            </h2>
          </div>
        </div>
        
        {/* Divider - Full Width */}
        <div className="w-full border-t border-white/10 my-6" />
        
        <div className="max-w-lg mx-auto px-6 pb-8">
          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="w-full py-3 font-bold text-sm bg-white text-delulu-dark btn-game"
          >
            Logout
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

