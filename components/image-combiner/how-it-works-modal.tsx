"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface HowItWorksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HowItWorksModal({ open, onOpenChange }: HowItWorksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white border border-gray-300 text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">How it works</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 text-sm text-gray-700 max-h-[60vh] overflow-y-auto pr-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-blue-700 mb-2">Setup Required</h3>
            <p className="leading-relaxed mb-3">
              To use this playground, you need to add your Vercel AI Gateway API key as an environment variable:
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-2">
              <li>
                Get your API key from{" "}
                <a
                  href="https://vercel.com/ai-gateway"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Vercel AI Gateway
                </a>
              </li>
              <li>
                Add the environment variable{" "}
                <code className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">AI_GATEWAY_API_KEY</code> to your project
              </li>
              <li>Publish or Deploy</li>
            </ol>
          </div>
          {/* </CHANGE> */}

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">About SVG Creator</h3>
            <p className="leading-relaxed">
              SVG Creator uses Google's Gemini 3.1 AI model to transform your text descriptions and images into
              high-quality SVG graphics. Whether you're creating icons, logos, or illustrations, our AI generates
              clean, scalable vector graphics perfect for any project. All generations are processed through the{" "}
              <a
                href="https://vercel.com/ai-gateway"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Vercel AI Gateway
              </a>
              , providing enterprise-grade reliability and performance.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Text-to-SVG Generation</h3>
            <p className="leading-relaxed">
              Simply describe the SVG graphic you want to create in the prompt box and click Generate SVG. The AI will
              create a clean, vector-style graphic based on your description in seconds.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Image-to-SVG Conversion</h3>
            <p className="leading-relaxed mb-2">
              Upload one or two images and describe how you want them converted to SVG style. The AI will transform
              your images into clean vector graphics based on your instructions.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Upload images by clicking the upload areas or drag and drop</li>
              <li>Paste image URLs directly for quick editing</li>
              <li>Combine multiple images with AI-powered composition</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aspect Ratios</h3>
            <p className="leading-relaxed">
              Choose from multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4) to fit your needs. When uploading images,
              the app automatically detects the best aspect ratio for your SVG output.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Generation History</h3>
            <p className="leading-relaxed mb-2">All your generations are saved locally in your browser. You can:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>View and switch between previous generations</li>
              <li>Delete unwanted results</li>
              <li>Load a generated image as input for further editing</li>
              <li>Download or copy images to clipboard</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Keyboard Shortcuts</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">⌘/Ctrl + Enter</kbd> - Generate SVG
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">⌘/Ctrl + C</kbd> - Copy SVG to clipboard
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">⌘/Ctrl + D</kbd> - Download SVG
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">⌘/Ctrl + U</kbd> - Load generated SVG as
                input
              </li>
              <li>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd> - Close fullscreen viewer
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
