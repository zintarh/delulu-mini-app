"use client"

import { useState, useEffect } from "react"
import { useAccount, useConnect } from "wagmi"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ConnectedAccount } from "./connected-account"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/ui/modal"

interface ConnectWalletProps {
  className?: string
}

export function ConnectWallet({ className }: ConnectWalletProps) {
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  
  const { isConnected, isConnecting } = useAccount()
  const { connect, connectors, isPending } = useConnect()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleConnect = (connector: typeof connectors[0]) => {
    connect({ connector })
    setShowModal(false)
  }

  if (!mounted) {
    return <div className="w-20 h-9 animate-pulse bg-delulu-dark/10 rounded-full" />
  }

  if (isConnected) {
    return <ConnectedAccount className={className} />
  }

  const isLoading = isConnecting || isPending

  return (
    <Modal open={showModal} onOpenChange={setShowModal}>
      <ModalTrigger asChild>
        <button
          disabled={isLoading}
          className={cn(
            "relative px-5 py-2",
            "bg-gradient-to-b from-delulu-yellow via-delulu-yellow to-[#d4af37]",
            "text-delulu-dark",
            "rounded-xl font-black text-sm",
            "border-2 border-delulu-dark",
            "shadow-[0_4px_0_0_#0a0a0a]",
            "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
            "transition-all duration-150",
            "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a]",
            className
          )}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <span>Connect</span>
          )}
        </button>
      </ModalTrigger>
      
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Connect</ModalTitle>
        </ModalHeader>
        
        <div className="mt-4 space-y-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              disabled={isLoading}
              className={cn(
                "w-full p-4",
                "bg-gradient-to-b from-delulu-yellow via-delulu-yellow to-[#d4af37]",
                "text-delulu-dark",
                "rounded-xl font-black",
                "border-2 border-delulu-dark",
                "shadow-[0_4px_0_0_#0a0a0a]",
                "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                "transition-all duration-150",
                "disabled:opacity-50"
              )}
            >
              {connector.name}
            </button>
          ))}
        </div>
      </ModalContent>
    </Modal>
  )
}
