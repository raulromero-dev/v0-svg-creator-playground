"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface SvgEditorProps {
  svgCode: string
  onSvgChange: (newSvgCode: string) => void
}

export function SvgEditor({ svgCode, onSvgChange }: SvgEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [selectedElement, setSelectedElement] = useState<SVGElement | null>(null)
  const [zoom, setZoom] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; origTx: number; origTy: number } | null>(null)
  const currentElementRef = useRef<SVGElement | null>(null)

  // Parse and render SVG into the container
  useEffect(() => {
    if (!svgContainerRef.current || !svgCode) return

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgCode, "image/svg+xml")
    const svgEl = doc.querySelector("svg")

    if (!svgEl) return

    // Clear previous content
    svgContainerRef.current.innerHTML = ""

    // Clone the SVG into the DOM
    const imported = document.importNode(svgEl, true) as SVGSVGElement
    imported.style.width = "100%"
    imported.style.height = "100%"
    imported.style.maxWidth = "100%"
    imported.style.maxHeight = "100%"
    imported.setAttribute("id", "editable-svg")

    svgContainerRef.current.appendChild(imported)

    // Deselect on new SVG
    setSelectedElement(null)
  }, [svgCode])

  // Get the current transform translate values for an element
  const getTranslate = (el: SVGElement): { tx: number; ty: number } => {
    const transform = el.getAttribute("transform") || ""
    const match = transform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/)
    if (match) {
      return { tx: parseFloat(match[1]), ty: parseFloat(match[2]) }
    }
    return { tx: 0, ty: 0 }
  }

  // Set translate on an element, preserving other transforms
  const setTranslate = (el: SVGElement, tx: number, ty: number) => {
    let transform = el.getAttribute("transform") || ""
    const hasTranslate = /translate\([^)]*\)/.test(transform)

    if (hasTranslate) {
      transform = transform.replace(/translate\([^)]*\)/, `translate(${tx}, ${ty})`)
    } else {
      transform = `translate(${tx}, ${ty}) ${transform}`.trim()
    }

    el.setAttribute("transform", transform)
  }

  // Serialize the current SVG back to a string
  const serializeSvg = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector("#editable-svg")
    if (!svgEl) return null
    const serializer = new XMLSerializer()
    return serializer.serializeToString(svgEl)
  }, [])

  // Get the closest selectable element (direct children of SVG or g at top level)
  const getSelectableElement = (target: EventTarget | null): SVGElement | null => {
    if (!target || !(target instanceof SVGElement)) return null

    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg")
    if (!svgRoot) return null

    // Walk up to find a direct child of the root SVG
    let current: SVGElement | null = target
    while (current && current.parentElement !== svgRoot) {
      if (current.parentElement instanceof SVGElement) {
        current = current.parentElement as SVGElement
      } else {
        return null
      }
    }

    // Skip defs, style, metadata
    if (!current) return null
    const tag = current.tagName.toLowerCase()
    if (tag === "defs" || tag === "style" || tag === "metadata" || tag === "title" || tag === "desc") {
      return null
    }

    return current
  }

  // Handle click to select an element
  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      const target = getSelectableElement(e.target as EventTarget)
      if (target) {
        setSelectedElement(target)
        e.stopPropagation()
      }
    },
    [],
  )

  // Handle mousedown on SVG to start drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = getSelectableElement(e.target as EventTarget)
      if (!target) return

      setSelectedElement(target)
      currentElementRef.current = target

      const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
      if (!svgRoot) return

      // Get mouse position in SVG coordinate space
      const pt = svgRoot.createSVGPoint()
      const ctm = svgRoot.getScreenCTM()
      if (!ctm) return

      pt.x = e.clientX
      pt.y = e.clientY
      const svgP = pt.matrixTransform(ctm.inverse())

      const { tx, ty } = getTranslate(target)

      dragStartRef.current = {
        x: svgP.x,
        y: svgP.y,
        origTx: tx,
        origTy: ty,
      }

      setIsDragging(true)
      e.preventDefault()
      e.stopPropagation()
    },
    [],
  )

  // Handle mousemove during drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !currentElementRef.current) return

      const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
      if (!svgRoot) return

      const pt = svgRoot.createSVGPoint()
      const ctm = svgRoot.getScreenCTM()
      if (!ctm) return

      pt.x = e.clientX
      pt.y = e.clientY
      const svgP = pt.matrixTransform(ctm.inverse())

      const dx = svgP.x - dragStartRef.current.x
      const dy = svgP.y - dragStartRef.current.y

      setTranslate(
        currentElementRef.current,
        dragStartRef.current.origTx + dx,
        dragStartRef.current.origTy + dy,
      )
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null

      // Serialize and notify parent of changes
      const newSvg = serializeSvg()
      if (newSvg) {
        onSvgChange(newSvg)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, serializeSvg, onSvgChange])

  // Touch support for mobile drag
  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      const target = getSelectableElement(document.elementFromPoint(touch.clientX, touch.clientY))
      if (!target) return

      setSelectedElement(target)
      currentElementRef.current = target

      const svgRoot = container.querySelector("#editable-svg") as SVGSVGElement
      if (!svgRoot) return

      const pt = svgRoot.createSVGPoint()
      const ctm = svgRoot.getScreenCTM()
      if (!ctm) return

      pt.x = touch.clientX
      pt.y = touch.clientY
      const svgP = pt.matrixTransform(ctm.inverse())

      const { tx, ty } = getTranslate(target)
      dragStartRef.current = { x: svgP.x, y: svgP.y, origTx: tx, origTy: ty }
      setIsDragging(true)
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current || !currentElementRef.current) return
      e.preventDefault()

      const touch = e.touches[0]
      const svgRoot = container.querySelector("#editable-svg") as SVGSVGElement
      if (!svgRoot) return

      const pt = svgRoot.createSVGPoint()
      const ctm = svgRoot.getScreenCTM()
      if (!ctm) return

      pt.x = touch.clientX
      pt.y = touch.clientY
      const svgP = pt.matrixTransform(ctm.inverse())

      const dx = svgP.x - dragStartRef.current.x
      const dy = svgP.y - dragStartRef.current.y

      setTranslate(
        currentElementRef.current,
        dragStartRef.current.origTx + dx,
        dragStartRef.current.origTy + dy,
      )
    }

    const handleTouchEnd = () => {
      if (isDragging) {
        setIsDragging(false)
        dragStartRef.current = null
        const newSvg = serializeSvg()
        if (newSvg) onSvgChange(newSvg)
      }
    }

    container.addEventListener("touchstart", handleTouchStart, { passive: false })
    container.addEventListener("touchmove", handleTouchMove, { passive: false })
    container.addEventListener("touchend", handleTouchEnd)

    return () => {
      container.removeEventListener("touchstart", handleTouchStart)
      container.removeEventListener("touchmove", handleTouchMove)
      container.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging, serializeSvg, onSvgChange])

  // Draw selection box around selected element
  useEffect(() => {
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
    if (!svgRoot) return

    // Remove previous selection indicators
    svgRoot.querySelectorAll(".v0-selection-overlay").forEach((el) => el.remove())

    if (!selectedElement || !svgRoot.contains(selectedElement)) return

    const bbox = (selectedElement as SVGGraphicsElement).getBBox?.()
    if (!bbox) return

    // Get the element's CTM relative to the SVG root
    const elementCtm = (selectedElement as SVGGraphicsElement).getCTM?.()
    const svgCtm = svgRoot.getCTM?.()
    if (!elementCtm || !svgCtm) return

    // Transform bbox corners through element's transform
    const topLeft = svgRoot.createSVGPoint()
    topLeft.x = bbox.x
    topLeft.y = bbox.y
    const tl = topLeft.matrixTransform(elementCtm).matrixTransform(svgCtm.inverse())

    const topRight = svgRoot.createSVGPoint()
    topRight.x = bbox.x + bbox.width
    topRight.y = bbox.y
    const tr = topRight.matrixTransform(elementCtm).matrixTransform(svgCtm.inverse())

    const bottomLeft = svgRoot.createSVGPoint()
    bottomLeft.x = bbox.x
    bottomLeft.y = bbox.y + bbox.height
    const bl = bottomLeft.matrixTransform(elementCtm).matrixTransform(svgCtm.inverse())

    const bottomRight = svgRoot.createSVGPoint()
    bottomRight.x = bbox.x + bbox.width
    bottomRight.y = bbox.y + bbox.height
    const br = bottomRight.matrixTransform(elementCtm).matrixTransform(svgCtm.inverse())

    const ns = "http://www.w3.org/2000/svg"

    // Selection rectangle (outline)
    const rect = document.createElementNS(ns, "polygon")
    rect.setAttribute("points", `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`)
    rect.setAttribute("fill", "none")
    rect.setAttribute("stroke", "white")
    rect.setAttribute("stroke-width", "1.5")
    rect.setAttribute("stroke-dasharray", "4 2")
    rect.setAttribute("class", "v0-selection-overlay")
    rect.style.pointerEvents = "none"
    svgRoot.appendChild(rect)

    // Corner handles
    const corners = [tl, tr, br, bl]
    for (const corner of corners) {
      const handle = document.createElementNS(ns, "rect")
      handle.setAttribute("x", String(corner.x - 3))
      handle.setAttribute("y", String(corner.y - 3))
      handle.setAttribute("width", "6")
      handle.setAttribute("height", "6")
      handle.setAttribute("fill", "white")
      handle.setAttribute("stroke", "#333")
      handle.setAttribute("stroke-width", "0.5")
      handle.setAttribute("class", "v0-selection-overlay")
      handle.style.pointerEvents = "none"
      svgRoot.appendChild(handle)
    }

    // Midpoint handles
    const midpoints = [
      { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 },
      { x: (tr.x + br.x) / 2, y: (tr.y + br.y) / 2 },
      { x: (br.x + bl.x) / 2, y: (br.y + bl.y) / 2 },
      { x: (bl.x + tl.x) / 2, y: (bl.y + tl.y) / 2 },
    ]
    for (const mp of midpoints) {
      const handle = document.createElementNS(ns, "circle")
      handle.setAttribute("cx", String(mp.x))
      handle.setAttribute("cy", String(mp.y))
      handle.setAttribute("r", "3")
      handle.setAttribute("fill", "white")
      handle.setAttribute("stroke", "#333")
      handle.setAttribute("stroke-width", "0.5")
      handle.setAttribute("class", "v0-selection-overlay")
      handle.style.pointerEvents = "none"
      svgRoot.appendChild(handle)
    }
  }, [selectedElement, isDragging, svgCode])

  // Click outside to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === svgContainerRef.current) {
      setSelectedElement(null)
    }
  }, [])

  // Keyboard: delete selected, escape to deselect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedElement(null)
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement) {
        const activeEl = document.activeElement
        if (activeEl?.tagName === "TEXTAREA" || activeEl?.tagName === "INPUT") return

        selectedElement.remove()
        setSelectedElement(null)
        const newSvg = serializeSvg()
        if (newSvg) onSvgChange(newSvg)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedElement, serializeSvg, onSvgChange])

  const handleZoom = (newZoom: number) => {
    const clamped = Math.max(25, Math.min(400, newZoom))
    setZoom(clamped)
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-white rounded relative overflow-hidden"
      onClick={handleContainerClick}
    >
      {/* Zoom controls */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-0 bg-black/80 backdrop-blur-sm rounded border border-white/10 text-white text-xs font-mono">
        <button
          onClick={() => handleZoom(zoom - 25)}
          className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-r border-white/10"
          title="Zoom out"
        >
          -
        </button>
        <span className="px-3 py-1.5 min-w-[50px] text-center">{zoom}%</span>
        <button
          onClick={() => handleZoom(zoom + 25)}
          className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(100)}
          className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10"
          title="Reset zoom"
        >
          reset
        </button>
      </div>

      {/* SVG canvas */}
      <div
        ref={svgContainerRef}
        className="w-full h-full flex items-center justify-center"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "center center",
          cursor: isDragging ? "grabbing" : "default",
        }}
        onClick={handleSvgClick}
        onMouseDown={handleMouseDown}
      />
    </div>
  )
}
