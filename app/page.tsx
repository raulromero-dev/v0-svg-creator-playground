import { ImageCombiner } from "@/components/image-combiner"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "SVG Generator - AI-Powered Text & Image to SVG",
  description:
    "Create beautiful SVG files from text descriptions or images using Google Gemini 3.1. The easiest way to generate and edit scalable vector graphics with AI.",
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <ImageCombiner />
    </main>
  )
}
