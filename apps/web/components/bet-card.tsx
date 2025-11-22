import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Timer, Heart, Flame } from "lucide-react"

interface DelusionCardProps {
  id: string
  claim: string
  believers: number
  haters: number
  timeLeft: string
  creator: string
  onClick?: () => void
}

export function DelusionCard({
  claim,
  believers,
  haters,
  timeLeft,
  creator,
  onClick,
}: DelusionCardProps) {
  const total = believers + haters
  const believersPercent = (believers / total) * 100

  return (
    <Card
      className="p-5 bg-card border border-border cursor-pointer hover:border-delulu-yellow/50 transition-all"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="font-bold text-base mb-1">{claim}</p>
          <p className="text-xs text-muted-foreground font-medium">{creator}</p>
        </div>
        <Badge variant="outline" className="text-xs font-bold ml-2 border-border">
          <Timer className="w-3 h-3 mr-1" />
          {timeLeft}
        </Badge>
      </div>

      <div className="h-2 bg-muted/50 rounded-full overflow-hidden mb-4">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: "100%",
            background: `linear-gradient(to right, var(--delulu-yellow) 0%, var(--delulu-yellow) ${believersPercent}%, var(--delulu-purple) ${believersPercent}%, var(--delulu-purple) 100%)`,
          }}
        />
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-delulu-yellow fill-delulu-yellow" />
          <span className="font-black text-sm">${believers}</span>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-delulu-purple fill-delulu-purple" />
          <span className="font-black text-sm">${haters}</span>
        </div>
      </div>
    </Card>
  )
}

