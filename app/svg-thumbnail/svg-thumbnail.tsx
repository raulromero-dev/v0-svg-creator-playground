"use client"

import { Dithering } from "@paper-design/shaders-react"

export function SvgThumbnail() {
  return (
    <div className="w-screen h-screen bg-[#0A0A0A] overflow-hidden">
      <Dithering
        colorBack="#000000"
        colorFront="#FFFFFF"
        speed={0.3}
        shape="square"
        type="2x2"
        pxSize={1}
        scale={2.5}
        style={{
          backgroundColor: "#0A0A0A",
          height: "100vh",
          width: "100vw",
        }}
      />
    </div>
  )
}
