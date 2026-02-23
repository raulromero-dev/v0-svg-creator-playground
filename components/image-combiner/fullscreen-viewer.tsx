"use client"

import type { Generation } from "./types"

interface FullscreenViewerProps {
  imageUrl: string
  generations: Generation[]
  onClose: () => void
  onNavigate: (direction: "prev" | "next") => void
}

export function FullscreenViewer({ imageUrl, generations, onClose, onNavigate }: FullscreenViewerProps) {
  const completedGenerations = generations.filter((g) => g.status === "complete" && g.imageUrl)
  const hasMultipleImages = completedGenerations.length > 1

  return (
    <div
      className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-8 select-none overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Fullscreen image view"
    >
      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/80 hover:bg-black/90 text-white p-2 transition-all duration-200"
          title="Close (ESC)"
          aria-label="Close fullscreen"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {hasMultipleImages && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigate("prev")
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black/90 text-white p-3 transition-all duration-200"
              title="Previous (←)"
              aria-label="Previous image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onNavigate("next")
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black/90 text-white p-3 transition-all duration-200"
              title="Next (→)"
              aria-label="Next image"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
        {imageUrl.trim().startsWith("<svg") ? (
          <iframe
            srcDoc={`<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden}svg{max-width:100%;max-height:100%;width:auto;height:auto}</style></head><body>${imageUrl}</body></html>`}
            title="Generated SVG Fullscreen"
            sandbox="allow-same-origin"
            className="w-[80vw] h-[85vh] max-w-[80vw] max-h-[85vh] mx-auto shadow-2xl bg-white rounded-lg border-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            src={imageUrl || "/placeholder.svg"}
            alt="Fullscreen"
            className="max-w-full max-h-[90vh] object-contain mx-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  )
}
