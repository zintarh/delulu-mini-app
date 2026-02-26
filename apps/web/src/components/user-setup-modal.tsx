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

type Step = "username" | "email";

export function UserSetupModal({
  open,
  onOpenChange,
  onComplete,
}: UserSetupModalProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { updateUsername, user } = useUserStore();
  const [currentStep, setCurrentStep] = useState<Step>("username");
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
            setCurrentStep("username");
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
          setCurrentStep("username");
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
    if (!validateUsername(username)) {
      return;
    }

    // Only proceed if username is available
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
        // Still checking or unavailable
        return;
      }
    }
    
    setCurrentStep("email");
  }, [username, validateUsername, shouldCheckAvailability, isTaken, isCheckingUsername, isAvailable]);

  const handleEmailSubmit = useCallback(async () => {
    if (!validateEmail(email)) {
      return;
    }

    try {
      // Hash the email
      const emailHash = await hashEmail(email);
      
      // Optimistically update the store
      updateUsername(trimmedUsername, emailHash);
      
      // Set profile on-chain
      await setProfile(trimmedUsername, emailHash);
      
      setNotification({
        type: "success",
        message: "Setting your profile on-chain...",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to set profile";
      setNotification({
        type: "error",
        message: errorMessage,
      });
      setEmailError(errorMessage);
      // Revert optimistic update on error (optional - could keep it for better UX)
    }
  }, [email, validateEmail, trimmedUsername, setProfile, updateUsername]);

  const handleClose = useCallback(() => {
    // Reset form when closing
    setUsername("");
    setEmail("");
    setCurrentStep("username");
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
      sheetClassName="border-t-2 border-delulu-charcoal !p-0 !z-[100] rounded-t-3xl bg-white"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto pt-8 pb-6 px-6 lg:pt-6">
        {/* Notification Banner */}
        {notification && (
          <div
            className={cn(
              "mb-4 p-3 rounded-lg border-2 font-medium text-sm",
              notification.type === "success"
                ? "bg-green-50 border-green-500 text-green-800"
                : "bg-red-50 border-red-500 text-red-800"
            )}
          >
            {notification.message}
          </div>
        )}
        
        {/* Step 1: Username */}
        {currentStep === "username" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
            
              <h2 className="text-2xl font-black text-delulu-charcoal tracking-tight">
                Choose your @username
              </h2>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-xs font-bold text-delulu-charcoal/80 uppercase tracking-wider"
              >
                Username
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-delulu-charcoal/50 font-bold">
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
                    "w-full pl-8 pr-12 py-3 rounded-lg border-2 font-medium text-delulu-charcoal",
                    "bg-white focus:outline-none focus:ring-2 focus:ring-delulu-yellow-reserved/50",
                    "transition-all",
                    usernameError
                      ? "border-red-500 shadow-[2px_2px_0px_0px_#ef4444]"
                      : isAvailable && shouldCheckAvailability
                      ? "border-green-500 shadow-[2px_2px_0px_0px_#22c55e]"
                      : "border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] focus:shadow-[3px_3px_0px_0px_#1A1A1A]"
                  )}
                  maxLength={16}
                />
                {/* Loading indicator or checkmark */}
                {shouldCheckAvailability && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isCheckingUsername ? (
                      <Loader2 className="w-5 h-5 text-delulu-charcoal/50 animate-spin" />
                    ) : isAvailable ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : isTaken ? (
                      <X className="w-5 h-5 text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {usernameError && (
                <p className="text-xs text-red-600 font-medium">{usernameError}</p>
              )}
              <p className="text-xs text-gray-500">
                3-16 characters, letters, numbers, and underscores only
              </p>
            </div>

            <button
              onClick={handleUsernameNext}
              disabled={!username || username.trim().length === 0 || isCheckingUsername || (shouldCheckAvailability && isTaken === true)}
              className={cn(
                "w-full py-3 px-4 rounded-lg border-2 font-bold text-sm",
                "bg-delulu-yellow-reserved text-delulu-charcoal",
                "border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                "hover:bg-delulu-yellow-reserved/90 hover:shadow-[4px_4px_0px_0px_#1A1A1A]",
                "active:scale-[0.98] active:shadow-[2px_2px_0px_0px_#1A1A1A]",
                "transition-all duration-100",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_#1A1A1A]",
                "flex items-center justify-center gap-2"
              )}
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Email */}
        {currentStep === "email" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
             
              <h2 className="text-xl font-black text-delulu-charcoal tracking-tight">
                Where should we send your winnings?
              </h2>
              <p className="text-sm text-delulu-charcoal/70 font-medium">
                We&apos;ll notify you when you achieve your goal 
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-xs font-bold text-delulu-charcoal/80 uppercase tracking-wider"
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
                  "w-full px-4 py-3 rounded-lg border-2 font-medium text-delulu-charcoal",
                  "bg-white focus:outline-none focus:ring-2 focus:ring-delulu-yellow-reserved/50",
                  "transition-all",
                  emailError
                    ? "border-red-500 shadow-[2px_2px_0px_0px_#ef4444]"
                    : "border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] focus:shadow-[3px_3px_0px_0px_#1A1A1A]"
                )}
              />
              {emailError && (
                <p className="text-xs text-red-600 font-medium">{emailError}</p>
              )}
            
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep("username")}
                className={cn(
                  "flex-1 py-3 px-4 rounded-lg border-2 font-bold text-sm",
                  "bg-white text-delulu-charcoal",
                  "border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A]",
                  "hover:bg-gray-50 hover:shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "active:scale-[0.98] active:shadow-[1px_1px_0px_0px_#1A1A1A]",
                  "transition-all duration-100",
                  "flex items-center justify-center gap-2"
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleEmailSubmit}
                disabled={!email || email.trim().length === 0 || isSettingProfile}
                className={cn(
                  "flex-1 py-3 px-4 rounded-lg border-2 font-bold text-sm",
                  "bg-delulu-yellow-reserved text-delulu-charcoal",
                  "border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "hover:bg-delulu-yellow-reserved/90 hover:shadow-[4px_4px_0px_0px_#1A1A1A]",
                  "active:scale-[0.98] active:shadow-[2px_2px_0px_0px_#1A1A1A]",
                  "transition-all duration-100",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[3px_3px_0px_0px_#1A1A1A]",
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
                    Complete
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}
