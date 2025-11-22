"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

interface PageHeaderProps {
  title: string
  backHref?: string
}

export function PageHeader({ title, backHref = "/" }: PageHeaderProps) {
  const router = useRouter()

  return (
    <header className="bg-delulu-yellow border-b border-delulu-dark/10 sticky top-0 z-50 shadow-sm">
      <div className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-delulu-dark/5 active:bg-delulu-dark/10 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-6 h-6 text-delulu-dark" />
        </button>
        <h1 className="font-bold text-lg text-delulu-dark absolute left-1/2 -translate-x-1/2">{title}</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>
    </header>
  )
}

