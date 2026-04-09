"use client";

import { useState, useRef, useEffect } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { LogOut, User } from "lucide-react";

const DEFAULT_AVATAR_BASE =
  "https://api.dicebear.com/7.x/adventurer/svg?radius=50&backgroundColor=b6e3f4,c0aede,d1d4f9&seed=";

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
  const fallbackSeed = user?.displayName || user?.username || "delulu-user";
  const fallbackAvatarUrl = `${DEFAULT_AVATAR_BASE}${encodeURIComponent(fallbackSeed)}`;
  const avatarUrl = user?.pfpUrl || fallbackAvatarUrl;

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
        className="flex items-center justify-center w-12 h-12 rounded-full transition-colors border border-gray-200"
        aria-label="Profile menu"
      >
        <img
          src={avatarUrl}
          alt={user?.displayName || user?.username || "Profile"}
          className="w-12 h-12 rounded-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = fallbackAvatarUrl;
          }}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 md:right-0 md:left-auto top-12 w-14 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50">
          <button
            onClick={handleProfile}
            className="w-full h-14 flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Profile"
            aria-label="Profile"
          >
            <User className="w-7 h-7 text-gray-500" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full h-14 flex items-center justify-center hover:bg-gray-50 transition-colors border-t border-gray-200"
            title="Disconnect"
            aria-label="Disconnect"
          >
            <LogOut className="w-7 h-7 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
