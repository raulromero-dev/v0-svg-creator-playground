"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface HowItWorksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function PixelDivider() {
  return (
    <div className="flex items-center gap-1 py-2">
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="h-[2px] flex-1"
          style={{
            backgroundColor: i % 3 === 0 ? "#fff" : i % 3 === 1 ? "#666" : "#333",
          }}
        />
      ))}
    </div>
  )
}

function StepCard({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="relative border border-[#333] bg-black p-4 group hover:border-white/30 transition-colors">
      <div className="absolute -top-3 left-3 bg-white text-black text-[10px] font-bold px-2 py-0.5 tracking-wider uppercase">
        {number}
      </div>
      <h3 className="text-sm font-bold text-white mt-1 mb-2 tracking-wide">{title}</h3>
      <div className="text-xs text-white/50 leading-relaxed">{children}</div>
    </div>
  )
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 bg-white/10 border border-white/20 text-[10px] text-white/70 font-mono">
      {children}
    </kbd>
  )
}

export function HowItWorksModal({ open, onOpenChange }: HowItWorksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-black border border-[#333] text-white/70 p-0 overflow-hidden">
        {/* Header with pixel pattern */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute top-0 left-0 right-0 h-1 flex">
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-full"
                style={{
                  backgroundColor: i % 2 === 0 ? "#fff" : "#000",
                }}
              />
            ))}
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white tracking-tight">
              How it works
            </DialogTitle>
            <p className="text-xs text-white/30 mt-1 tracking-wide uppercase">
              SVG Generator Playground
            </p>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Setup Section */}
          <div className="border border-white/20 bg-white/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-white flex items-center justify-center">
                <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white tracking-wide">Try It Yourself</h3>
            </div>
            <ol className="space-y-2 text-xs text-white/50">
              <li className="flex items-start gap-2">
                <span className="text-white font-bold min-w-[16px]">1.</span>
                <span>
                  Copy the template from{" "}
                  <a
                    href="https://v0.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-white/70 underline underline-offset-2"
                  >
                    v0.dev
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white font-bold min-w-[16px]">2.</span>
                <span>Deploy to Vercel (no API key needed -- uses Vercel AI Gateway)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white font-bold min-w-[16px]">3.</span>
                <span>Start generating SVGs</span>
              </li>
            </ol>
          </div>

          <PixelDivider />

          {/* Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <StepCard number="01" title="Text to SVG">
              Describe the graphic you want in the prompt box. The AI generates clean, scalable vector
              graphics from your text description using Gemini 3.1.
            </StepCard>

            <StepCard number="02" title="Image to SVG">
              Upload one or two reference images and describe how to convert them. Drag and drop, paste,
              or use image URLs for quick input.
            </StepCard>

            <StepCard number="03" title="Iterate">
              Click any element in the generated SVG to select it and drag vector points to reshape it directly.
              Use "Use as Input" to feed your edited result back for further AI refinement. Undo with Ctrl+Z.
            </StepCard>

            <StepCard number="04" title="Export">
              Download your SVG file, copy the SVG code to clipboard, or open in a new tab. All
              generations are saved in your browser history.
            </StepCard>
          </div>

          <PixelDivider />

          {/* Aspect Ratios */}
          <div className="border border-[#333] bg-black p-4">
            <h3 className="text-sm font-bold text-white mb-2 tracking-wide">Aspect Ratios</h3>
            <div className="flex flex-wrap gap-2">
              {["1:1", "16:9", "9:16", "4:3", "3:4"].map((ratio) => (
                <span
                  key={ratio}
                  className="px-2 py-1 border border-white/20 text-[10px] font-mono text-white/60 tracking-wider"
                >
                  {ratio}
                </span>
              ))}
            </div>
            <p className="text-xs text-white/40 mt-2">
              Auto-detected from uploaded images. Choose manually for text-to-SVG generation.
            </p>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="border border-[#333] bg-black p-4">
            <h3 className="text-sm font-bold text-white mb-3 tracking-wide">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">Generate</span>
                <div className="flex items-center gap-1">
                  <KbdKey>{'⌘'}</KbdKey>
                  <span className="text-white/20">+</span>
                  <KbdKey>{'↵'}</KbdKey>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">Copy SVG</span>
                <div className="flex items-center gap-1">
                  <KbdKey>{'⌘'}</KbdKey>
                  <span className="text-white/20">+</span>
                  <KbdKey>C</KbdKey>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">Download</span>
                <div className="flex items-center gap-1">
                  <KbdKey>{'⌘'}</KbdKey>
                  <span className="text-white/20">+</span>
                  <KbdKey>D</KbdKey>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">Use as Input</span>
                <div className="flex items-center gap-1">
                  <KbdKey>{'⌘'}</KbdKey>
                  <span className="text-white/20">+</span>
                  <KbdKey>U</KbdKey>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/40">Close Fullscreen</span>
                <KbdKey>Esc</KbdKey>
              </div>
            </div>
          </div>

          {/* Footer pixel bar */}
          <div className="flex items-center gap-1 pt-2">
            {Array.from({ length: 80 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-[2px]"
                style={{
                  backgroundColor: i % 2 === 0 ? "#fff" : "#000",
                }}
              />
            ))}
          </div>

          <p className="text-[10px] text-white/20 text-center tracking-widest uppercase">
            Powered by Gemini 3.1 via Vercel AI Gateway
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
