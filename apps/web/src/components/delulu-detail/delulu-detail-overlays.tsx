"use client";

import dynamic from "next/dynamic";
import type { EditSheetMode } from "@/components/edit-delulu-sheet";
import type { GraphMilestone } from "@/hooks/graph/useGraphDelulu";
import type { NewMilestoneDraft } from "@/components/delulu-detail/delulu-milestone-preview-modal";

const FeedbackModal = dynamic(
  () => import("@/components/feedback-modal").then((m) => m.FeedbackModal),
  { ssr: false },
);
const ProofModal = dynamic(
  () => import("@/components/proof-modal").then((m) => m.ProofModal),
  { ssr: false },
);
const AiMilestonesModal = dynamic(
  () =>
    import("@/components/ai-milestones-modal").then((m) => m.AiMilestonesModal),
  { ssr: false },
);
const EditDeluluSheet = dynamic(
  () =>
    import("@/components/edit-delulu-sheet").then((m) => m.EditDeluluSheet),
  { ssr: false },
);
const DeluluTipModal = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-tip-modal").then(
      (m) => m.DeluluTipModal,
    ),
  { ssr: false },
);
const DeluluDeleteMilestoneModal = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-delete-milestone-modal").then(
      (m) => m.DeluluDeleteMilestoneModal,
    ),
  { ssr: false },
);
const DeluluMilestonePreviewModal = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-milestone-preview-modal").then(
      (m) => m.DeluluMilestonePreviewModal,
    ),
  { ssr: false },
);
const DeluluJoinCampaignModal = dynamic(
  () =>
    import("@/components/delulu-detail/delulu-join-campaign-modal").then(
      (m) => m.DeluluJoinCampaignModal,
    ),
  { ssr: false },
);

type ChallengeOption = { id: number; title?: string };

export function DeluluDetailOverlays({
  isCreator,
  deluluId,
  deluluTitle,
  deluluRemainingDaysTotal,
  onAiMilestonesDone,
  showAiMilestonesModal,
  onAiMilestonesOpenChange,
  tipModal,
  proofModal,
  feedbackModals,
  joinCampaignModal,
  deleteMilestoneModal,
  milestonePreviewModal,
  editSheet,
}: {
  isCreator: boolean;
  deluluId: string;
  deluluTitle: string;
  deluluRemainingDaysTotal: number;
  onAiMilestonesDone: () => void;
  showAiMilestonesModal: boolean;
  onAiMilestonesOpenChange: (open: boolean) => void;
  tipModal: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tokenSymbol: string;
    tipAmountInput: string;
    onTipAmountChange: (value: string) => void;
    walletBalanceNum: number;
    walletBalanceLabel: string;
    isLoadingBalance: boolean;
    toUsd: (amount: number | null | undefined) => string | null;
    marketToken?: string;
    hasNoGas: boolean;
    tipError: string | null;
    isTipping: boolean;
    isConfirming: boolean;
    onMax: () => void;
    onQuickTip: (amount: number) => void;
    onSubmit: () => void;
  };
  proofModal: {
    activeMilestoneId: string | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (imageUrl: string) => void;
    isSubmitting: boolean;
    submitSuccess: boolean;
    submitError: Error | null;
    onDone: () => void;
  };
  feedbackModals: {
    showSuccess: boolean;
    onCloseSuccess: () => void;
    showError: boolean;
    errorTitle: string;
    errorMessage: string;
    onCloseError: () => void;
  };
  joinCampaignModal: {
    open: boolean;
    challenges: ChallengeOption[];
    selectedChallengeId: number | null;
    onSelectChallenge: (id: number | null) => void;
    joinErrorMessage: string | null | undefined;
    isJoining: boolean;
    isConfirming: boolean;
    onCancel: () => void;
    onJoin: () => void;
  };
  deleteMilestoneModal: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    milestoneLabel: string | undefined;
    deleteError: Error | null;
    isSuccess: boolean;
    isDeleting: boolean;
    isConfirming: boolean;
    onConfirm: () => void;
  };
  milestonePreviewModal: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    newMilestones: NewMilestoneDraft[];
    existingMilestones: GraphMilestone[] | undefined;
    isAdding: boolean;
    isConfirming: boolean;
    isSuccess: boolean;
    onBack: () => void;
    onConfirm: () => void;
  };
  editSheet: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    mode: EditSheetMode;
    onChainId: string;
    creatorAddress: string;
    currentTitle: string;
    currentDescription: string;
    onDeleted: () => void;
  } | null;
}) {
  return (
    <>
      {isCreator ? (
        <AiMilestonesModal
          open={showAiMilestonesModal}
          onOpenChange={onAiMilestonesOpenChange}
          deluluId={deluluId}
          dreamTitle={deluluTitle}
          durationDays={deluluRemainingDaysTotal}
          onDone={onAiMilestonesDone}
        />
      ) : null}

      <DeluluTipModal {...tipModal} />

      {isCreator ? (
        <ProofModal
          open={!!proofModal.activeMilestoneId}
          onOpenChange={proofModal.onOpenChange}
          onSubmit={proofModal.onSubmit}
          isSubmitting={proofModal.isSubmitting}
          submitSuccess={proofModal.submitSuccess}
          submitError={proofModal.submitError}
          onDone={proofModal.onDone}
        />
      ) : null}

      <FeedbackModal
        isOpen={feedbackModals.showSuccess}
        type="success"
        title="Stake Success!"
        message="Your conviction has been recorded."
        onClose={feedbackModals.onCloseSuccess}
      />
      <FeedbackModal
        isOpen={feedbackModals.showError}
        type="error"
        title={feedbackModals.errorTitle}
        message={feedbackModals.errorMessage}
        onClose={feedbackModals.onCloseError}
      />

      {isCreator ? (
        <DeluluJoinCampaignModal {...joinCampaignModal} />
      ) : null}

      <DeluluDeleteMilestoneModal {...deleteMilestoneModal} />

      <DeluluMilestonePreviewModal {...milestonePreviewModal} />

      {isCreator && editSheet ? (
        <EditDeluluSheet
          open={editSheet.open}
          onOpenChange={editSheet.onOpenChange}
          mode={editSheet.mode}
          onChainId={editSheet.onChainId}
          creatorAddress={editSheet.creatorAddress}
          currentTitle={editSheet.currentTitle}
          currentDescription={editSheet.currentDescription}
          onDeleted={editSheet.onDeleted}
        />
      ) : null}
    </>
  );
}
