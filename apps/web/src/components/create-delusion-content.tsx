"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, Loader2, X, Upload, DollarSign } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { parseUnits } from "viem";
import { FeedbackModal } from "@/components/feedback-modal";
import { DatePicker } from "@/components/date-picker";
import { Slider } from "@/components/slider";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import { type GatekeeperConfig } from "@/lib/ipfs";
import { GatekeeperStep } from "@/components/create/gatekeeper-step";

interface CreateDelusionContentProps {
  onClose: () => void;
}

const TEMPLATES = [
  {
    id: 1,
    name: "Content Creator",
    image: "/templates/t0.png",
    font: "var(--font-gloria)",
    fontWeight: "400",
  },
  {
    id: 2,
    name: "Solo Trip",
    image: "/templates/t1.png",
    font: "var(--font-dancing)",
    fontWeight: "700",
  },
  {
    id: 3,
    name: "Luxury Traveler",
    image: "/templates/t2.png",
    font: "var(--font-caveat)",
    fontWeight: "700",
  },
];

type Step = "gallery" | "customize" | "duration" | "stake" | "submit";

const MAX_DELULU_LENGTH = 140;
const MIN_STAKE = 1;
const MAX_STAKE = 1000;

export function CreateDelusionContent({ onClose }: CreateDelusionContentProps) {
  const { isConnected } = useAccount();
  const router = useRouter();
  const { user } = useUserStore();

  // Step management
  const [step, setStep] = useState<Step>("gallery");

  // Template/Image state
  const [selectedTemplate, setSelectedTemplate] = useState<
    (typeof TEMPLATES)[0] | null
  >(null);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customUploadFile, setCustomUploadFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingCreation, setPendingCreation] = useState<{
    deadline: Date;
    finalImageUrl: string;
  } | null>(null);
  const [isWaitingForApproval, setIsWaitingForApproval] = useState(false);

  // Form state
  const [delusionText, setDelusionText] = useState("");
  const [stakeAmount, setStakeAmount] = useState<number>(1);
  const [inputText, setInputText] = useState<string>("1.0");
  const [gatekeeper, setGatekeeper] = useState<GatekeeperConfig | null>(null);

  // Date helpers
  const getDefaultDeadline = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(12, 0, 0, 0);
    return date;
  };

  const getMinDeadline = () => {
    const date = new Date();
    date.setHours(date.getHours() + 24);
    return date;
  };

  const getMaxDeadline = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date;
  };

  const [deadline, setDeadline] = useState<Date>(getDefaultDeadline());
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const approvalProcessingRef = useRef(false);

  const {
    createDelulu,
    isPending: isCreating,
    isConfirming,
    isSuccess,
    error: createError,
    backendSyncStatus,
    backendSyncError,
    isBackendSyncing,
    isFullyComplete,
  } = useCreateDelulu();

  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
    isLoadingAllowance,
  } = useTokenApproval();

  const { balance: cusdBalance, isLoading: isLoadingBalance } =
    useCUSDBalance();

  // Effects
  useEffect(() => {
    if (isFullyComplete) {
      setShowSuccessModal(true);
    }
  }, [isFullyComplete]);

  useEffect(() => {
    if (backendSyncStatus === "failed" && backendSyncError) {
      setErrorMessage(
        `Transaction succeeded but backend sync failed: ${backendSyncError}. Your delulu is on-chain but may not appear in the feed.`
      );
      setShowErrorModal(true);
    }
  }, [backendSyncStatus, backendSyncError]);

  useEffect(() => {
    if (createError) {
      setErrorMessage(createError.message || "Failed to create delusion");
      setShowErrorModal(true);
    }
  }, [createError]);

  // After approval succeeds, wait for allowance to update then proceed with creation
  useEffect(() => {
    if (isApprovalSuccess && pendingCreation && !approvalProcessingRef.current) {
      // Prevent duplicate execution
      approvalProcessingRef.current = true;
      setIsWaitingForApproval(true);
      
      // Poll for allowance update instead of fixed delay
      const checkAllowance = async () => {
        let attempts = 0;
        const maxAttempts = 10; // 5 seconds max (500ms * 10)
        
        const poll = async () => {
          const result = await refetchAllowance();
          attempts++;
          
          if (result.data) {
            const amountWei = parseUnits(stakeAmount.toString(), 18);
            if (result.data >= amountWei) {
              // Allowance is sufficient, proceed with creation
              createDelulu(
                delusionText,
                pendingCreation.deadline,
                stakeAmount,
                user?.username,
                user?.pfpUrl,
                gatekeeper,
                pendingCreation.finalImageUrl
              );
              setPendingCreation(null);
              setIsWaitingForApproval(false);
              approvalProcessingRef.current = false;
              return;
            }
          }
          
          if (attempts < maxAttempts) {
            setTimeout(poll, 500); // Check every 500ms
          } else {
            // Timeout - proceed anyway (allowance should be updated by now)
            createDelulu(
              delusionText,
              pendingCreation.deadline,
              stakeAmount,
              user?.username,
              user?.pfpUrl,
              gatekeeper,
              pendingCreation.finalImageUrl
            );
            setPendingCreation(null);
            setIsWaitingForApproval(false);
            approvalProcessingRef.current = false;
          }
        };
        
        // Start polling after a brief initial delay
        setTimeout(poll, 300);
      };
      
      checkAllowance();
    }
  }, [isApprovalSuccess, pendingCreation, refetchAllowance, stakeAmount, delusionText, user?.username, user?.pfpUrl, gatekeeper, createDelulu]);

  useEffect(() => {
    if (step === "customize" && titleInputRef.current) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [step]);

  
  const handleTemplateSelect = (template: (typeof TEMPLATES)[0]) => {
    setSelectedTemplate(template);
    setSelectedImage(template.image);
    setCustomImage(null);
    setStep("customize");
  };

  const handleCustomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store the File object for later upload
      setCustomUploadFile(file);
      
      // Also create a preview URL for display
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target?.result as string;
        setCustomImage(imageUrl);
        setSelectedImage(imageUrl);
        setSelectedTemplate(null);
        setStep("customize");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBack = () => {
    if (step === "customize") {
      setStep("gallery");
    } else if (step === "duration") {
      setStep("customize");
    } else if (step === "stake") {
      setStep("duration");
    }
  };

  const handleClose = () => {
    setStep("gallery");
    setStakeAmount(1);
    setInputText("1.0");
    setDelusionText("");
    setDeadline(getDefaultDeadline());
    setGatekeeper(null);
    setSelectedTemplate(null);
    setCustomImage(null);
    setSelectedImage(null);
    setCustomUploadFile(null);
    setIsUploadingImage(false);
    setPendingCreation(null);
    setIsWaitingForApproval(false);
    approvalProcessingRef.current = false;
    onClose();
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    handleClose();
  };

  const handleCreate = async () => {
    try {
      setIsUploadingImage(true);
      
      const deadlineDate = new Date(deadline);
      let finalImageUrl: string;

      // Determine final image URL
      if (customUploadFile) {
        // Upload custom file to IPFS
        const formData = new FormData();
        formData.append("file", customUploadFile);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to upload image");
        }

        const data = await response.json();
        finalImageUrl = data.url;
      } else if (selectedTemplate?.image) {
        // Use template - construct absolute URL
        const origin = typeof window !== "undefined" && window.location.origin 
          ? window.location.origin 
          : "";
        finalImageUrl = `${origin}${selectedTemplate.image}`;
      } else {
        throw new Error("Please select a template or upload an image");
      }

      setIsUploadingImage(false);

      // Check if approval is needed before creating
      if (needsApproval(stakeAmount)) {
        // Store creation params and trigger approval
        setPendingCreation({
          deadline: deadlineDate,
          finalImageUrl,
        });
        setIsWaitingForApproval(true);
        // Trigger approval - creation will proceed after approval succeeds
        await approve(stakeAmount);
        return;
      }

      // Approval not needed, proceed directly with creation
      await createDelulu(
        delusionText,
        deadlineDate,
        stakeAmount,
        user?.username,
        user?.pfpUrl,
        gatekeeper,
        finalImageUrl
      );
    } catch (error) {
      setIsUploadingImage(false);
      setPendingCreation(null);
      setIsWaitingForApproval(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create delusion"
      );
      setShowErrorModal(true);
    }
  };

  const hasInsufficientBalance = cusdBalance
    ? parseFloat(cusdBalance.formatted) < stakeAmount
    : false;

  const canCreate =
    delusionText.trim().length > 0 &&
    stakeAmount >= MIN_STAKE &&
    !hasInsufficientBalance &&
    !isUploadingImage;

  // Calculate max stake value (for balance validation only, not UI range)
  const maxStakeValue = useMemo(() => {
    if (cusdBalance?.formatted) {
      const balance = parseFloat(cusdBalance.formatted);
      if (!isNaN(balance)) {
        // Return actual balance (even if 0 or less than 1) for validation
        return Math.min(Math.max(balance, 0), MAX_STAKE);
      }
    }
    // If no balance data, assume 0 for validation purposes
    return 0;
  }, [cusdBalance?.formatted]);

  const clampValue = (val: number) => {
    return Math.min(Math.max(val, MIN_STAKE), MAX_STAKE);
  };

  // Check if stake amount is below minimum for error display
  const isBelowMinimum = stakeAmount < MIN_STAKE;
  
  // Check if stake amount exceeds balance
  const exceedsBalance = stakeAmount > maxStakeValue;
  
  // Check if balance is less than minimum stake
  const hasInsufficientBalanceForStake = maxStakeValue < MIN_STAKE;
  
  // Combined error state: red if below minimum, exceeds balance, or balance too low
  const hasInputError = isBelowMinimum || exceedsBalance || hasInsufficientBalanceForStake;

  const isProcessing =
    isCreating ||
    isConfirming ||
    isApproving ||
    isApprovingConfirming ||
    isBackendSyncing ||
    isUploadingImage ||
    isWaitingForApproval;

  return (
    <>
      {(step === "customize" || step === "duration" || step === "stake") &&
        selectedImage && (
          <>
            <div className="fixed inset-0 z-0 flex max-w-4xl mx-auto items-center justify-center bg-black pointer-events-none">
              <img
                src={selectedImage}
                alt="Background"
                className="w-full h-full object-cover bg-center no-repeat"
              />
            </div>
            <div className="fixed inset-0 z-0 bg-black/60 pointer-events-none" />
          </>
        )}

      <div
        className={cn(
          "relative min-h-screen z-10 max-w-4xl mx-auto",
          step === "gallery" && "bg-white"
        )}
      >
        {/* Top Navigation */}
        <div className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex items-center justify-between ">
          {step !== "gallery" ? (
            <div className=" w-full flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-12 h-12 rounded-full text-white/70 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>

              <h1
                className="text-4xl font-black text-delulu-yellow-reserved"
                style={{
                  fontFamily: "var(--font-gloria), cursive",
                  textShadow:
                    "3px 3px 0px #fffff, -2px -2px 0px # #fffff, 2px -2px 0px #ffffff, -2px 2px 0px  #fffff",
                }}
              >
                Delulu
              </h1>

              <button
                onClick={handleClose}
                className="flex items-center justify-center w-12 h-12 rounded-full text-white/70 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
          ) : (
            <div className=" w-full flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-12 h-12 rounded-full text-black hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft className="w-7 h-7" />
              </button>

              <h1
                className="text-4xl font-black text-delulu-yellow-reserved"
                style={{
                  fontFamily: "var(--font-gloria), cursive",
                  textShadow:
                    "3px 3px 0px #000000, -2px -2px 0px #000000, 2px -2px 0px #000000, -2px 2px 0px  #000000",
                }}
              >
                Delulu
              </h1>

              <button
                onClick={handleClose}
                className="flex items-center justify-center w-12 h-12 rounded-full text-black hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-7 h-7" />
              </button>
            </div>
          )}
        </div>

        {/* Step 1: Template Gallery */}
        {step === "gallery" && (
          <div className="pt-20 pb-8 px-4 lg:px-8">
            <div className="max-w-6xl mx-auto">
              <h1 className="text-3xl font-black text-delulu-charcoal mb-8 text-center">
                Choose your board aesthetic.
              </h1>

              {/* Grid Layout */}
              <div className="grid grid-cols-2 gap-4">
                {/* Upload Custom Card - First */}
                <label className="relative w-full rounded-xl overflow-hidden group cursor-pointer block transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
                  <div className="relative aspect-square">
                    <img
                      src="/templates/customize.png"
                      alt="Upload your own vision"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Upload className="w-12 h-12 text-white group-hover:text-delulu-yellow-reserved transition-colors drop-shadow-lg" />
                      <p className="text-white font-bold text-xl sm:text-2xl drop-shadow-lg text-center px-4">
                        Upload your own vision
                      </p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomUpload}
                    className="hidden"
                  />
                </label>

                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="relative w-full rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
                  >
                    <div className="relative aspect-square">
                      <img
                        src={template.image}
                        alt={template.name}
                        className="w-full h-full object-cover rounded-xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p
                          className="text-white font-bold text-2xl sm:text-2xl text-center px-4 drop-shadow-lg"
                          style={{
                            fontFamily: template.font,
                            fontWeight: template.fontWeight,
                          }}
                        >
                          {template.name}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "customize" && selectedImage && (
          <>
            <div className="relative min-h-screen flex items-center justify-center px-4">
              <div className="w-full max-w-2xl mx-auto text-center">
                <TextareaAutosize
                  ref={titleInputRef as React.RefObject<HTMLTextAreaElement>}
                  value={delusionText}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.length <= MAX_DELULU_LENGTH) {
                      setDelusionText(value);
                    }
                  }}
                  placeholder="Type  here..."
                  className={cn(
                    "w-full text-center bg-transparent border-none outline-none text-white placeholder:text-white/80 font-bold resize-none leading-tight",
                    delusionText.length > 50 ? "text-base" : "text-2xl"
                  )}
                  maxLength={MAX_DELULU_LENGTH}
                  minRows={1}
                />
                <div className="text-center mt-6">
                  <span className="text-sm text-white/60">
                    {delusionText.length}/{MAX_DELULU_LENGTH}
                  </span>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 max-w-lg mx-auto  left-0 right-0 z-50 px-4 py-6">
              {delusionText.trim() && (
                <button
                  onClick={() => setStep("duration")}
                  disabled={!delusionText.trim()}
                  className={cn(
                    "w-full py-4 rounded-md font-bold text-lg transition-all border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                    delusionText.trim()
                      ? "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300 shadow-[3px_3px_0px_0px_#D1D5DB]"
                  )}
                >
                  Continue
                </button>
              )}
            </div>
          </>
        )}

        {step === "duration" && selectedImage && (
          <>
            <div className="relative min-h-screen flex items-center justify-center px-4 py-20">
              <div className="w-full max-w-2xl mx-auto">
                <h2 className="text-2xl font-black text-white/90 mb-6 text-center">
                  Resolution Deadline
                </h2>

                <div className="mb-6">
                  <DatePicker
                    value={deadline}
                    onChange={(date) => date && setDeadline(date)}
                    minDate={getMinDeadline()}
                    maxDate={getMaxDeadline()}
                  />
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 max-w-lg mx-auto  left-0 right-0 z-50 px-4 py-6">
              <button
                onClick={() => setStep("stake")}
                className="w-full py-4 rounded-md font-bold text-lg transition-all border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "stake" && selectedImage && (
          <>
            <div className="relative min-h-screen flex items-center justify-center px-4 py-20 pb-32 z-20">
              <div
                className="w-full max-w-2xl mx-auto space-y-6 relative z-20"
                style={{ pointerEvents: "auto" }}
              >
                <h2 className="text-2xl font-black text-white/90 mb-6 text-center">
                  Skin in the game
                </h2>

                <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 p-6 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-white/90 mb-4">
                      Initial Stake Amount (cUSD)
                    </label>

                    {/* Slider */}
                    <div
                      className="mb-4"
                      style={{ position: "relative", zIndex: 10 }}
                    >
                      <Slider
                        value={[clampValue(stakeAmount)]}
                        onValueChange={(values) => {
                          if (values && values[0] !== undefined) {
                            const newVal = clampValue(values[0]);
                            setStakeAmount(newVal);
                            setInputText(newVal.toFixed(1));
                          }
                        }}
                        min={MIN_STAKE}
                        max={MAX_STAKE}
                        step={0.1}
                        className="delulu-slider"
                        disabled={false}
                      />
                    </div>

                    {/* Input */}
                    <div className="space-y-1">
                      <div
                        className="relative"
                        style={{ position: "relative", zIndex: 10 }}
                      >
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70 pointer-events-none" />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={inputText}
                          onChange={(e) => {
                            const text = e.target.value;
                            // Only allow numbers and a single decimal point
                            if (text === "" || /^\d*\.?\d*$/.test(text)) {
                              setInputText(text);
                              const num = parseFloat(text);
                              if (!isNaN(num) && num > 0) {
                                setStakeAmount(clampValue(num));
                              }
                            }
                          }}
                          onFocus={(e) => {
                            e.target.select();
                          }}
                          onBlur={() => {
                            const num = parseFloat(inputText);
                            const clamped =
                              isNaN(num) || num < MIN_STAKE
                                ? MIN_STAKE
                                : clampValue(num);
                            setStakeAmount(clamped);
                            setInputText(clamped.toFixed(1));
                          }}
                          readOnly={false}
                          disabled={false}
                          className={cn(
                            "w-full pl-12 pr-4 py-3 rounded-lg border-2 bg-transparent text-white placeholder:text-white/50 focus:outline-none focus:ring-2 text-lg font-semibold",
                            hasInputError
                              ? "border-red-500 focus:border-red-500 focus:ring-red-500/20"
                              : "border-white/30 focus:border-delulu-yellow-reserved focus:ring-delulu-yellow-reserved/20"
                          )}
                          style={{ pointerEvents: "auto" }}
                        />
                      </div>
                      {hasInputError && (
                        <p className="text-xs text-red-400">
                          {hasInsufficientBalanceForStake
                            ? `Insufficient balance. You need at least ${MIN_STAKE} cUSD to stake.`
                            : exceedsBalance
                            ? `Amount exceeds your balance of ${maxStakeValue.toFixed(2)} cUSD.`
                            : "Minimum stake is 1.0 cUSD."}
                        </p>
                      )}
                    </div>

                    {cusdBalance && (
                      <p className="text-xs text-white/60 mt-2">
                        Balance: {parseFloat(cusdBalance.formatted).toFixed(2)}{" "}
                        cUSD
                      </p>
                    )}
                  </div>

                  {/* Gatekeeper Component */}
                  <div className="pt-4 border-t border-white/20">
                    <GatekeeperStep
                      value={gatekeeper}
                      onChange={setGatekeeper}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="fixed bottom-0 max-w-lg mx-auto  left-0 right-0 z-50 px-4 py-6">
              <button
                onClick={handleCreate}
                disabled={!canCreate || isProcessing}
                className={cn(
                  "w-full py-4 rounded-md font-bold text-lg transition-all border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
                  canCreate && !isProcessing
                    ? "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300 shadow-[3px_3px_0px_0px_#D1D5DB]"
                )}
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isUploadingImage
                      ? "Preparing image..."
                      : isApproving || isApprovingConfirming
                      ? "Approving tokens..."
                      : isWaitingForApproval
                      ? "Waiting for approval..."
                      : isBackendSyncing
                      ? "Syncing..."
                      : "Creating..."}
                  </span>
                ) : (
                  "Manifest It"
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <FeedbackModal
        isOpen={showSuccessModal}
        type="success"
        title="Vision Manifested! 🎉"
        message="Your delulu has been created and is now live on the platform!"
        onClose={handleSuccessClose}
        actionText="Done"
      />

      <FeedbackModal
        isOpen={showErrorModal}
        type="error"
        title="Creation Failed"
        message={errorMessage || "Failed to create delulu. Please try again."}
        onClose={() => setShowErrorModal(false)}
        actionText="Try Again"
      />
    </>
  );
}
