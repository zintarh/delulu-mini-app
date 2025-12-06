"use client";

import { useState, useRef, useEffect } from "react";
import { useUserStore } from "@/stores/useUserStore";
import { LogOut, User } from "lucide-react";

interface ProfileDropdownProps {
  onProfileClick: () => void;
  onLogoutClick: () => void;
}

export function ProfileDropdown({ onProfileClick, onLogoutClick }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useUserStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        className="flex items-center justify-center transition-transform active:scale-95"
        aria-label="Profile menu"
      >
        {user?.pfpUrl ? (
          <img 
            src={user.pfpUrl} 
            alt={user.displayName || user.username || "Profile"} 
            className="w-9 h-9 rounded-full object-cover border-2 border-delulu-dark/20 hover:border-delulu-dark/40 transition-colors"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-delulu-yellow/20 flex items-center justify-center border-2 border-white/20 hover:border-white/40 transition-colors">
            <span className="text-sm font-black text-delulu-yellow">
              {(user?.displayName || user?.username || "U").charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-48 bg-delulu-dark border border-white/10 rounded-2xl shadow-lg overflow-hidden z-50">
          <button
            onClick={handleProfile}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
          >
            <User className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white/90 font-medium">Profile</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors border-t border-white/10"
          >
            <LogOut className="w-4 h-4 text-white/60" />
            <span className="text-sm text-white/90 font-medium">Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}

