"use client"

import type React from "react"

import { useState } from "react"
import type { Generation } from "../types"

interface UseImageGenerationProps {
  prompt: string
  aspectRatio: string
  image1: File | null
  image2: File | null
  image1Url: string
  image2Url: string
  useUrls: boolean
  generations: Generation[]
  setGenerations: React.Dispatch<React.SetStateAction<Generation[]>>
  addGeneration: (generation: Generation) => Promise<void>
  onToast: (message: string, type?: "success" | "error") => void
  onImageUpload: (file: File, imageNumber: 1 | 2) => Promise<void>
}

interface GenerateImageOptions {
  prompt?: string
  aspectRatio?: string
  image1?: File | null
  image2?: File | null
  image1Url?: string
  image2Url?: string
  useUrls?: boolean
}

const playSuccessSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime)

    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.15)
  } catch (error) {
    console.log("Could not play sound:", error)
  }
}

export function useImageGeneration({
  prompt,
  aspectRatio,
  image1,
  image2,
  image1Url,
  image2Url,
  useUrls,
  generations,
  setGenerations,
  addGeneration,
  onToast,
  onImageUpload,
}: UseImageGenerationProps) {
  const [selectedGenerationId, setSelectedGenerationId] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)

  const cancelGeneration = (generationId: string) => {
    const generation = generations.find((g) => g.id === generationId)
    if (generation?.abortController) {
      generation.abortController.abort()
    }

    setGenerations((prev) =>
      prev.map((gen) =>
        gen.id === generationId && gen.status === "loading"
          ? { ...gen, status: "error" as const, error: "Cancelled by user", progress: 0, abortController: undefined }
          : gen,
      ),
    )
    onToast("Generation cancelled", "error")
  }

  const generateImage = async (options?: GenerateImageOptions) => {
    const effectivePrompt = options?.prompt ?? prompt
    const effectiveAspectRatio = options?.aspectRatio ?? aspectRatio
    const effectiveImage1 = options?.image1 !== undefined ? options.image1 : image1
    const effectiveImage2 = options?.image2 !== undefined ? options.image2 : image2
    const effectiveImage1Url = options?.image1Url !== undefined ? options.image1Url : image1Url
    const effectiveImage2Url = options?.image2Url !== undefined ? options.image2Url : image2Url
    const effectiveUseUrls = options?.useUrls !== undefined ? options.useUrls : useUrls

    const hasImages = effectiveUseUrls ? effectiveImage1Url || effectiveImage2Url : effectiveImage1 || effectiveImage2
    const currentMode = hasImages ? "image-editing" : "text-to-image"

    if (currentMode === "image-editing" && !effectiveUseUrls && !effectiveImage1) {
      onToast("Please upload at least one image for editing mode", "error")
      return
    }
    if (currentMode === "image-editing" && effectiveUseUrls && !effectiveImage1Url) {
      onToast("Please provide at least one image URL for editing mode", "error")
      return
    }
    if (!effectivePrompt.trim()) {
      onToast("Please enter a prompt", "error")
      return
    }

    const numVariations = 1
    const generationPromises = []

    for (let i = 0; i < numVariations; i++) {
      const generationId = `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`
      const controller = new AbortController()

      const newGeneration: Generation = {
        id: generationId,
        status: "loading",
        progress: 0,
        imageUrl: null,
        prompt: effectivePrompt,
        timestamp: Date.now() + i,
        abortController: controller,
      }

      setGenerations((prev) => [newGeneration, ...prev])

      if (i === 0) {
        setSelectedGenerationId(generationId)
      }

      // --- Hybrid progress: Phase 1 (thinking) + Phase 2 (streaming) ---
      const PHASE1_MAX = 65 // synthetic ceiling while model is thinking
      const PHASE1_DURATION = 210_000 // reach ~65% over 210 seconds
      const PHASE2_MIN = 65 // streaming band starts here
      const PHASE2_MAX = 95 // streaming band ends here (100% on complete)
      const ESTIMATED_SVG_SIZE = 6000

      let phase1Start = Date.now()
      let streamingStarted = false
      let charsReceived = 0
      let currentEstimate = ESTIMATED_SVG_SIZE // ratchets up, never recalculated from charsReceived

      // Phase 1: synthetic ramp from 0% to 40% with a decaying curve
      const thinkingInterval = setInterval(() => {
        if (streamingStarted) return
        const elapsed = Date.now() - phase1Start
        // Exponential ease-out: rises quickly at first, decelerates toward cap
        const t = Math.min(elapsed / PHASE1_DURATION, 1)
        const eased = 1 - Math.pow(1 - t, 2.5)
        const progress = eased * PHASE1_MAX

        setGenerations((prev) =>
          prev.map((gen) =>
            gen.id === generationId && gen.status === "loading"
              ? { ...gen, progress: Math.max(gen.progress, progress) }
              : gen,
          ),
        )
      }, 200)

      // Phase 2: real streaming progress mapped into the 40%-95% band
      const updateStreamProgress = (newChars: number) => {
        if (!streamingStarted) {
          streamingStarted = true
          clearInterval(thinkingInterval)
        }
        charsReceived += newChars
        // If we've hit 80% of the current estimate, bump it up by 1.5x
        // so the bar keeps moving but can still reach the top naturally
        if (charsReceived > currentEstimate * 0.8) {
          currentEstimate = Math.ceil(charsReceived * 1.5)
        }
        const streamFraction = Math.min(charsReceived / currentEstimate, 1)
        const progress = PHASE2_MIN + streamFraction * (PHASE2_MAX - PHASE2_MIN)

        setGenerations((prev) =>
          prev.map((gen) =>
            gen.id === generationId && gen.status === "loading"
              ? { ...gen, progress: Math.max(gen.progress, progress) }
              : gen,
          ),
        )
      }

      const generationPromise = (async () => {
        try {
          const formData = new FormData()
          formData.append("mode", currentMode)
          formData.append("prompt", effectivePrompt)
          formData.append("aspectRatio", effectiveAspectRatio)

          if (currentMode === "image-editing") {
            if (effectiveUseUrls) {
              formData.append("image1Url", effectiveImage1Url)
              if (effectiveImage2Url) {
                formData.append("image2Url", effectiveImage2Url)
              }
            } else {
              if (effectiveImage1) {
                formData.append("image1", effectiveImage1)
              }
              if (effectiveImage2) {
                formData.append("image2", effectiveImage2)
              }
            }
          }

          console.log("[v0] === CLIENT: Sending generation request ===")
          console.log("[v0] Mode:", currentMode)
          console.log("[v0] Prompt:", effectivePrompt)
          console.log("[v0] Aspect ratio:", effectiveAspectRatio)
          console.log("[v0] Has image1:", effectiveUseUrls ? !!effectiveImage1Url : !!effectiveImage1)
          console.log("[v0] Has image2:", effectiveUseUrls ? !!effectiveImage2Url : !!effectiveImage2)

          const response = await fetch("/api/generate-image", {
            method: "POST",
            body: formData,
            signal: controller.signal,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
            throw new Error(`${errorData.error}${errorData.details ? `: ${errorData.details}` : ""}`)
          }

          // Read SSE stream -- keeps connection alive to avoid 504 timeouts
          const reader = response.body?.getReader()
          if (!reader) throw new Error("No response body")

          const decoder = new TextDecoder()
          let fullText = ""
          let buffer = ""

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed.startsWith("data: ")) {
                const payload = trimmed.slice(6)
                if (payload === "[DONE]") break
                try {
                  const parsed = JSON.parse(payload)
                  if (typeof parsed === "string") {
                    fullText += parsed
                    updateStreamProgress(parsed.length)
                  } else if (parsed.error) {
                    throw new Error(parsed.error)
                  }
                } catch {
                  // skip malformed SSE lines
                }
              }
            }
          }

          // Extract SVG from accumulated text
          const svgMatch = fullText.match(/<svg[\s\S]*<\/svg>/i)
          let svgCode = svgMatch ? svgMatch[0] : null

          // Also try stripping markdown fences
          if (!svgCode) {
            const stripped = fullText.replace(/```(?:svg|xml)?\s*/gi, "").replace(/```\s*/g, "")
            const retryMatch = stripped.match(/<svg[\s\S]*<\/svg>/i)
            svgCode = retryMatch ? retryMatch[0] : null
          }

          clearInterval(thinkingInterval)

          // Ensure overflow="hidden" to clip any model-generated elements that extend beyond the viewBox
          if (svgCode) {
            // Replace or add the overflow attribute
            if (/overflow\s*=\s*["'][^"']*["']/.test(svgCode)) {
              svgCode = svgCode.replace(/overflow\s*=\s*["'][^"']*["']/, 'overflow="hidden"')
            } else {
              svgCode = svgCode.replace(/<svg(\s)/, '<svg overflow="hidden"$1')
            }
            // Also strip any inline style overflow that could override the attribute
            svgCode = svgCode.replace(/(style\s*=\s*["'][^"']*)overflow\s*:\s*[^;"']+;?\s*/i, '$1')
          }

          if (svgCode) {
            const svgBlob = new Blob([svgCode], { type: "image/svg+xml" })
            const imageUrl = URL.createObjectURL(svgBlob)

            const completedGeneration: Generation = {
              id: generationId,
              status: "complete",
              progress: 100,
              imageUrl: imageUrl,
              svgCode: svgCode,
              prompt: effectivePrompt,
              timestamp: Date.now(),
              createdAt: new Date().toISOString(),
              aspectRatio: effectiveAspectRatio,
              mode: currentMode,
            }

            setGenerations((prev) => prev.filter((gen) => gen.id !== generationId))
            await addGeneration(completedGeneration)
          } else {
            throw new Error("No valid SVG found in model response")
          }

          if (selectedGenerationId === generationId) {
            setImageLoaded(true)
          }

          playSuccessSound()
        } catch (error) {
          console.error("Error in generation:", error)
          clearInterval(thinkingInterval)

          if (error instanceof Error && error.name === "AbortError") {
            return
          }

          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

          setGenerations((prev) => prev.filter((gen) => gen.id !== generationId))

          onToast(`Error generating image: ${errorMessage}`, "error")
        }
      })()

      generationPromises.push(generationPromise)
    }

    await Promise.all(generationPromises)
  }

  const loadGeneratedAsInput = async () => {
    console.log("[v0] loadGeneratedAsInput called")
    console.log("[v0] selectedGenerationId:", selectedGenerationId)
    console.log("[v0] generations count:", generations.length)
    console.log("[v0] generation ids:", generations.map(g => g.id))
    
    const selectedGeneration = generations.find((g) => g.id === selectedGenerationId)
    console.log("[v0] selectedGeneration found:", !!selectedGeneration)
    console.log("[v0] selectedGeneration status:", selectedGeneration?.status)
    console.log("[v0] selectedGeneration has svgCode:", !!selectedGeneration?.svgCode)
    console.log("[v0] selectedGeneration has imageUrl:", !!selectedGeneration?.imageUrl)
    
    if (!selectedGeneration?.imageUrl && !selectedGeneration?.svgCode) {
      console.log("[v0] No imageUrl or svgCode found, returning early")
      return
    }

    try {
      let file: File

      if (selectedGeneration.svgCode) {
        // For SVG generations, create an SVG file directly from the code
        console.log("[v0] Creating SVG file from svgCode, length:", selectedGeneration.svgCode.length)
        const svgBlob = new Blob([selectedGeneration.svgCode], { type: "image/svg+xml" })
        file = new File([svgBlob], "generated-svg.svg", { type: "image/svg+xml" })
      } else {
        console.log("[v0] Fetching image from URL:", selectedGeneration.imageUrl)
        const response = await fetch(selectedGeneration.imageUrl!)
        const blob = await response.blob()
        file = new File([blob], "generated-image.png", { type: "image/png" })
      }

      console.log("[v0] Calling onImageUpload with file:", file.name, file.type, file.size)
      await onImageUpload(file, 1)
      console.log("[v0] onImageUpload completed successfully")
      onToast("SVG loaded into Input 1", "success")
    } catch (error) {
      console.error("[v0] Error loading image as input:", error)
      onToast("Error loading image", "error")
    }
  }

  return {
    selectedGenerationId,
    setSelectedGenerationId,
    imageLoaded,
    setImageLoaded,
    generateImage,
    cancelGeneration,
    loadGeneratedAsInput,
  }
}
