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
    <header className="bg-delulu-yellow px-6 py-5 sticky top-0 z-10">
      <div className="w-full max-w-5xl mx-auto">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-2 mb-3 -ml-1 font-bold text-delulu-dark hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="font-black text-3xl text-delulu-dark tracking-tighter">{title}</h1>
      </div>
    </header>
  )
}

