"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2, X, Upload, DollarSign } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { FeedbackModal } from "@/components/feedback-modal";
// import { DatePicker } from "@/components/date-picker";
import { Slider } from "@/components/slider";
import { useCreateDelulu } from "@/hooks/use-delulu-contract";
import { useTokenApproval } from "@/hooks/use-token-approval";
import { useCUSDBalance } from "@/hooks/use-cusd-balance";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import { type GatekeeperConfig } from "@/lib/ipfs";
import { GatekeeperStep } from "@/components/create/gatekeeper-step";
import {
  MAX_DELULU_LENGTH,
  MIN_STAKE,
  MAX_STAKE,
  getDefaultDeadline,
  validateDeluluInputs,
  clampStakeValue,
  calculateMaxStakeValue,
  getErrorMessage,
  checkAllowanceWithRetry,
  getProgressStep,
  getOrigin,
} from "@/lib/create-delulu-helpers";

interface CreateDelusionContentProps {
  onClose: () => void;
}

const TEMPLATES = [
  {
    id: 1,
    name: "New Job",
    image: "/templates/t0.png",
    fontWeight: "700",
  },
  {
    id: 2,
    name: "Software Engineer",
    image: "/templates/t1.jpg",
    fontWeight: "700",
  },
  {
    id: 3,
    name: "Traveller",
    image: "/templates/t2.png",
    fontWeight: "700",
  },

  {
    id: 4,
    name: "Startup",
    image: "/templates/t9.jpg",
    fontWeight: "700",
  },
  {
    id: 5,
    name: "Relationship",
    image: "/templates/t3.png",
    fontWeight: "700",
  },

  {
    id: 6,
    name: "Graduate",
    image: "/templates/t6.jpg",
    fontWeight: "700",
  },

  {
    id: 7,
    name: "Workout",
    image: "/templates/t8.jpg",
    fontWeight: "700",
  },
];

type Step = "gallery" | "customize" | "duration" | "stake" | "submit";

export function CreateDelusionContent({ onClose }: CreateDelusionContentProps) {
  const { user } = useUserStore();

  // Validate user exists
  if (!user) {
    console.warn("[CreateDelusionContent] User not authenticated");
  }

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

  const [deadline, setDeadline] = useState<Date>(() => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + 60); // Default to 60 minutes
    return date;
  });
  const [selectedDuration, setSelectedDuration] = useState<number>(60);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const approvalProcessingRef = useRef(false);

  const {
    createDelulu,
    isPending: isCreating,
    isSuccess,
    isError,
    errorMessage: createErrorMessage,
    isConfirming,
  } = useCreateDelulu();

  const {
    approve,
    needsApproval,
    isPending: isApproving,
    isConfirming: isApprovingConfirming,
    isSuccess: isApprovalSuccess,
    refetchAllowance,
  } = useTokenApproval();

  const { balance: cusdBalance } = useCUSDBalance();

  // Effects
  useEffect(() => {
    if (isSuccess) {
      setShowSuccessModal(true);
    }
  }, [isSuccess]);

  useEffect(() => {
    if (isError && createErrorMessage) {
      const friendlyMessage = getErrorMessage(new Error(createErrorMessage));
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    }
  }, [isError, createErrorMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setPendingCreation(null);
      setIsWaitingForApproval(false);
      approvalProcessingRef.current = false;
    };
  }, []);

  // After approval succeeds, clear the waiting state so user can manually click "Manifest" to create
  // NO AUTO-TRIGGER - user must click "Manifest" button themselves
  useEffect(() => {
    if (isApprovalSuccess && pendingCreation) {
      // Clear waiting state - user must manually click "Manifest" button to proceed with creation
      setIsWaitingForApproval(false);
      approvalProcessingRef.current = false;
    }
  }, [isApprovalSuccess, pendingCreation]);

  useEffect(() => {
    if (step === "customize" && titleInputRef.current) {
      const timeoutId = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
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
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file");
      setShowErrorModal(true);
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrorMessage("Image size must be less than 10MB");
      setShowErrorModal(true);
      return;
    }

    // Store the File object for later upload
    setCustomUploadFile(file);

    // Also create a preview URL for display
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result && typeof result === "string") {
        setCustomImage(result);
        setSelectedImage(result);
        setSelectedTemplate(null);
        setStep("customize");
      } else {
        console.error("Failed to read file");
        setErrorMessage("Failed to load image. Please try again.");
        setShowErrorModal(true);
      }
    };
    reader.onerror = () => {
      console.error("FileReader error");
      setErrorMessage("Failed to read image file. Please try again.");
      setShowErrorModal(true);
    };
    reader.readAsDataURL(file);
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
    const date = new Date();
    date.setMinutes(date.getMinutes() + 60);
    setDeadline(date);
    setSelectedDuration(60);
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

  // Calculate validation values using helpers (moved before handleCreate)
  const maxStakeValue = calculateMaxStakeValue(cusdBalance);
  const validation = validateDeluluInputs(
    delusionText,
    stakeAmount,
    maxStakeValue,
    selectedImage
  );

  const canCreate = validation.canCreate && !isUploadingImage;
  const hasInputError = !validation.isValid;
  const exceedsBalance = stakeAmount > maxStakeValue;
  const hasInsufficientBalanceForStake = maxStakeValue < MIN_STAKE;

  const progressStep = getProgressStep(
    isUploadingImage,
    isApproving,
    isApprovingConfirming,
    isCreating,
    isConfirming
  );

  const isProcessing =
    isCreating ||
    isApproving ||
    isApprovingConfirming ||
    isUploadingImage ||
    (isWaitingForApproval && !isApprovalSuccess);

  const handleCreate = async () => {
    // Prevent multiple simultaneous calls
    if (isProcessing) {
      return;
    }
    setIsUploadingImage(true);

    try {
      const maxStakeValue = calculateMaxStakeValue(cusdBalance);
      const validation = validateDeluluInputs(
        delusionText,
        stakeAmount,
        maxStakeValue,
        selectedImage
      );

      if (!validation.isValid) {
        const firstError =
          validation.errors.text ||
          validation.errors.stake ||
          validation.errors.balance ||
          validation.errors.image;
        setIsUploadingImage(false);
        throw new Error(firstError || "Please check your inputs");
      }

      // User manually clicked "Manifest" button after approval - proceed with creation
      if (pendingCreation && !isApproving && !isApprovingConfirming) {
        // Validate pending creation data
        if (
          !pendingCreation.deadline ||
          !(pendingCreation.deadline instanceof Date) ||
          isNaN(pendingCreation.deadline.getTime()) ||
          !pendingCreation.finalImageUrl ||
          typeof pendingCreation.finalImageUrl !== "string"
        ) {
          setIsUploadingImage(false);
          throw new Error("Invalid creation data. Please start over.");
        }

        // Use helper function for allowance check with retry
        let hasAllowance = false;
        try {
          hasAllowance = await checkAllowanceWithRetry(
            refetchAllowance,
            stakeAmount
          );
        } catch (error) {
          console.error("[handleCreate] Allowance check failed:", error);
          setIsUploadingImage(false);
          throw new Error(
            "Failed to verify token allowance. Please try again."
          );
        }

        if (hasAllowance) {
          await createDelulu(
            delusionText,
            pendingCreation.deadline,
            stakeAmount,
            user?.username,
            user?.pfpUrl,
            gatekeeper,
            pendingCreation.finalImageUrl
          );
          setPendingCreation(null);
          setIsUploadingImage(false);
          return;
        } else {
          setIsUploadingImage(false);
          throw new Error("Token allowance not updated. Please try again.");
        }
      }

      // Validate deadline
      const deadlineDate =
        deadline instanceof Date && !isNaN(deadline.getTime())
          ? deadline
          : getDefaultDeadline();

      let finalImageUrl: string;

      // Determine final image URL
      if (customUploadFile) {
        try {
          // Upload custom file with timeout protection
          const formData = new FormData();
          formData.append("file", customUploadFile);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to upload image");
          }

          const data = (await response.json()) as { url?: string };
          if (!data?.url || typeof data.url !== "string") {
            throw new Error("No image URL returned from upload");
          }
          finalImageUrl = data.url;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Image upload timed out. Please try again.");
          }
          throw error;
        }
      } else if (selectedTemplate?.image) {
        // Use template - construct absolute URL using helper
        const origin = getOrigin();
        finalImageUrl = `${origin}${selectedTemplate.image}`;
      } else {
        setIsUploadingImage(false);
        throw new Error("Please select a template or upload an image");
      }

      // Check if approval is needed before creating
      if (needsApproval(stakeAmount)) {
        // Store creation params and trigger approval
        setPendingCreation({
          deadline: deadlineDate,
          finalImageUrl,
        });
        setIsWaitingForApproval(true);
        // Reset image upload state since we're waiting for approval
        setIsUploadingImage(false);
        // Trigger approval ONLY - user must manually click "Manifest" button again after approval completes
        await approve(stakeAmount);
        return; // Exit - do NOT create automatically
      }

      // Approval not needed, proceed directly with creation
      // Note: isUploadingImage stays true during creation to show loading state
      await createDelulu(
        delusionText,
        deadlineDate,
        stakeAmount,
        user?.username,
        user?.pfpUrl,
        gatekeeper,
        finalImageUrl
      );
      // Reset loading state after successful creation
      setIsUploadingImage(false);
    } catch (error) {
      setIsUploadingImage(false);
      setPendingCreation(null);
      setIsWaitingForApproval(false);
      const friendlyMessage = getErrorMessage(error);
      setErrorMessage(friendlyMessage);
      setShowErrorModal(true);
    }
  };

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
                onError={(e) => {
                  console.error("Failed to load background image");
                  e.currentTarget.style.display = "none";
                }}
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
          <div className="pt-20 pb-8 px-4 lg:px-8 h-screen overflow-y-auto">
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
                          className="text-white font-bold text-xl  text-center px-4 drop-shadow-lg"
                          style={{
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
                  Staking Duration
                </h2>

                <div className="mb-6">
                  <div className="grid grid-cols-3 gap-3">
                    {[10, 20, 30, 40, 50, 60].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => {
                          const date = new Date();
                          date.setMinutes(date.getMinutes() + minutes);
                          setDeadline(date);
                          setSelectedDuration(minutes);
                        }}
                        className={cn(
                          "py-4 px-6 rounded-lg font-bold text-lg transition-all border-2",
                          selectedDuration === minutes
                            ? "bg-delulu-yellow-reserved text-delulu-charcoal border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]"
                            : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                        )}
                      >
                        {minutes} min
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-white/50 text-center mt-4">
                    Max 1 hour
                  </p>
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
                        value={[clampStakeValue(stakeAmount)]}
                        onValueChange={(values) => {
                          if (values && values[0] !== undefined) {
                            const newVal = clampStakeValue(values[0]);
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
                                setStakeAmount(clampStakeValue(num));
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
                                : clampStakeValue(num);
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
                            ? `Amount exceeds your balance of ${maxStakeValue.toFixed(
                                2
                              )} cUSD.`
                            : "Minimum stake is 1.0 cUSD."}
                        </p>
                      )}
                    </div>

                    {cusdBalance && (
                      <p className="text-xs text-white/60 mt-2">
                        Balance:{" "}
                        {(() => {
                          const balance = parseFloat(cusdBalance.formatted);
                          return isNaN(balance) ? "0.00" : balance.toFixed(2);
                        })()}{" "}
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
                    {progressStep?.label || "Processing..."}
                  </span>
                ) : (
                  "Manifest"
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
