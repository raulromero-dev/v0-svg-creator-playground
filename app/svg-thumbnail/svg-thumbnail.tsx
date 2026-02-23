"use client"

import { useEffect, useRef } from "react"

// SVG path data for animated shapes
const SVG_PATHS = [
  // Bridge tower silhouette
  "M 120 400 L 120 150 L 140 140 L 160 150 L 160 400 Z",
  // Cable curve left
  "M 40 200 Q 140 100 240 200",
  // Cable curve right
  "M 240 200 Q 340 100 440 200",
  // Bridge deck
  "M 20 380 L 460 380 L 460 400 L 20 400 Z",
  // Vertical cable lines
  "M 80 200 L 80 380",
  "M 200 170 L 200 380",
  "M 280 170 L 280 380",
  "M 400 200 L 400 380",
  // Triangle accent
  "M 500 350 L 540 280 L 580 350 Z",
  // Circle accent
  "M 560 160 A 30 30 0 1 1 559.99 160",
  // Star shape
  "M 80 80 L 90 55 L 100 80 L 75 65 L 105 65 Z",
  // Small rect
  "M 520 80 L 580 80 L 580 120 L 520 120 Z",
]

const COLORS = [
  "rgba(255, 255, 255, 0.7)",
  "rgba(255, 255, 255, 0.5)",
  "rgba(255, 255, 255, 0.4)",
  "rgba(255, 255, 255, 0.6)",
  "rgba(255, 255, 255, 0.25)",
  "rgba(255, 255, 255, 0.25)",
  "rgba(255, 255, 255, 0.25)",
  "rgba(255, 255, 255, 0.25)",
  "rgba(255, 255, 255, 0.35)",
  "rgba(255, 255, 255, 0.3)",
  "rgba(255, 255, 255, 0.4)",
  "rgba(255, 255, 255, 0.3)",
]

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

    // Generate dot grid
    const dots: { x: number; y: number; baseOpacity: number }[] = []
    const gridCols = 40
    const gridRows = 21
    const spacingX = W / gridCols
    const spacingY = H / gridRows

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const seed = (row * 31 + col * 17 + row * col * 7) % 100
        let opacity = 0.04
        if (seed < 12) opacity = 0.6
        else if (seed < 25) opacity = 0.35
        else if (seed < 40) opacity = 0.18
        else if (seed < 55) opacity = 0.1

        dots.push({
          x: col * spacingX + spacingX / 2,
          y: row * spacingY + spacingY / 2,
          baseOpacity: opacity,
        })
      }
    }

    // Parse SVG path commands for drawing
    const drawPath = (ctx: CanvasRenderingContext2D, d: string, offsetX: number, offsetY: number, scale: number) => {
      const commands = d.match(/[MLQAZHCVS][^MLQAZHCVS]*/gi)
      if (!commands) return

      ctx.beginPath()
      for (const cmd of commands) {
        const type = cmd[0]
        const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number)

        switch (type.toUpperCase()) {
          case "M":
            ctx.moveTo(nums[0] * scale + offsetX, nums[1] * scale + offsetY)
            break
          case "L":
            ctx.lineTo(nums[0] * scale + offsetX, nums[1] * scale + offsetY)
            break
          case "Q":
            ctx.quadraticCurveTo(
              nums[0] * scale + offsetX, nums[1] * scale + offsetY,
              nums[2] * scale + offsetX, nums[3] * scale + offsetY
            )
            break
          case "A": {
            // Simplified arc -- draw as a circle approximation
            const rx = nums[0] * scale
            const cx = nums[5] * scale + offsetX
            const cy = nums[6] * scale + offsetY
            ctx.arc(cx, cy, rx, 0, Math.PI * 2)
            break
          }
          case "Z":
            ctx.closePath()
            break
        }
      }
    }

    // Animated anchor points data per path
    const pathAnchors = SVG_PATHS.map((d) => {
      const points: { x: number; y: number }[] = []
      const nums = d.match(/-?\d+\.?\d*/g)?.map(Number) || []
      for (let i = 0; i < nums.length; i += 2) {
        if (i + 1 < nums.length) {
          points.push({ x: nums[i], y: nums[i + 1] })
        }
      }
      return points
    })

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
        ctx.fillRect(dot.x - 2.5, dot.y - 2.5, 5, 5)
      }

      // Draw SVG shapes with staggered draw-in animation
      const scale = 1.2
      const offsetX = (W - 600 * scale) / 2
      const offsetY = (H - 420 * scale) / 2 + 20

      for (let i = 0; i < SVG_PATHS.length; i++) {
        const pathDelay = i * 0.3
        const pathProgress = Math.max(0, Math.min(1, (elapsed - pathDelay) / 1.2))
        
        if (pathProgress <= 0) continue

        const eased = 1 - Math.pow(1 - pathProgress, 3)
        const alpha = eased * 0.8

        // Draw the path shape
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.strokeStyle = COLORS[i] || "rgba(255, 255, 255, 0.4)"
        ctx.lineWidth = i === 3 ? 2 : 1.5
        ctx.setLineDash([])

        drawPath(ctx, SVG_PATHS[i], offsetX, offsetY, scale)

        // Fill for closed shapes
        if (SVG_PATHS[i].includes("Z")) {
          ctx.fillStyle = COLORS[i].replace(/[\d.]+\)$/, `${parseFloat(COLORS[i].match(/[\d.]+\)$/)?.[0] || "0.3") * 0.15})`)
          ctx.fill()
        }
        ctx.stroke()

        // Draw anchor points with pulse
        const anchors = pathAnchors[i]
        const pulse = Math.sin(elapsed * 2.5 + i) * 0.3 + 0.7

        for (const pt of anchors) {
          const px = pt.x * scale + offsetX
          const py = pt.y * scale + offsetY
          const size = 4

          // White square anchor
          ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * eased * pulse})`
          ctx.fillRect(px - size / 2, py - size / 2, size, size)
          ctx.strokeStyle = `rgba(100, 100, 100, ${0.6 * eased})`
          ctx.lineWidth = 0.5
          ctx.strokeRect(px - size / 2, py - size / 2, size, size)
        }

        ctx.restore()
      }

      // Floating cursor animation
      const cursorX = W * 0.55 + Math.sin(elapsed * 0.6) * 80
      const cursorY = H * 0.45 + Math.cos(elapsed * 0.4) * 50
      const cursorAlpha = 0.6 + Math.sin(elapsed * 1.5) * 0.2

      ctx.save()
      ctx.globalAlpha = cursorAlpha
      ctx.fillStyle = "white"
      ctx.beginPath()
      ctx.moveTo(cursorX, cursorY)
      ctx.lineTo(cursorX, cursorY + 18)
      ctx.lineTo(cursorX + 5, cursorY + 14)
      ctx.lineTo(cursorX + 10, cursorY + 22)
      ctx.lineTo(cursorX + 13, cursorY + 20)
      ctx.lineTo(cursorX + 8, cursorY + 12)
      ctx.lineTo(cursorX + 14, cursorY + 10)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // Selection dashed box around bridge area (animated dash offset)
      ctx.save()
      ctx.strokeStyle = "rgba(255, 255, 255, 0.25)"
      ctx.lineWidth = 1
      ctx.setLineDash([6, 4])
      ctx.lineDashOffset = -elapsed * 20
      const selX = offsetX + 100 * scale
      const selY = offsetY + 100 * scale
      const selW = 280 * scale
      const selH = 300 * scale
      ctx.strokeRect(selX, selY, selW, selH)
      ctx.restore()

      // Title text
      ctx.save()
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      // Main title
      ctx.font = "700 52px -apple-system, BlinkMacSystemFont, sans-serif"
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)"
      ctx.fillText("SVG Generator", W / 2, H * 0.14)

      // Subtitle
      ctx.font = "400 16px -apple-system, BlinkMacSystemFont, sans-serif"
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
      ctx.letterSpacing = "3px"
      ctx.fillText("TEXT & IMAGE TO SVG", W / 2, H * 0.21)

      // Bottom tagline
      ctx.font = "400 13px -apple-system, BlinkMacSystemFont, sans-serif"
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)"
      ctx.fillText("Click  \u00B7  Drag  \u00B7  Reshape  \u00B7  Export", W / 2, H * 0.93)
      ctx.restore()

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
