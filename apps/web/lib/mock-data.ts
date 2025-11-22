export interface Delusion {
  id: string
  claim: string
  believers: number
  haters: number
  timeLeft: string
  creator: string
  status: "active" | "completed"
  participants: { username: string; side: "believe" | "doubt"; amount: number }[]
}

export const farcasterUser = {
  username: "delulu_queen",
  pfp: "/diverse-avatars.png",
  fid: "12345",
  address: "0x742d35e1f1b3F9D4c5A3C2B1D4E5F6A7B8C9D0Ea35Aa",
}

export const mockDelusions: Delusion[] = [
  {
    id: "1",
    claim: "I will run a 5k by Sunday",
    believers: 120,
    haters: 45,
    timeLeft: "2d 14h 32m",
    creator: "@fitness_queen",
    status: "active",
    participants: [
      { username: "@runner_max", side: "believe", amount: 50 },
      { username: "@couch_potato", side: "doubt", amount: 25 },
      { username: "@gym_bro", side: "believe", amount: 70 },
      { username: "@hater123", side: "doubt", amount: 20 },
    ],
  },
  {
    id: "2",
    claim: "I'll finally learn Spanish in 30 days",
    believers: 85,
    haters: 120,
    timeLeft: "27d 5h 12m",
    creator: "@polyglot_dreamer",
    status: "active",
    participants: [
      { username: "@language_lover", side: "believe", amount: 35 },
      { username: "@skeptic_sam", side: "doubt", amount: 60 },
      { username: "@duolingo_fan", side: "believe", amount: 50 },
    ],
  },
  {
    id: "3",
    claim: "I'll ship my app this weekend",
    believers: 200,
    haters: 180,
    timeLeft: "4d 18h 45m",
    creator: "@indie_hacker",
    status: "active",
    participants: [
      { username: "@dev_support", side: "believe", amount: 100 },
      { username: "@realist_dev", side: "doubt", amount: 90 },
      { username: "@startup_queen", side: "believe", amount: 100 },
      { username: "@burnout_dev", side: "doubt", amount: 90 },
    ],
  },
]

