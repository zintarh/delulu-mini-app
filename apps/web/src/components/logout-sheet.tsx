"use client";

import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useUserStore } from "@/stores/useUserStore";
import { useAccount } from "wagmi";
import { formatAddress } from "@/lib/utils";

interface LogoutSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

export function LogoutSheet({
  open,
  onOpenChange,
  onLogout,
}: LogoutSheetProps) {
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
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Logout"
      sheetClassName="border-t border-white/10 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl bg-black"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-8 px-6 lg:pt-6">
        <div className="text-center mb-4">
          <h2 className="text-sm text-white/60">{displayName}</h2>
        </div>
      </div>

      <div className="w-full border-t border-white/10 my-6" />

      <div className="max-w-lg mx-auto px-6 pb-8">
        <button
          onClick={onLogout}
          className="w-full py-3 font-bold text-sm rounded-md border-2 border-black shadow-[3px_3px_0px_0px_#000000] bg-black text-white"
        >
          Logout
        </button>
      </div>
    </ResponsiveSheet>
  );
}
