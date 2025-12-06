"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setIsVisible(false)
      }, 500) 
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] bg-delulu-yellow flex flex-col items-center justify-center",
        "transition-opacity duration-500",
        isAnimating ? "opacity-0" : "opacity-100"
      )}
    >
      <div
        className={cn(
          "text-6xl md:text-8xl font-black text-delulu-dark tracking-tighter mb-4",
          "animate-slide-up-from-bottom"
        )}
        style={{
          fontFamily: "var(--font-gloria), cursive",
        }}
      >
          delulu<span className="text-white -ml-1">.</span>
      </div>
      <div
        className={cn(
          "text-sm md:text-lg font-bold text-delulu-dark/80",
          "animate-slide-up-from-bottom-delayed"
        )}
        style={{
          animationDelay: "0.3s",
        }}
      >
        it&apos;s your world be delusional bestie :)
      </div>
    </div>
  )
}

