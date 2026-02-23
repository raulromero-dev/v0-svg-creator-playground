"use client"

import { useEffect, useRef } from "react"

export function SvgThumbnail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = 1200
    const H = 630
    canvas.width = W
    canvas.height = H

    // Dense dot grid
    const dots: { x: number; y: number; baseOpacity: number }[] = []
    const gridCols = 96
    const gridRows = 50
    const spacingX = W / gridCols
    const spacingY = H / gridRows

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const seed = (row * 31 + col * 17 + row * col * 7) % 100
        let opacity = 0.04
        if (seed < 10) opacity = 0.6
        else if (seed < 20) opacity = 0.35
        else if (seed < 35) opacity = 0.18
        else if (seed < 50) opacity = 0.1

        dots.push({
          x: col * spacingX + spacingX / 2,
          y: row * spacingY + spacingY / 2,
          baseOpacity: opacity,
        })
      }
    }

    startTimeRef.current = performance.now()

    const animate = (time: number) => {
      const elapsed = (time - startTimeRef.current) / 1000
      ctx.clearRect(0, 0, W, H)

      // Background
      ctx.fillStyle = "#0A0A0A"
      ctx.fillRect(0, 0, W, H)

      // Animated dot grid with wave
      for (const dot of dots) {
        const wave = Math.sin(elapsed * 0.8 + dot.x * 0.005 + dot.y * 0.003) * 0.15
        const opacity = Math.max(0.02, Math.min(1, dot.baseOpacity + wave))
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`
        ctx.fillRect(dot.x - 1.5, dot.y - 1.5, 3, 3)
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <div className="w-screen h-screen bg-[#0A0A0A] flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain"
        style={{ maxWidth: 1200, maxHeight: 630 }}
      />
    </div>
  )
}
