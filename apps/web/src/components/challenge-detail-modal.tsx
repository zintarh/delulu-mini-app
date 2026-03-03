"use client";

import { useState } from "react";
import { Trophy, Medal, User, Loader2, X } from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useAllocatePoints } from "@/hooks/use-allocate-points";
import type { Challenge } from "@/hooks/use-challenges";
import { formatDistanceToNow } from "date-fns";

interface ChallengeDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: Challenge | null;
}

// Mock leaderboard data - in production, this would come from the contract
const MOCK_LEADERBOARD = [
  {
    deluluId: 1,
    creator: "0x1234567890123456789012345678901234567890",
    username: "fitness_guru",
    points: 450,
    deluluTitle: "I'll hit the gym 5x this week",
  },
  {
    deluluId: 2,
    creator: "0x2345678901234567890123456789012345678901",
    username: "marathon_runner",
    points: 380,
    deluluTitle: "Training for my first marathon",
  },
  {
    deluluId: 3,
    creator: "0x3456789012345678901234567890123456789012",
    username: "adventure_seeker",
    points: 320,
    deluluTitle: "Going on 3 dates with strangers this month",
  },
  {
    deluluId: 4,
    creator: "0x4567890123456789012345678901234567890123",
    username: "gym_enthusiast",
    points: 250,
    deluluTitle: "Consistent gym routine for 2 weeks",
  },
  {
    deluluId: 5,
    creator: "0x5678901234567890123456789012345678901234",
    username: "runner_pro",
    points: 180,
    deluluTitle: "Running 10km every day",
  },
];

export function ChallengeDetailModal({
  open,
  onOpenChange,
  challenge,
}: ChallengeDetailModalProps) {
  const { isAdmin } = useIsAdmin();
  const { allocatePoints, isAllocating, isConfirming, isSuccess, errorMessage } = useAllocatePoints();
  const [editingPoints, setEditingPoints] = useState<number | null>(null);
  const [pointsInput, setPointsInput] = useState<string>("");
  const [leaderboard] = useState(MOCK_LEADERBOARD);

  if (!challenge) return null;

  const handleAllocatePoints = async (deluluId: number) => {
    const points = parseInt(pointsInput);
    if (isNaN(points) || points < 0) {
      alert("Please enter a valid number of points");
      return;
    }

    try {
      await allocatePoints(deluluId, points);
      setEditingPoints(null);
      setPointsInput("");
      // In production, refetch leaderboard here
    } catch (error) {
      console.error("Failed to allocate points:", error);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-delulu-yellow" />
              <ModalTitle className="text-2xl font-black text-delulu-charcoal">
                {challenge.title || `Challenge #${challenge.id}`}
              </ModalTitle>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </ModalHeader>

        <div className="space-y-6">
          {/* Challenge Info */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            {challenge.description && (
              <p className="text-sm text-gray-700 mb-3">{challenge.description}</p>
            )}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-delulu-yellow" />
                <span className="font-bold text-delulu-charcoal">
                  {challenge.poolAmount.toFixed(2)} Prize Pool
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Ends:</span>
                <span className="font-medium text-delulu-charcoal">
                  {formatDistanceToNow(challenge.endTime, { addSuffix: true })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Total Points:</span>
                <span className="font-bold text-delulu-charcoal">
                  {challenge.totalPoints}
                </span>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div>
            <h3 className="text-lg font-bold text-delulu-charcoal mb-4 flex items-center gap-2">
              <Medal className="w-5 h-5 text-delulu-yellow" />
              Leaderboard
            </h3>

            {leaderboard.length === 0 ? (
              <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center">
                <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No participants yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Be the first to join this challenge!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isEditing = editingPoints === entry.deluluId;

                  return (
                    <div
                      key={entry.deluluId}
                      className={cn(
                        "bg-white rounded-lg border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] p-4",
                        rank <= 3 && "bg-gradient-to-r from-yellow-50 to-white"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex-shrink-0 w-10 text-center">
                            <span className="text-lg font-black text-delulu-charcoal">
                              {getRankIcon(rank)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="font-bold text-delulu-charcoal">
                                {entry.username || `${entry.creator.slice(0, 6)}...${entry.creator.slice(-4)}`}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 truncate">
                              {entry.deluluTitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-delulu-yellow" />
                            <span className="font-black text-lg text-delulu-charcoal">
                              {entry.points}
                            </span>
                            <span className="text-xs text-gray-500">pts</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={pointsInput}
                                  onChange={(e) => setPointsInput(e.target.value)}
                                  placeholder="Points"
                                  className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-delulu-charcoal/15"
                                  min="0"
                                />
                                <button
                                  onClick={() => handleAllocatePoints(entry.deluluId)}
                                  disabled={isAllocating || isConfirming}
                                  className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-md border-2 border-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] transition-all",
                                    isAllocating || isConfirming
                                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                                      : "bg-delulu-yellow-reserved text-delulu-charcoal hover:shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98]"
                                  )}
                                >
                                  {isAllocating || isConfirming ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    "Save"
                                  )}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingPoints(null);
                                    setPointsInput("");
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold rounded-md border-2 border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingPoints(entry.deluluId);
                                  setPointsInput(entry.points.toString());
                                }}
                                className="px-4 py-1.5 text-xs font-bold rounded-md border-2 border-delulu-charcoal bg-white text-delulu-charcoal shadow-[2px_2px_0px_0px_#1A1A1A] hover:shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all"
                              >
                                Allocate Points
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
