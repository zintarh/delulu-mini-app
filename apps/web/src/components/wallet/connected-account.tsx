"use client"

import { useState, useEffect } from "react"
import { useAccount, useDisconnect, useBalance } from "wagmi"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal"

interface ConnectedAccountProps {
  className?: string
}

export function ConnectedAccount({ className }: ConnectedAccountProps) {
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showModal, setShowModal] = useState(false)
  
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { data: balance } = useBalance({ address })

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !isConnected || !address) {
    return null
  }

  const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`
  const formattedBalance = balance ? parseFloat(balance.formatted).toFixed(2) : "0.00"
  const initials = address.slice(2, 4).toUpperCase()

  const copyAddress = async () => {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDisconnect = () => {
    disconnect()
    setShowModal(false)
  }

  return (
    <Modal open={showModal} onOpenChange={setShowModal}>
      <ModalTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 pl-1 pr-4 py-1",
            "bg-white/10",
            "rounded-full",
            "active:scale-95 transition-transform",
            className
          )}
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-delulu-yellow flex items-center justify-center">
            <span className="text-[10px] font-bold text-delulu-dark">{initials}</span>
          </div>
          <span className="text-sm font-bold text-white">{truncatedAddress}</span>
        </button>
      </ModalTrigger>
      
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Wallet</ModalTitle>
        </ModalHeader>
        
        <div className="mt-4 space-y-4">
          {/* Address with avatar */}
          <button
            onClick={copyAddress}
            className="w-full flex items-center gap-3 p-4 bg-delulu-dark/10 rounded-xl"
          >
            <div className="w-10 h-10 rounded-full bg-delulu-dark flex items-center justify-center">
              <span className="text-sm font-bold text-delulu-yellow">{initials}</span>
            </div>
            <span className="flex-1 text-left font-bold text-delulu-dark">{truncatedAddress}</span>
            {copied ? (
              <Check className="w-4 h-4 text-delulu-dark" />
            ) : (
              <Copy className="w-4 h-4 text-delulu-dark/50" />
            )}
          </button>
          
          {/* Balance */}
          <div className="p-4 bg-delulu-dark rounded-xl">
            <p className="text-xs text-delulu-yellow/60 mb-1">Balance</p>
            <p className="text-2xl font-black text-delulu-yellow">
              {formattedBalance} <span className="text-sm">{balance?.symbol || "CELO"}</span>
            </p>
          </div>
          
          {/* Disconnect */}
          <button
            onClick={handleDisconnect}
            className="w-full py-3 bg-delulu-dark text-delulu-yellow rounded-xl font-bold active:scale-[0.98] transition-transform"
          >
            Disconnect
          </button>
        </div>
      </ModalContent>
    </Modal>
  )
}
