"use client"

function VercelLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 76 65" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
    </svg>
  )
}

interface SignInOverlayProps {
  onClose: () => void
  onBeforeSignIn?: () => void
}

export function SignInOverlay({ onClose, onBeforeSignIn }: SignInOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111111] border border-[#333333] rounded-lg p-6 max-w-sm w-full mx-4 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
            <VercelLogo className="w-6 h-6 text-black" />
          </div>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Sign in to continue</h2>
        <p className="text-sm text-gray-400 mb-6">
          Sign in with your Vercel account to generate SVGs.
        </p>
        <a
          href="/api/auth/authorize"
          onClick={() => onBeforeSignIn?.()}
          className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white text-black text-sm font-medium rounded-md hover:bg-white/90 transition-colors"
        >
          <VercelLogo className="w-3.5 h-3.5" />
          Sign in
        </a>
        <button
          onClick={onClose}
          className="mt-3 w-full px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
