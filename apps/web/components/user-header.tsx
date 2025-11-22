"use client"

import { Copy } from "lucide-react"
import { useState } from "react"

interface UserHeaderProps {
  username: string
  pfp: string
  address: string
}

export function UserHeader({ username, pfp, address }: UserHeaderProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <header className="bg-delulu-yellow px-6 py-5 sticky top-0 z-10">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
        <h1 className="font-black text-4xl text-delulu-dark tracking-tighter">Delulu</h1>
        <div className="flex items-center gap-3 bg-delulu-dark/90 px-4 py-2.5 rounded-full border border-delulu-yellow/20">
          <img
            src={pfp || "/placeholder.svg"}
            alt={username}
            className="w-8 h-8 rounded-full border border-delulu-yellow/30"
          />
          <div className="flex flex-col">
            <span className="font-bold text-xs text-delulu-yellow">@{username}</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-delulu-yellow/70">
                {truncateAddress(address)}
              </span>
              <button
                onClick={handleCopy}
                className="hover:opacity-70 transition-opacity"
                title="Copy address"
              >
                <Copy className={`w-3 h-3 ${copied ? 'text-delulu-green' : 'text-delulu-yellow/70'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

