"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback, memo } from "react"
import { Dithering } from "@paper-design/shaders-react"
import { useMobile } from "@/hooks/use-mobile"
import { useImageUpload } from "./hooks/use-image-upload"
import { useImageGeneration } from "./hooks/use-image-generation"
import { useAspectRatio } from "./hooks/use-aspect-ratio"
import { HowItWorksModal } from "./how-it-works-modal"
import { usePersistentHistory } from "./hooks/use-persistent-history"
import { InputSection } from "./input-section"
import { OutputSection } from "./output-section"
import { ToastNotification } from "./toast-notification"
import { GenerationHistory } from "./generation-history"
import { GlobalDropZone } from "./global-drop-zone"
import { FullscreenViewer } from "./fullscreen-viewer"
import { UserMenu } from "./user-menu"
import { SignInOverlay } from "./sign-in-overlay"
import { useAuth } from "./auth-context"
import type { Generation } from "./types"
import { Skeleton } from "@/components/ui/skeleton"


const MemoizedDithering = memo(Dithering)

export function ImageCombiner() {
  const isMobile = useMobile()
  const [prompt, setPrompt] = useState("A high-angle, architectural perspective of the Golden Gate Bridge tower featuring clean, sharp vector lines and the iconic International Orange steel structure. The central focus is a vertical, multi-tiered Art Deco tower defined by its rectangular openings and repetitive structural bracing. Thick primary suspension cables arch from the top of the tower, connected to the road deck by a series of thin, perfectly vertical tension lines. A diagonal perspective of the bridge deck reveals the truss framework underneath. In the distance, a flat horizon line separates the deep blue water from a minimalist city skyline and a soft, hazy sky. All elements are rendered with flat, distinct colors and clear boundaries suitable for a layered SVG graphic.")
  const [useUrls, setUseUrls] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState("")
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [dragCounter, setDragCounter] = useState(0)
  const [dropZoneHover, setDropZoneHover] = useState<1 | 2 | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const { user } = useAuth()
  const [logoLoaded, setLogoLoaded] = useState(false)
  const [editedSvgCode, setEditedSvgCode] = useState<string | null>(null)


  const [leftWidth, setLeftWidth] = useState(50) // percentage
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const {
    image1,
    image1Preview,
    image1Url,
    image2,
    image2Preview,
    image2Url,
    isConvertingHeic,
    heicProgress,
    handleImageUpload,
    handleUrlChange,
    clearImage,
    showToast: uploadShowToast,
  } = useImageUpload()

  const { aspectRatio, setAspectRatio, availableAspectRatios, detectAspectRatio } = useAspectRatio()

  const {
    generations: persistedGenerations,
    setGenerations: setPersistedGenerations,
    addGeneration,
    clearHistory,
    deleteGeneration,
    isLoading: historyLoading,
    hasMore,
    loadMore,
    isLoadingMore,
  } = usePersistentHistory(showToast)

  const {
    selectedGenerationId,
    setSelectedGenerationId,
    imageLoaded,
    setImageLoaded,
    generateImage: runGeneration,
    cancelGeneration,
    loadGeneratedAsInput,
  } = useImageGeneration({
    prompt,
    aspectRatio,
    image1,
    image2,
    image1Url,
    image2Url,
    useUrls,
    generations: persistedGenerations,
    setGenerations: setPersistedGenerations,
    addGeneration,
    onToast: showToast,
    onImageUpload: handleImageUpload,
  })

  const selectedGeneration = persistedGenerations.find((g) => g.id === selectedGenerationId) || persistedGenerations[0]
  const isLoading = persistedGenerations.some((g) => g.status === "loading")
  const currentSvgCode = editedSvgCode || selectedGeneration?.svgCode || null
  const generatedImage =
    selectedGeneration?.status === "complete" && (selectedGeneration.imageUrl || selectedGeneration.svgCode)
      ? { url: selectedGeneration.imageUrl, prompt: selectedGeneration.prompt, svgCode: currentSvgCode }
      : null

  const hasImages = useUrls ? image1Url || image2Url : image1 || image2
  const currentMode = hasImages ? "image-editing" : "text-to-image"
  const canGenerate = prompt.trim().length > 0 && (currentMode === "text-to-image" || (useUrls ? image1Url : image1))

  // Gate generation on authentication
  const gatedRunGeneration = useCallback(() => {
    if (!user) {
      setShowSignIn(true)
      return
    }
    runGeneration()
  }, [user, runGeneration])

  // Seed a default generation (golden gate bridge) if history is empty on first load
  const hasSeededRef = useRef(false)
  useEffect(() => {
    if (historyLoading || hasSeededRef.current) return
    if (persistedGenerations.length > 0) {
      hasSeededRef.current = true
      return
    }
    hasSeededRef.current = true
    ;(async () => {
      try {
        const res = await fetch("/golden_gate_bridge.svg")
        const svgCode = await res.text()
        const svgBlob = new Blob([svgCode], { type: "image/svg+xml" })
        const imageUrl = URL.createObjectURL(svgBlob)
        const defaultGen: Generation = {
          id: `default-${Date.now()}`,
          status: "complete",
          progress: 100,
          imageUrl,
          svgCode,
          prompt: "A high-angle, architectural perspective of the Golden Gate Bridge tower featuring clean, sharp vector lines and the iconic International Orange steel structure. The central focus is a vertical, multi-tiered Art Deco tower defined by its rectangular openings and repetitive structural bracing. Thick primary suspension cables arch from the top of the tower, connected to the road deck by a series of thin, perfectly vertical tension lines. A diagonal perspective of the bridge deck reveals the truss framework underneath. In the distance, a flat horizon line separates the deep blue water from a minimalist city skyline and a soft, hazy sky. All elements are rendered with flat, distinct colors and clear boundaries suitable for a layered SVG graphic.",
          timestamp: Date.now(),
          aspectRatio: "portrait",
        }
        await addGeneration(defaultGen)
        setSelectedGenerationId(defaultGen.id)
        setAspectRatio("portrait")
      } catch (err) {
        console.error("Failed to load default SVG:", err)
      }
    })()
  }, [historyLoading, persistedGenerations.length, addGeneration, setSelectedGenerationId])

  useEffect(() => {
    if (selectedGeneration?.status === "complete" && selectedGeneration?.imageUrl) {
      setImageLoaded(false)
    }
    // Reset edits when switching generations
    setEditedSvgCode(null)
  }, [selectedGenerationId, selectedGeneration?.imageUrl, setImageLoaded])

  useEffect(() => {
    uploadShowToast.current = showToast
  }, [uploadShowToast])



  const openFullscreen = useCallback(() => {
    if (generatedImage?.svgCode || generatedImage?.url) {
      setFullscreenImageUrl(generatedImage.svgCode || generatedImage.url || "")
      setShowFullscreen(true)
      document.body.style.overflow = "hidden"
    }
  }, [generatedImage?.url, generatedImage?.svgCode])

  const openImageFullscreen = useCallback((imageUrl: string) => {
    setFullscreenImageUrl(imageUrl)
    setShowFullscreen(true)
    document.body.style.overflow = "hidden"
  }, [])

  const closeFullscreen = useCallback(() => {
    setShowFullscreen(false)
    setFullscreenImageUrl("")
    document.body.style.overflow = "unset"
  }, [])

  const downloadImage = useCallback(async () => {
    if (!generatedImage) return
    try {
      if (generatedImage.svgCode) {
        const blob = new Blob([generatedImage.svgCode], { type: "image/svg+xml" })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `svg-creator-${currentMode}-result.svg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      } else if (generatedImage.url) {
        const response = await fetch(generatedImage.url)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `svg-creator-${currentMode}-result.svg`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Error downloading SVG:", error)
    }
  }, [generatedImage, currentMode])

  const openImageInNewTab = useCallback(() => {
    if (!generatedImage?.url && !generatedImage?.svgCode) {
      console.error("No content available")
      return
    }

    try {
      if (generatedImage.svgCode) {
        const blob = new Blob([generatedImage.svgCode], { type: "image/svg+xml" })
        const blobUrl = URL.createObjectURL(blob)
        const newWindow = window.open(blobUrl, "_blank", "noopener,noreferrer")
        if (newWindow) {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
        }
      } else if (generatedImage.url?.startsWith("data:")) {
        const parts = generatedImage.url.split(",")
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/png"
        const bstr = atob(parts[1])
        const n = bstr.length
        const u8arr = new Uint8Array(n)
        for (let i = 0; i < n; i++) {
          u8arr[i] = bstr.charCodeAt(i)
        }
        const blob = new Blob([u8arr], { type: mime })
        const blobUrl = URL.createObjectURL(blob)
        const newWindow = window.open(blobUrl, "_blank", "noopener,noreferrer")
        if (newWindow) {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000)
        }
      } else if (generatedImage.url) {
        window.open(generatedImage.url, "_blank", "noopener,noreferrer")
      }
    } catch (error) {
      console.error("Error opening SVG:", error)
    }
  }, [generatedImage])

  const copyImageToClipboard = useCallback(async () => {
    if (!generatedImage) return
    try {
      // If we have SVG code, copy it as text to clipboard
      if (generatedImage.svgCode) {
        await navigator.clipboard.writeText(generatedImage.svgCode)
        setToast({ message: "SVG code copied to clipboard!", type: "success" })
        setTimeout(() => setToast(null), 2000)
        return
      }

      const convertToPngBlob = async (imageUrl: string): Promise<Blob> => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = "anonymous"

          img.onload = () => {
            const canvas = document.createElement("canvas")
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext("2d")

            if (!ctx) {
              reject(new Error("Failed to get canvas context"))
              return
            }

            ctx.drawImage(img, 0, 0)
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob)
                } else {
                  reject(new Error("Failed to convert to blob"))
                }
              },
              "image/png",
              1.0,
            )
          }

          img.onerror = () => reject(new Error("Failed to load image"))
          img.src = imageUrl
        })
      }

      if (isMobile) {
        try {
          const pngBlob = await convertToPngBlob(generatedImage.url)
          const clipboardItem = new ClipboardItem({ "image/png": pngBlob })
          await navigator.clipboard.write([clipboardItem])
          setToast({ message: "Image copied to clipboard!", type: "success" })
          setTimeout(() => setToast(null), 2000)
          return
        } catch (clipboardError) {
          try {
            const response = await fetch(generatedImage.url)
            const blob = await response.blob()
            const reader = new FileReader()
            reader.onloadend = async () => {
              try {
                await navigator.clipboard.writeText(reader.result as string)
                setToast({ message: "Image data copied! Paste in compatible apps.", type: "success" })
                setTimeout(() => setToast(null), 3000)
              } catch (err) {
                throw new Error("Clipboard not supported")
              }
            }
            reader.readAsDataURL(blob)
            return
          } catch (fallbackError) {
            setToast({
              message: "Copy not supported. Use download button instead.",
              type: "error",
            })
            setTimeout(() => setToast(null), 3000)
            return
          }
        }
      }

      setToast({ message: "Copying image...", type: "success" })
      window.focus()

      const pngBlob = await convertToPngBlob(generatedImage.url)
      const clipboardItem = new ClipboardItem({ "image/png": pngBlob })
      await navigator.clipboard.write([clipboardItem])

      setToast({ message: "Image copied to clipboard!", type: "success" })
      setTimeout(() => setToast(null), 2000)
    } catch (error) {
      console.error("Error copying image:", error)
      if (error instanceof Error && error.message.includes("not focused")) {
        setToast({
          message: "Please click on the page first, then try copying again",
          type: "error",
        })
      } else {
        setToast({ message: "Failed to copy image", type: "error" })
      }
      setTimeout(() => setToast(null), 2000)
    }
  }, [generatedImage, isMobile])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (canGenerate) {
          gatedRunGeneration()
        }
      }
    },
    [canGenerate, gatedRunGeneration],
  )

  const handleGlobalKeyboard = useCallback(
    (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isTyping = activeElement?.tagName === "TEXTAREA" || activeElement?.tagName === "INPUT"

      if ((e.metaKey || e.ctrlKey) && e.key === "c" && generatedImage && !e.shiftKey) {
        if (!isTyping) {
          e.preventDefault()
          copyImageToClipboard()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && generatedImage) {
        if (!isTyping) {
          e.preventDefault()
          downloadImage()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "u" && generatedImage) {
        if (!isTyping) {
          e.preventDefault()
          loadGeneratedAsInput()
        }
      }
      if (e.key === "Escape" && showFullscreen) {
        closeFullscreen()
      }
      if (showFullscreen && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !isTyping) {
        e.preventDefault()
        const completedGenerations = persistedGenerations.filter((g) => g.status === "complete" && g.imageUrl)
        if (completedGenerations.length <= 1) return

        const currentIndex = completedGenerations.findIndex((g) => g.imageUrl === fullscreenImageUrl)
        if (currentIndex === -1) return

        if (e.key === "ArrowLeft") {
          const prevIndex = currentIndex === 0 ? completedGenerations.length - 1 : currentIndex - 1
          setFullscreenImageUrl(completedGenerations[prevIndex].imageUrl!)
          setSelectedGenerationId(completedGenerations[prevIndex].id)
        } else if (e.key === "ArrowRight") {
          const nextIndex = currentIndex === completedGenerations.length - 1 ? 0 : currentIndex + 1
          setFullscreenImageUrl(completedGenerations[nextIndex].imageUrl!)
          setSelectedGenerationId(completedGenerations[nextIndex].id)
        }
      }
    },
    [
      generatedImage,
      showFullscreen,
      copyImageToClipboard,
      downloadImage,
      loadGeneratedAsInput,
      closeFullscreen,
      persistedGenerations,
      fullscreenImageUrl,
      setSelectedGenerationId,
    ],
  )

  const handleGlobalPaste = useCallback(
    async (e: ClipboardEvent) => {
      const activeElement = document.activeElement
      if (activeElement?.tagName !== "TEXTAREA" && activeElement?.tagName !== "INPUT") {
        const items = e.clipboardData?.items
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (item.type.startsWith("image/")) {
              e.preventDefault()
              const file = item.getAsFile()
              if (file) {
                setUseUrls(false)
                if (!image1) {
                  await handleImageUpload(file, 1)
                  showToast("Image pasted successfully", "success")
                } else if (!image2) {
                  await handleImageUpload(file, 2)
                  showToast("Image pasted to second slot", "success")
                } else {
                  await handleImageUpload(file, 1)
                  showToast("Image replaced first slot", "success")
                }
              }
              return
            }
          }
        }

        const pastedText = e.clipboardData?.getData("text")

        if (!pastedText) return

        const urlPattern = /https?:\/\/[^\s]+/i
        const imagePattern = /\.(jpg|jpeg|png|gif|webp|bmp|svg)|format=(jpg|jpeg|png|gif|webp)/i

        const match = pastedText.match(urlPattern)

        if (match) {
          const url = match[0]
          if (imagePattern.test(url) || url.includes("/media/") || url.includes("/images/")) {
            e.preventDefault()

            const targetSlot = !image1Url ? 1 : !image2Url ? 2 : 1

            setUseUrls(true)

            setTimeout(() => {
              handleUrlChange(url, targetSlot)
              showToast(`Image URL pasted to ${targetSlot === 1 ? "first" : "second"} slot`, "success")
            }, 150)
          }
        }
      }
    },
    [image1, image2, image1Url, image2Url, handleImageUpload, handleUrlChange],
  )

  const handlePromptPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = e.clipboardData.getData("text")

      const urlPattern = /https?:\/\/[^\s]+/i
      const imagePattern = /\.(jpg|jpeg|png|gif|webp|bmp|svg)|format=(jpg|jpeg|png|gif|webp)/i

      const match = pastedText.match(urlPattern)

      if (match) {
        const url = match[0]
        if (imagePattern.test(url) || url.includes("/media/") || url.includes("/images/")) {
          e.preventDefault()

          if (!useUrls) {
            setUseUrls(true)
          }

          if (!image1Url) {
            handleUrlChange(url, 1)
            showToast("Image URL loaded into first slot", "success")
          } else if (!image2Url) {
            handleUrlChange(url, 2)
            showToast("Image URL loaded into second slot", "success")
          } else {
            handleUrlChange(url, 1)
            showToast("Image URL replaced first slot", "success")
          }
        }
      }
    },
    [useUrls, image1Url, image2Url, handleUrlChange],
  )

  const handleGlobalDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragCounter((prev) => prev + 1)
    const items = e.dataTransfer?.items
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file" && items[i].type.startsWith("image/")) {
          setIsDraggingOver(true)
          break
        }
      }
    }
  }, [])

  const handleGlobalDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy"
    }
  }, [])

  const handleGlobalDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragCounter((prev) => {
      const newCount = prev - 1
      if (newCount <= 0) {
        setIsDraggingOver(false)
        return 0
      }
      return newCount
    })
  }, [])

  const handleGlobalDrop = useCallback(
    async (e: DragEvent | React.DragEvent, slot?: 1 | 2) => {
      e.preventDefault()
      setIsDraggingOver(false)
      setDragCounter(0)
      setDropZoneHover(null)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith("image/")) {
          setUseUrls(false)
          const targetSlot = slot || 1
          await handleImageUpload(file, targetSlot)
          showToast(`Image dropped to ${targetSlot === 1 ? "first" : "second"} slot`, "success")
        }
      }
    },
    [handleImageUpload],
  )

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyboard)
    document.addEventListener("paste", handleGlobalPaste)
    document.addEventListener("dragover", handleGlobalDragOver)
    document.addEventListener("dragleave", handleGlobalDragLeave)
    document.addEventListener("dragenter", handleGlobalDragEnter)
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyboard)
      document.removeEventListener("paste", handleGlobalPaste)
      document.removeEventListener("dragover", handleGlobalDragOver)
      document.removeEventListener("dragleave", handleGlobalDragLeave)
      document.removeEventListener("dragenter", handleGlobalDragEnter)
    }
  }, [handleGlobalKeyboard, handleGlobalPaste, handleGlobalDragOver, handleGlobalDragLeave, handleGlobalDragEnter])

  const clearAll = useCallback(() => {
    setPrompt("")
    clearImage(1)
    clearImage(2)
    setTimeout(() => {
      promptTextareaRef.current?.focus()
    }, 0)
  }, [clearImage])

  const handleFullscreenNavigate = useCallback(
    (direction: "prev" | "next") => {
      const completedGenerations = persistedGenerations.filter((g) => g.status === "complete" && g.imageUrl)
      const currentIndex = completedGenerations.findIndex((g) => g.imageUrl === fullscreenImageUrl)
      if (currentIndex === -1) return

      let newIndex: number
      if (direction === "prev") {
        newIndex = currentIndex === 0 ? completedGenerations.length - 1 : currentIndex - 1
      } else {
        newIndex = currentIndex === completedGenerations.length - 1 ? 0 : currentIndex + 1
      }

      setFullscreenImageUrl(completedGenerations[newIndex].imageUrl!)
      setSelectedGenerationId(completedGenerations[newIndex].id)
    },
    [persistedGenerations, fullscreenImageUrl, setSelectedGenerationId],
  )

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return

      const container = containerRef.current
      const containerRect = container.getBoundingClientRect()
      const offsetX = e.clientX - containerRect.left
      const percentage = (offsetX / containerRect.width) * 100

      // Limit between 30% and 70%
      const clampedPercentage = Math.max(30, Math.min(70, percentage))
      setLeftWidth(clampedPercentage)
    },
    [isResizing],
  )

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
  }, [])

  const handleDoubleClick = useCallback(() => {
    setLeftWidth(50)
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  return (
    <div className="bg-background min-h-screen flex items-center justify-center select-none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Nano Banana Pro",
            alternateName: "NB Pro",
            description:
              "Nano Banana Pro is a powerful AI image generation and editing tool powered by Google Gemini 2.5 Flash Image. Create, edit, and transform images with natural language prompts.",
            url: "https://v0nanobananapro.vercel.app",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Web Browser",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            creator: {
              "@type": "Organization",
              name: "v0",
              url: "https://v0.app",
            },
            keywords:
              "nano banana pro, nb pro, AI image generation, AI image editor, free AI image generator, text to image, Gemini image generation",
          }),
        }}
      />

      {toast && <ToastNotification message={toast.message} type={toast.type} />}

      {isDraggingOver && (
        <GlobalDropZone dropZoneHover={dropZoneHover} onSetDropZoneHover={setDropZoneHover} onDrop={handleGlobalDrop} />
      )}

      <div className="fixed inset-0 z-0 select-none shader-background bg-[#0A0A0A]">
        <MemoizedDithering
          colorBack="#000000"
          colorFront="#FFFFFF"
          speed={0.3}
          shape="square"
          type="2x2"
          pxSize={2}
          scale={1.5}
          style={{
            backgroundColor: "#0A0A0A",
            height: "100vh",
            width: "100vw",
          }}
        />
      </div>

      <div className="relative z-10 w-full h-full flex items-center justify-center p-2 md:p-4">
        <div className="w-full max-w-[98vw] lg:max-w-[96vw] 2xl:max-w-[94vw]">
          <div className="w-full mx-auto select-none">
            <div className="bg-[#111111]/95 border border-[#2A2A2A] shadow-lg flex flex-col rounded-lg overflow-hidden">
              <div className="bg-black px-3 py-3 md:px-4 md:py-4 lg:px-6 lg:py-5 flex items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex-shrink-0 overflow-hidden rounded-[6px] md:rounded-[8px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/v0-logo.jpg"
                      alt="v0 logo"
                      width={44}
                      height={44}
                      className="w-9 h-9 md:w-11 md:h-11 object-cover"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <h1 className="text-lg md:text-2xl font-bold text-white select-none leading-none">
                      SVG Generator
                    </h1>
                    <p className="text-[9px] md:text-[11px] text-gray-400 select-none tracking-wide mt-0.5 md:mt-1">
                      Powered by{" "}
                      <a
                        href="https://ai.google.dev/gemini-api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-300 transition-colors font-medium"
                      >
                        Gemini 3.1
                      </a>
                    </p>
                  </div>
                </div>
                <UserMenu />
              </div>
              <div className="px-3 py-3 md:px-4 md:py-4 lg:px-6 lg:py-6 flex flex-col bg-[#111111]">

        

                <div className="flex flex-col gap-4 xl:gap-0">
                <div
                  ref={containerRef}
                  className="flex flex-col xl:flex-row gap-4 xl:gap-0 xl:min-h-[60vh] 2xl:min-h-[62vh]"
                >
                  <div
                    className="flex flex-col xl:pl-4 xl:pr-4 xl:border-r xl:border-[#2A2A2A] xl:pt-5 flex-shrink-0 xl:overflow-y-auto xl:max-h-[85vh] 2xl:max-h-[80vh]"
                    style={{
                      width: isMobile ? "100%" : `${leftWidth}%`,
                    }}
                  >
                    <InputSection
                      prompt={prompt}
                      setPrompt={setPrompt}
                      aspectRatio={aspectRatio}
                      setAspectRatio={setAspectRatio}
                      availableAspectRatios={availableAspectRatios}
                      useUrls={useUrls}
                      setUseUrls={setUseUrls}
                      image1Preview={image1Preview}
                      image2Preview={image2Preview}
                      image1Url={image1Url}
                      image2Url={image2Url}
                      isConvertingHeic={isConvertingHeic}
                      canGenerate={canGenerate}
                      hasImages={hasImages}
                      onGenerate={gatedRunGeneration}
                      onClearAll={clearAll}
                      onImageUpload={handleImageUpload}
                      onUrlChange={handleUrlChange}
                      onClearImage={clearImage}
                      onKeyDown={handleKeyDown}
                      onPromptPaste={handlePromptPaste}
                      onImageFullscreen={openImageFullscreen}
                      promptTextareaRef={promptTextareaRef}
                      generations={persistedGenerations}
                      selectedGenerationId={selectedGenerationId}
                      onSelectGeneration={setSelectedGenerationId}
                      onCancelGeneration={cancelGeneration}
                      onDeleteGeneration={deleteGeneration}
                      historyLoading={historyLoading}
                      hasMore={hasMore}
                      onLoadMore={loadMore}
                      isLoadingMore={isLoadingMore}
                    />
                    {/* </CHANGE> */}

                    {/* Desktop History */}
                    <div className="hidden xl:block mt-3 flex-shrink-0">
                      <GenerationHistory
                        generations={persistedGenerations}
                        selectedId={selectedGenerationId}
                        onSelect={setSelectedGenerationId}
                        onCancel={cancelGeneration}
                        onDelete={deleteGeneration}
                        isLoading={historyLoading}
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        isLoadingMore={isLoadingMore}
                      />
                    </div>
                  </div>

                  <div
                    className="hidden xl:flex items-center justify-center cursor-col-resize hover:bg-white/5 transition-colors relative group"
                    style={{ width: "8px", flexShrink: 0 }}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={handleDoubleClick}
                  >
                    <div className="w-0.5 h-8 bg-white/20 group-hover:bg-white/40 transition-colors rounded-full" />
                  </div>

                  <div
                    className="flex flex-col xl:pl-4 xl:pr-4 h-[400px] sm:h-[500px] md:h-[600px] xl:h-auto flex-shrink-0"
                    style={{
                      width: isMobile ? "100%" : `${100 - leftWidth}%`,
                    }}
                  >
                    <OutputSection
                      selectedGeneration={selectedGeneration}
                      generations={persistedGenerations}
                      selectedGenerationId={selectedGenerationId}
                      setSelectedGenerationId={setSelectedGenerationId}
                      isConvertingHeic={isConvertingHeic}
                      heicProgress={heicProgress}
                      imageLoaded={imageLoaded}
                      setImageLoaded={setImageLoaded}
                      onCancelGeneration={cancelGeneration}
                      onDeleteGeneration={deleteGeneration}
                      onOpenFullscreen={openFullscreen}
                      onLoadAsInput={async () => {
                        // If SVG was edited, use the edited version
                        if (editedSvgCode) {
                          const svgBlob = new Blob([editedSvgCode], { type: "image/svg+xml" })
                          const file = new File([svgBlob], "edited-svg.svg", { type: "image/svg+xml" })
                          await handleImageUpload(file, 1)
                          showToast("Edited SVG loaded into Input 1", "success")
                        } else {
                          loadGeneratedAsInput()
                        }
                      }}
                      onCopy={copyImageToClipboard}
                      onDownload={downloadImage}
                      onOpenInNewTab={openImageInNewTab}
                      onSvgEdit={setEditedSvgCode}
                      editedSvgCode={editedSvgCode}
                    />
                  </div>
                </div>

                {/* Mobile History - After both sections */}
                <div className="xl:hidden flex-shrink-0">
                  <GenerationHistory
                    generations={persistedGenerations}
                    selectedId={selectedGenerationId}
                    onSelect={setSelectedGenerationId}
                    onCancel={cancelGeneration}
                    onDelete={deleteGeneration}
                    isLoading={historyLoading}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    isLoadingMore={isLoadingMore}
                  />
                </div>
              </div>

                <div className="mt-4 border-t border-[#2A2A2A] pt-5 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs text-white/40 flex-shrink-0">
                  <a
                    href="https://v0.app/templates/svg-generator-ALKIuzKpHCo?ref=KF9KC4"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white/70 transition-colors flex items-center gap-1"
                  >
                    Make this app your own
                  </a>
                  <span className="text-white/20 hidden sm:inline">•</span>
                  <button onClick={() => setShowHowItWorks(true)} className="hover:text-white/70 transition-colors">
                    How it works
                  </button>
                  <span className="text-white/20 hidden sm:inline">•</span>
                  <a
                    href="https://x.com/Raul_RomeroM"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white/70 transition-colors flex items-center gap-1"
                  >
                    Feedback? @Raul_RomeroM
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HowItWorksModal open={showHowItWorks} onOpenChange={setShowHowItWorks} />

      {showFullscreen && fullscreenImageUrl && (
        <FullscreenViewer
          imageUrl={fullscreenImageUrl}
          generations={persistedGenerations}
          onClose={closeFullscreen}
          onNavigate={handleFullscreenNavigate}
        />
      )}

      {showSignIn && <SignInOverlay onClose={() => setShowSignIn(false)} />}
    </div>
  )
}

export default ImageCombiner
