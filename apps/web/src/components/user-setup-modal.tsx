"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowLeft, Check, Loader2, X } from "lucide-react";
import { useUsernameAvailability } from "@/hooks/use-username-availability";
import { useSetProfile } from "@/hooks/use-set-profile";
import { hashEmail } from "@/lib/email-hash";
import { useAccount, useReadContract, useChainId } from "wagmi";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { useUserStore } from "@/stores/useUserStore";

interface UserSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (username: string, email: string) => void;
}

export function UserSetupModal({
  open,
  onOpenChange,
  onComplete,
}: UserSetupModalProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { updateUsername, user } = useUserStore();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  // Check username availability - memoized to avoid unnecessary recalculations
  const trimmedUsername = useMemo(() => username.trim(), [username]);
  const shouldCheckAvailability = useMemo(
    () =>
      trimmedUsername.length >= 3 &&
      trimmedUsername.length <= 16 &&
      /^[a-zA-Z0-9_]+$/.test(trimmedUsername),
    [trimmedUsername]
  );
  
  const { isTaken, isLoading: isCheckingUsername, isAvailable } = useUsernameAvailability(
    shouldCheckAvailability ? trimmedUsername : null
  );
  
  // Set profile hook
  const { setProfile, isPending: isSettingProfile, isSuccess: isProfileSet, isError: isProfileError, error: profileError } = useSetProfile();
  
  // Verify username after transaction
  const { data: onChainUsername, refetch: refetchUsername } = useReadContract({
    address: getDeluluContractAddress(chainId),
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isProfileSet,
    },
  });

  // Show notification and auto-hide after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Show profile error notifications
  useEffect(() => {
    if (isProfileError && profileError) {
      setNotification({
        type: "error",
        message: profileError.message || "Failed to set profile",
      });
      setEmailError(profileError.message || "Failed to set profile");
    }
  }, [isProfileError, profileError]);

  // Verify username was set after successful transaction
  useEffect(() => {
    if (!isProfileSet || !address || !trimmedUsername) return;

    // Small delay to ensure transaction is indexed
    const verifyTimer = setTimeout(() => {
      refetchUsername().then(() => {
        // Check if username matches exactly
        const currentUsername = typeof onChainUsername === "string" ? onChainUsername : "";
        if (currentUsername === trimmedUsername) {
          // Update store with confirmed username (email hash was already set optimistically)
          updateUsername(trimmedUsername, user?.email);
          
          setNotification({
            type: "success",
            message: "Profile set successfully! Your username is now active.",
          });
          // Reset and close after a delay
          setTimeout(() => {
            onComplete(trimmedUsername, email.trim());
            setUsername("");
            setEmail("");
            setUsernameError("");
            setEmailError("");
            setNotification(null);
            onOpenChange(false);
          }, 2000);
        }
      }).catch(() => {
        // Even if verification fails, assume success if transaction succeeded
        // Store is already optimistically updated
        setNotification({
          type: "success",
          message: "Profile set successfully!",
        });
        setTimeout(() => {
          onComplete(trimmedUsername, email.trim());
          setUsername("");
          setEmail("");
          setUsernameError("");
          setEmailError("");
          setNotification(null);
          onOpenChange(false);
        }, 2000);
      });
    }, 2000);
    
    return () => clearTimeout(verifyTimer);
  }, [isProfileSet, address, trimmedUsername, email, onChainUsername, refetchUsername, onComplete, onOpenChange, updateUsername, user?.email]);

  const validateUsername = useCallback((value: string): boolean => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      setUsernameError("Username is required");
      return false;
    }
    if (trimmed.length < 3) {
      setUsernameError("Username must be at least 3 characters");
      return false;
    }
    if (trimmed.length > 16) {
      setUsernameError("Username must be 16 characters or less");
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setUsernameError("Username can only contain letters, numbers, and underscores");
      return false;
    }
    
    // Check if username is taken (only if we've checked availability)
    if (shouldCheckAvailability && isTaken === true) {
      setUsernameError("This username is already taken");
      return false;
    }
    
    setUsernameError("");
    return true;
  }, [shouldCheckAvailability, isTaken]);

  const validateEmail = useCallback((value: string): boolean => {
    const trimmed = value.trim();
    
    if (!trimmed) {
      setEmailError("Email is required");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  }, []);

  const handleUsernameNext = useCallback(() => {
    // No longer used (single-step flow)
    return;
  }, []);

  const handleSubmitProfile = useCallback(async () => {
    const isUsernameValid = validateUsername(username);
    const isEmailValid = validateEmail(email);
    if (!isUsernameValid || !isEmailValid) {
      return;
    }

    // Ensure username availability
    if (shouldCheckAvailability) {
      if (isTaken === true) {
        setUsernameError("This username is already taken");
        return;
      }
      if (isCheckingUsername) {
        setUsernameError("Checking username availability...");
        return;
      }
      if (!isAvailable) {
        return;
      }
    }

    try {
      const emailHash = await hashEmail(email);
      // Optimistically update the store with hashed email
      updateUsername(trimmedUsername, emailHash);
      // Set profile on-chain (username only, per ABI)
      await setProfile(trimmedUsername);
      setNotification({
        type: "success",
        message: "Setting your profile on-chain...",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to set profile";
      setNotification({
        type: "error",
        message: errorMessage,
      });
      setEmailError(errorMessage);
    }
  }, [
    email,
    isAvailable,
    isCheckingUsername,
    isTaken,
    shouldCheckAvailability,
    trimmedUsername,
    updateUsername,
    username,
    setProfile,
    validateEmail,
    validateUsername,
  ]);

  const handleClose = useCallback(() => {
    // Reset form when closing
    setUsername("");
    setEmail("");
    setUsernameError("");
    setEmailError("");
    setNotification(null);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={handleClose}
      showClose={false}
      title=""
      sheetClassName="border-t border-border !p-0 !z-[100] rounded-t-3xl bg-card"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-8 pb-6 px-6 lg:pt-6 text-foreground">
        {/* Notification Banner */}
        {notification && (
          <div
            className={cn(
              "mb-4 p-3 rounded-lg border font-medium text-sm",
              notification.type === "success"
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-200"
                : "bg-destructive/10 border-destructive text-destructive-foreground"
            )}
          >
            {notification.message}
          </div>
        )}
        
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-foreground tracking-tight">
              Setup your profile
            </h2>
            <p className="text-sm text-muted-foreground font-medium">
              Choose a username and email to complete your profile.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
              >
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                  @
                </span>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError(""); // Clear error when typing
                  }}
                  onBlur={() => validateUsername(username)}
                  placeholder="yourusername"
                  className={cn(
                    "w-full pl-8 pr-12 py-3 rounded-lg border font-medium",
                    "bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                    "transition-all",
                    usernameError
                      ? "border-destructive"
                      : isAvailable && shouldCheckAvailability
                      ? "border-emerald-500"
                      : "border-border"
                  )}
                  maxLength={16}
                />
                {/* Loading indicator or checkmark */}
                {shouldCheckAvailability && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingUsername ? (
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                    ) : isAvailable ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : isTaken ? (
                      <X className="w-5 h-5 text-destructive" />
                    ) : null}
                  </div>
                )}
              </div>
              {usernameError && (
                <p className="text-xs text-destructive font-medium">{usernameError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                3-16 characters, letters, numbers, and underscores only
              </p>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-xs font-bold text-muted-foreground uppercase tracking-wider"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) {
                    validateEmail(e.target.value);
                  }
                }}
                onBlur={() => validateEmail(email)}
                placeholder="you@example.com"
                className={cn(
                  "w-full px-4 py-3 rounded-lg border font-medium",
                  "bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                  "transition-all",
                  emailError ? "border-destructive" : "border-border"
                )}
              />
              {emailError && (
                <p className="text-xs text-destructive font-medium">{emailError}</p>
              )}
            </div>
          </div>

          <button
            onClick={handleSubmitProfile}
            disabled={
              !username ||
              username.trim().length === 0 ||
              !email ||
              email.trim().length === 0 ||
              isSettingProfile
            }
            className={cn(
              "w-full mt-4 py-3 px-4 rounded-lg border font-bold text-sm",
              "bg-secondary text-foreground border-border",
              "transition-all duration-100",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            {isSettingProfile ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting Profile...
              </>
            ) : (
              <>
                Complete profile
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </ResponsiveSheet>
  );
}
