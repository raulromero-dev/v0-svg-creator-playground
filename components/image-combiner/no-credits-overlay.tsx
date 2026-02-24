"use client"

import { useState } from "react"
import { useAuth } from "./auth-context"

interface NoCreditsOverlayProps {
  onClose: () => void
}

export function NoCreditsOverlay({ onClose }: NoCreditsOverlayProps) {
  const { user, refreshBalance, balance } = useAuth()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshBalance()
    setIsRefreshing(false)
  }

  // Auto-close when balance updates to positive
  const balanceNum = parseFloat(balance ?? "0")
  if (balanceNum > 0) {
    onClose()
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111111] border border-[#333333] rounded-lg p-6 max-w-sm w-full mx-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#333333] flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Insufficient credits</h2>
        <p className="text-sm text-gray-400 mb-6">
          Your AI Gateway balance is $0. Add credits to your Vercel account to continue generating SVGs.
        </p>
        <a
          href="https://vercel.com/ai-gateway"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors"
        >
          Add credits
        </a>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="mt-3 w-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors disabled:opacity-50"
        >
          {isRefreshing ? "Checking..." : "Refresh balance"}
        </button>
        <button
          onClick={onClose}
          className="mt-1 w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
