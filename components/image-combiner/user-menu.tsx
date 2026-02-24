"use client"

import { useAuth } from "./auth-context"
import { useState, useRef, useEffect } from "react"

function VercelLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 76 65" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  )
}

function formatBalance(balance: string | null): string {
  if (balance == null) return "--"
  const num = parseFloat(balance)
  if (isNaN(num)) return "--"
  return `$${num.toFixed(2)}`
}

export function UserMenu() {
  const { user, isLoading, balance, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-[#333333] animate-pulse" />
  }

  if (!user) {
    return (
      <a
        href="/api/auth/authorize"
        className="flex items-center gap-2 px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-white/90 transition-colors"
      >
        <VercelLogo className="w-3 h-3" />
        <span>Sign in</span>
      </a>
    )
  }

  return (
    <div ref={menuRef} className="relative flex items-center gap-2">
      <span className="text-xs font-medium text-gray-400 tabular-nums">{formatBalance(balance)}</span>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-0 focus:outline-none"
        aria-label="User menu"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt={user.name}
            className="w-8 h-8 rounded-full border border-[#333333]"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#333333] flex items-center justify-center text-white text-xs font-bold">
            {user.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#1a1a1a] border border-[#333333] rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-3 border-b border-[#333333]">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
          <div className="px-3 py-2.5 border-b border-[#333333] flex items-center justify-between">
            <span className="text-xs text-gray-400">Balance</span>
            <span className="text-xs font-medium text-white tabular-nums">{formatBalance(balance)}</span>
          </div>
          <a
            href={user.teamSlug ? `https://vercel.com/${user.teamSlug}/~/ai-gateway` : "https://vercel.com/~/ai-gateway"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-[#252525] hover:text-white transition-colors"
          >
            Add credits
          </a>
          <button
            onClick={async () => {
              setOpen(false)
              await signOut()
            }}
            className="w-full text-left px-3 py-2.5 text-xs text-gray-300 hover:bg-[#252525] hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
