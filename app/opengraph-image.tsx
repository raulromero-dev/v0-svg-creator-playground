import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "SVG Generator - AI-Powered Vector Graphics"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  // Generate pixel dots with varying opacity like the favicon grid
  const dots: { x: number; y: number; opacity: number }[] = []
  const gridCols = 30
  const gridRows = 16
  const dotSize = 8
  const spacingX = 1200 / gridCols
  const spacingY = 630 / gridRows

  for (let row = 0; row < gridRows; row++) {
    for (let col = 0; col < gridCols; col++) {
      // Create a pseudo-random opacity pattern
      const seed = (row * 31 + col * 17 + row * col * 7) % 100
      let opacity = 0

      if (seed < 15) opacity = 0.8
      else if (seed < 30) opacity = 0.5
      else if (seed < 50) opacity = 0.25
      else if (seed < 65) opacity = 0.12
      else opacity = 0.06

      // Make dots near center brighter (where text will be)
      const centerX = gridCols / 2
      const centerY = gridRows / 2
      const distFromCenter = Math.sqrt(
        Math.pow((col - centerX) / gridCols, 2) +
        Math.pow((row - centerY) / gridRows, 2)
      )
      if (distFromCenter < 0.2) {
        opacity = Math.max(opacity, 0.15)
      }

      dots.push({
        x: col * spacingX + spacingX / 2 - dotSize / 2,
        y: row * spacingY + spacingY / 2 - dotSize / 2,
        opacity,
      })
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Pixel dot grid background */}
        {dots.map((dot, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: dot.x,
              top: dot.y,
              width: dotSize,
              height: dotSize,
              borderRadius: 1,
              background: `rgba(255, 255, 255, ${dot.opacity})`,
            }}
          />
        ))}

        {/* Main text */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-2px",
              lineHeight: 1,
              textAlign: "center",
            }}
          >
            SVG Generator
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.45)",
              letterSpacing: "4px",
              textTransform: "uppercase" as const,
              textAlign: "center",
            }}
          >
            Text & Image to SVG
          </div>
        </div>

        {/* Subtle border glow */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 1,
              background: "rgba(255, 255, 255, 0.6)",
            }}
          />
          <div
            style={{
              fontSize: 14,
              color: "rgba(255, 255, 255, 0.3)",
              letterSpacing: "2px",
              textTransform: "uppercase" as const,
            }}
          >
            Powered by Gemini 3.1
          </div>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 1,
              background: "rgba(255, 255, 255, 0.6)",
            }}
          />
        </div>
      </div>
    ),
    { ...size }
  )
}
