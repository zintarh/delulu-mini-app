import { Card } from "@/components/ui/card"
import { Users, Heart, Flame } from "lucide-react"

interface Participant {
  username: string
  side: "believe" | "doubt"
  amount: number
}

interface ParticipantsListProps {
  participants: Participant[]
}

export function ParticipantsList({ participants }: ParticipantsListProps) {
  return (
    <Card className="p-6 bg-card border border-border">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-5 h-5 text-delulu-yellow" />
        <h2 className="font-black text-xl">Participants</h2>
      </div>

      <div className="space-y-2">
        {participants.map((participant, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  participant.side === "believe" ? "bg-delulu-yellow/20" : "bg-delulu-purple/20"
                }`}
              >
                {participant.side === "believe" ? (
                  <Heart className="w-4 h-4 text-delulu-yellow fill-delulu-yellow" />
                ) : (
                  <Flame className="w-4 h-4 text-delulu-purple fill-delulu-purple" />
                )}
              </div>
              <div>
                <p className="font-bold text-sm">{participant.username}</p>
                <p className="text-xs text-muted-foreground font-medium">
                  {participant.side === "believe" ? "Believer" : "Doubter"}
                </p>
              </div>
            </div>
            <span className="font-black text-sm">${participant.amount}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

