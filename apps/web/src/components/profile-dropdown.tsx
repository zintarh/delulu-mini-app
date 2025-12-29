"use client";

import { useState, useRef, useEffect } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { LogOut, User } from "lucide-react";

interface ProfileDropdownProps {
  onProfileClick: () => void;
  onLogoutClick: () => void;
}

export function ProfileDropdown({
  onProfileClick,
  onLogoutClick,
}: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useUserStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleProfile = () => {
    setIsOpen(false);
    onProfileClick();
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogoutClick();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
        aria-label="Profile menu"
      >
        {user?.pfpUrl ? (
          <img
            src={user.pfpUrl}
            alt={user.displayName || user.username || "Profile"}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <User className="w-5 h-5 text-white" />
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 md:right-0 md:left-auto top-12 w-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-lg overflow-hidden z-50">
          <button
            onClick={handleProfile}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-800 transition-colors"
          >
            <User className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white font-medium">Profile</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-800 transition-colors border-t border-gray-800"
          >
            <LogOut className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white font-medium">Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
