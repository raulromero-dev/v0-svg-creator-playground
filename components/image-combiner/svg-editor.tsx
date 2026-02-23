"use client"

import { useRef, useState, useCallback, useEffect } from "react"

interface SvgEditorProps {
  svgCode: string
  onSvgChange: (newSvgCode: string) => void
}

// ---- Path command parser/serializer ----

interface PathPoint {
  type: string
  values: number[]
}

function parsePath(d: string): PathPoint[] {
  const commands: PathPoint[] = []
  const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g
  let match
  while ((match = regex.exec(d)) !== null) {
    const type = match[1]
    const rawVals = match[2].trim()
    const values = rawVals.length > 0
      ? rawVals.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
      : []
    commands.push({ type, values })
  }
  return commands
}

function serializePath(commands: PathPoint[]): string {
  return commands.map((cmd) => `${cmd.type}${cmd.values.join(" ")}`).join(" ")
}

// Extract anchor points and control handles from parsed path commands
interface AnchorPoint {
  cmdIndex: number
  valueIndex: number // index into values array for x (y is +1)
  x: number
  y: number
  isAbsolute: boolean
}

interface ControlHandle {
  cmdIndex: number
  valueIndex: number
  x: number
  y: number
  // The anchor it's attached to
  anchorX: number
  anchorY: number
  isAbsolute: boolean
}

function getPointsAndHandles(commands: PathPoint[]) {
  const anchors: AnchorPoint[] = []
  const handles: ControlHandle[] = []
  let curX = 0, curY = 0
  let startX = 0, startY = 0

  for (let i = 0; i < commands.length; i++) {
    const { type, values } = commands[i]
    const isAbs = type === type.toUpperCase()

    switch (type.toUpperCase()) {
      case "M": {
        // M/m x y (and subsequent implicit L)
        for (let j = 0; j < values.length; j += 2) {
          const x = isAbs ? values[j] : curX + values[j]
          const y = isAbs ? values[j + 1] : curY + values[j + 1]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y, isAbsolute: isAbs })
          curX = x
          curY = y
          if (j === 0) { startX = x; startY = y }
        }
        break
      }
      case "L": {
        for (let j = 0; j < values.length; j += 2) {
          const x = isAbs ? values[j] : curX + values[j]
          const y = isAbs ? values[j + 1] : curY + values[j + 1]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y, isAbsolute: isAbs })
          curX = x
          curY = y
        }
        break
      }
      case "H": {
        for (let j = 0; j < values.length; j++) {
          const x = isAbs ? values[j] : curX + values[j]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y: curY, isAbsolute: isAbs })
          curX = x
        }
        break
      }
      case "V": {
        for (let j = 0; j < values.length; j++) {
          const y = isAbs ? values[j] : curY + values[j]
          anchors.push({ cmdIndex: i, valueIndex: j, x: curX, y, isAbsolute: isAbs })
          curY = y
        }
        break
      }
      case "C": {
        // C cp1x cp1y cp2x cp2y x y
        for (let j = 0; j < values.length; j += 6) {
          const cp1x = isAbs ? values[j] : curX + values[j]
          const cp1y = isAbs ? values[j + 1] : curY + values[j + 1]
          const cp2x = isAbs ? values[j + 2] : curX + values[j + 2]
          const cp2y = isAbs ? values[j + 3] : curY + values[j + 3]
          const x = isAbs ? values[j + 4] : curX + values[j + 4]
          const y = isAbs ? values[j + 5] : curY + values[j + 5]

          // Control handle 1 attached to previous anchor
          handles.push({ cmdIndex: i, valueIndex: j, x: cp1x, y: cp1y, anchorX: curX, anchorY: curY, isAbsolute: isAbs })
          // Control handle 2 attached to the endpoint
          handles.push({ cmdIndex: i, valueIndex: j + 2, x: cp2x, y: cp2y, anchorX: x, anchorY: y, isAbsolute: isAbs })
          // Endpoint anchor
          anchors.push({ cmdIndex: i, valueIndex: j + 4, x, y, isAbsolute: isAbs })

          curX = x
          curY = y
        }
        break
      }
      case "S": {
        // S cp2x cp2y x y
        for (let j = 0; j < values.length; j += 4) {
          const cp2x = isAbs ? values[j] : curX + values[j]
          const cp2y = isAbs ? values[j + 1] : curY + values[j + 1]
          const x = isAbs ? values[j + 2] : curX + values[j + 2]
          const y = isAbs ? values[j + 3] : curY + values[j + 3]

          handles.push({ cmdIndex: i, valueIndex: j, x: cp2x, y: cp2y, anchorX: x, anchorY: y, isAbsolute: isAbs })
          anchors.push({ cmdIndex: i, valueIndex: j + 2, x, y, isAbsolute: isAbs })
          curX = x
          curY = y
        }
        break
      }
      case "Q": {
        // Q cpx cpy x y
        for (let j = 0; j < values.length; j += 4) {
          const cpx = isAbs ? values[j] : curX + values[j]
          const cpy = isAbs ? values[j + 1] : curY + values[j + 1]
          const x = isAbs ? values[j + 2] : curX + values[j + 2]
          const y = isAbs ? values[j + 3] : curY + values[j + 3]

          handles.push({ cmdIndex: i, valueIndex: j, x: cpx, y: cpy, anchorX: curX, anchorY: curY, isAbsolute: isAbs })
          anchors.push({ cmdIndex: i, valueIndex: j + 2, x, y, isAbsolute: isAbs })
          curX = x
          curY = y
        }
        break
      }
      case "T": {
        for (let j = 0; j < values.length; j += 2) {
          const x = isAbs ? values[j] : curX + values[j]
          const y = isAbs ? values[j + 1] : curY + values[j + 1]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y, isAbsolute: isAbs })
          curX = x
          curY = y
        }
        break
      }
      case "A": {
        // A rx ry rotation large-arc-flag sweep-flag x y
        for (let j = 0; j < values.length; j += 7) {
          const x = isAbs ? values[j + 5] : curX + values[j + 5]
          const y = isAbs ? values[j + 6] : curY + values[j + 6]
          anchors.push({ cmdIndex: i, valueIndex: j + 5, x, y, isAbsolute: isAbs })
          curX = x
          curY = y
        }
        break
      }
      case "Z": {
        curX = startX
        curY = startY
        break
      }
    }
  }

  return { anchors, handles }
}

export function SvgEditor({ svgCode, onSvgChange }: SvgEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [selectedElement, setSelectedElement] = useState<SVGElement | null>(null)
  const [zoom, setZoom] = useState(100)
  const [isDragging, setIsDragging] = useState(false)
  const [editMode, setEditMode] = useState<"move" | "points">("move")
  const [isPointDragging, setIsPointDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; origTx: number; origTy: number } | null>(null)
  const pointDragRef = useRef<{
    type: "anchor" | "handle"
    cmdIndex: number
    valueIndex: number
    isAbsolute: boolean
    startSvgX: number
    startSvgY: number
    origValX: number
    origValY: number
    pathElement: SVGPathElement
    commands: PathPoint[]
    isHCommand?: boolean
    isVCommand?: boolean
  } | null>(null)
  const currentElementRef = useRef<SVGElement | null>(null)

  // Parse and render SVG into the container
  useEffect(() => {
    if (!svgContainerRef.current || !svgCode) return

    const parser = new DOMParser()
    const doc = parser.parseFromString(svgCode, "image/svg+xml")
    const svgEl = doc.querySelector("svg")

    if (!svgEl) return

    svgContainerRef.current.innerHTML = ""

    const imported = document.importNode(svgEl, true) as SVGSVGElement
    imported.style.width = "100%"
    imported.style.height = "100%"
    imported.style.maxWidth = "100%"
    imported.style.maxHeight = "100%"
    imported.setAttribute("id", "editable-svg")

    svgContainerRef.current.appendChild(imported)

    setSelectedElement(null)
    setEditMode("move")
  }, [svgCode])

  const getTranslate = (el: SVGElement): { tx: number; ty: number } => {
    const transform = el.getAttribute("transform") || ""
    const match = transform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/)
    if (match) return { tx: parseFloat(match[1]), ty: parseFloat(match[2]) }
    return { tx: 0, ty: 0 }
  }

  const setTranslateOnEl = (el: SVGElement, tx: number, ty: number) => {
    let transform = el.getAttribute("transform") || ""
    if (/translate\([^)]*\)/.test(transform)) {
      transform = transform.replace(/translate\([^)]*\)/, `translate(${tx}, ${ty})`)
    } else {
      transform = `translate(${tx}, ${ty}) ${transform}`.trim()
    }
    el.setAttribute("transform", transform)
  }

  const serializeSvg = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector("#editable-svg")
    if (!svgEl) return null
    return new XMLSerializer().serializeToString(svgEl)
  }, [])

  const getSelectableElement = (target: EventTarget | null): SVGElement | null => {
    if (!target || !(target instanceof SVGElement)) return null
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg")
    if (!svgRoot) return null

    let current: SVGElement | null = target
    while (current && current.parentElement !== svgRoot) {
      if (current.parentElement instanceof SVGElement) {
        current = current.parentElement as SVGElement
      } else return null
    }

    if (!current) return null
    const tag = current.tagName.toLowerCase()
    if (["defs", "style", "metadata", "title", "desc"].includes(tag)) return null
    return current
  }

  // Double-click to enter point editing mode
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!selectedElement) return
    // Check if the selected element is a path or contains paths
    const pathEl = selectedElement.tagName.toLowerCase() === "path"
      ? selectedElement
      : selectedElement.querySelector("path")
    if (pathEl) {
      setEditMode("points")
      e.stopPropagation()
    }
  }, [selectedElement])

  const handleSvgClick = useCallback(
    (e: React.MouseEvent) => {
      // If in point edit mode and clicking on the same element, stay
      if (editMode === "points" && pointDragRef.current) return

      const target = getSelectableElement(e.target as EventTarget)
      if (target) {
        if (target !== selectedElement) {
          setEditMode("move")
        }
        setSelectedElement(target)
        e.stopPropagation()
      }
    },
    [editMode, selectedElement],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (editMode === "points") return // Points handle their own drag

      const target = getSelectableElement(e.target as EventTarget)
      if (!target) return

      setSelectedElement(target)
      currentElementRef.current = target

      const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
      if (!svgRoot) return

      const pt = svgRoot.createSVGPoint()
      const ctm = svgRoot.getScreenCTM()
      if (!ctm) return

      pt.x = e.clientX
      pt.y = e.clientY
      const svgP = pt.matrixTransform(ctm.inverse())

      const { tx, ty } = getTranslate(target)
      dragStartRef.current = { x: svgP.x, y: svgP.y, origTx: tx, origTy: ty }
      setIsDragging(true)
      e.preventDefault()
      e.stopPropagation()
    },
    [editMode],
  )

  // Move drag effect
  useEffect(() => {
    if (!isDragging || editMode === "points") return

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

      setTranslateOnEl(
        currentElementRef.current,
        dragStartRef.current.origTx + svgP.x - dragStartRef.current.x,
        dragStartRef.current.origTy + svgP.y - dragStartRef.current.y,
      )
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      const newSvg = serializeSvg()
      if (newSvg) onSvgChange(newSvg)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, editMode, serializeSvg, onSvgChange])

  // Store paths ref for point drag initiation
  const pathsRef = useRef<SVGPathElement[]>([])

  // Unified point mousedown handler on svgContainer
  const handlePointOverlayMouseDown = useCallback((e: React.MouseEvent) => {
    if (editMode !== "points") return

    const target = e.target as SVGElement
    const pointType = target.getAttribute("data-point-type") as "anchor" | "handle" | null
    if (!pointType) return

    e.stopPropagation()
    e.preventDefault()

    const cmdIndex = parseInt(target.getAttribute("data-cmd-index") || "0")
    const valueIndex = parseInt(target.getAttribute("data-value-index") || "0")
    const isAbsolute = target.getAttribute("data-is-absolute") === "true"
    const pathId = parseInt(target.getAttribute("data-path-id") || "0")
    const pathEl = pathsRef.current[pathId]
    if (!pathEl) return

    const d = pathEl.getAttribute("d")
    if (!d) return
    const commands = parsePath(d)

    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
    if (!svgRoot) return

    const pt = svgRoot.createSVGPoint()
    const ctm = svgRoot.getScreenCTM()
    if (!ctm) return

    pt.x = e.clientX
    pt.y = e.clientY
    const svgP = pt.matrixTransform(ctm.inverse())

    const cmd = commands[cmdIndex]
    const cmdType = cmd.type.toUpperCase()
    const isH = cmdType === "H"
    const isV = cmdType === "V"

    pointDragRef.current = {
      type: pointType,
      cmdIndex,
      valueIndex,
      isAbsolute,
      startSvgX: svgP.x,
      startSvgY: svgP.y,
      origValX: cmd.values[valueIndex],
      origValY: isH ? 0 : isV ? cmd.values[valueIndex] : cmd.values[valueIndex + 1],
      pathElement: pathEl,
      commands: JSON.parse(JSON.stringify(commands)),
      isHCommand: isH,
      isVCommand: isV,
    }
    setIsPointDragging(true)
  }, [editMode])

  // Point drag move/up -- driven by isPointDragging state
  useEffect(() => {
    if (!isPointDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const ref = pointDragRef.current
      if (!ref) return

      const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
      if (!svgRoot) return

      const pt = svgRoot.createSVGPoint()
      const ctm = svgRoot.getScreenCTM()
      if (!ctm) return

      pt.x = e.clientX
      pt.y = e.clientY
      const svgP = pt.matrixTransform(ctm.inverse())

      const dx = svgP.x - ref.startSvgX
      const dy = svgP.y - ref.startSvgY

      const cmds = ref.commands
      const cmd = cmds[ref.cmdIndex]

      if (ref.isHCommand) {
        cmd.values[ref.valueIndex] = ref.origValX + dx
      } else if (ref.isVCommand) {
        cmd.values[ref.valueIndex] = ref.origValY + dy
      } else {
        cmd.values[ref.valueIndex] = ref.origValX + dx
        cmd.values[ref.valueIndex + 1] = ref.origValY + dy
      }

      ref.pathElement.setAttribute("d", serializePath(cmds))
    }

    const handleMouseUp = () => {
      pointDragRef.current = null
      setIsPointDragging(false)
      const newSvg = serializeSvg()
      if (newSvg) onSvgChange(newSvg)
      // Force re-render of points overlay by toggling editMode
      setEditMode("move")
      requestAnimationFrame(() => setEditMode("points"))
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isPointDragging, serializeSvg, onSvgChange])

  // Draw selection and point overlays
  useEffect(() => {
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
    if (!svgRoot) return

    // Clean up all overlays
    svgRoot.querySelectorAll(".v0-selection-overlay").forEach((el) => el.remove())

    if (!selectedElement || !svgRoot.contains(selectedElement)) return

    const ns = "http://www.w3.org/2000/svg"

    if (editMode === "points") {
      // Path point editing mode
      const getAllPaths = (el: SVGElement): SVGPathElement[] => {
        if (el.tagName.toLowerCase() === "path") return [el as SVGPathElement]
        return Array.from(el.querySelectorAll("path")) as SVGPathElement[]
      }

      const paths = getAllPaths(selectedElement)
      pathsRef.current = paths
      for (const pathEl of paths) {
        const d = pathEl.getAttribute("d")
        if (!d) continue

        const commands = parsePath(d)
        const { anchors, handles } = getPointsAndHandles(commands)

        // Get transform from path to SVG root coordinates
        const pathCtm = (pathEl as SVGGraphicsElement).getCTM?.()
        const svgCtm = svgRoot.getCTM?.()
        if (!pathCtm || !svgCtm) continue
        const toScreen = svgCtm.inverse().multiply(pathCtm)

        const transformPoint = (x: number, y: number) => {
          const p = svgRoot.createSVGPoint()
          p.x = x
          p.y = y
          const tp = p.matrixTransform(toScreen)
          return { x: tp.x, y: tp.y }
        }

        // Draw handle lines (thin lines from anchor to control point)
        for (const h of handles) {
          const hp = transformPoint(h.x, h.y)
          const ap = transformPoint(h.anchorX, h.anchorY)

          const line = document.createElementNS(ns, "line")
          line.setAttribute("x1", String(ap.x))
          line.setAttribute("y1", String(ap.y))
          line.setAttribute("x2", String(hp.x))
          line.setAttribute("y2", String(hp.y))
          line.setAttribute("stroke", "#666")
          line.setAttribute("stroke-width", "0.8")
          line.setAttribute("class", "v0-selection-overlay")
          line.style.pointerEvents = "none"
          svgRoot.appendChild(line)
        }

        // Draw control handle circles (black filled)
        for (const h of handles) {
          const hp = transformPoint(h.x, h.y)

          const circle = document.createElementNS(ns, "circle")
          circle.setAttribute("cx", String(hp.x))
          circle.setAttribute("cy", String(hp.y))
          circle.setAttribute("r", "4")
          circle.setAttribute("fill", "black")
          circle.setAttribute("stroke", "#333")
          circle.setAttribute("stroke-width", "0.5")
          circle.setAttribute("class", "v0-selection-overlay")
          circle.style.cursor = "pointer"
          circle.style.pointerEvents = "all"

          // Drag handler for control handles -- store data in attributes
          circle.setAttribute("data-point-type", "handle")
          circle.setAttribute("data-cmd-index", String(h.cmdIndex))
          circle.setAttribute("data-value-index", String(h.valueIndex))
          circle.setAttribute("data-is-absolute", String(h.isAbsolute))
          circle.setAttribute("data-path-id", String(paths.indexOf(pathEl)))

          svgRoot.appendChild(circle)
        }

        // Draw anchor points (white squares with dark border)
        for (const a of anchors) {
          const ap = transformPoint(a.x, a.y)

          const rect = document.createElementNS(ns, "rect")
          rect.setAttribute("x", String(ap.x - 4))
          rect.setAttribute("y", String(ap.y - 4))
          rect.setAttribute("width", "8")
          rect.setAttribute("height", "8")
          rect.setAttribute("fill", "white")
          rect.setAttribute("stroke", "#333")
          rect.setAttribute("stroke-width", "1")
          rect.setAttribute("class", "v0-selection-overlay")
          rect.style.cursor = "pointer"
          rect.style.pointerEvents = "all"

          // Drag handler for anchors -- store data in attributes
          rect.setAttribute("data-point-type", "anchor")
          rect.setAttribute("data-cmd-index", String(a.cmdIndex))
          rect.setAttribute("data-value-index", String(a.valueIndex))
          rect.setAttribute("data-is-absolute", String(a.isAbsolute))
          rect.setAttribute("data-path-id", String(paths.indexOf(pathEl)))

          svgRoot.appendChild(rect)
        }
      }
    } else {
      // Bounding box selection mode
      const bbox = (selectedElement as SVGGraphicsElement).getBBox?.()
      if (!bbox) return

      const elementCtm = (selectedElement as SVGGraphicsElement).getCTM?.()
      const svgCtm = svgRoot.getCTM?.()
      if (!elementCtm || !svgCtm) return

      const transformCorner = (x: number, y: number) => {
        const p = svgRoot.createSVGPoint()
        p.x = x
        p.y = y
        return p.matrixTransform(elementCtm).matrixTransform(svgCtm.inverse())
      }

      const tl = transformCorner(bbox.x, bbox.y)
      const tr = transformCorner(bbox.x + bbox.width, bbox.y)
      const bl = transformCorner(bbox.x, bbox.y + bbox.height)
      const br = transformCorner(bbox.x + bbox.width, bbox.y + bbox.height)

      const rect = document.createElementNS(ns, "polygon")
      rect.setAttribute("points", `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`)
      rect.setAttribute("fill", "none")
      rect.setAttribute("stroke", "white")
      rect.setAttribute("stroke-width", "1.5")
      rect.setAttribute("stroke-dasharray", "4 2")
      rect.setAttribute("class", "v0-selection-overlay")
      rect.style.pointerEvents = "none"
      svgRoot.appendChild(rect)

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
    }
  }, [selectedElement, isDragging, svgCode, editMode])

  // Click outside to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === svgContainerRef.current) {
      setSelectedElement(null)
      setEditMode("move")
    }
  }, [])

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editMode === "points") {
          setEditMode("move")
        } else {
          setSelectedElement(null)
        }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedElement && editMode === "move") {
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
  }, [selectedElement, editMode, serializeSvg, onSvgChange])

  const handleZoom = (newZoom: number) => {
    setZoom(Math.max(25, Math.min(400, newZoom)))
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
        >
          -
        </button>
        <span className="px-3 py-1.5 min-w-[50px] text-center">{zoom}%</span>
        <button
          onClick={() => handleZoom(zoom + 25)}
          className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(100)}
          className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10"
        >
          reset
        </button>
      </div>

      {/* Edit mode indicator */}
      {editMode === "points" && (
        <div className="absolute top-3 right-3 z-20 bg-black/80 backdrop-blur-sm rounded border border-white/10 text-white text-xs font-mono px-3 py-1.5">
          Point Editing
          <span className="text-white/40 ml-2">ESC to exit</span>
        </div>
      )}

      {/* Double-click hint */}
      {selectedElement && editMode === "move" && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-black/70 backdrop-blur-sm rounded border border-white/10 text-white/60 text-[10px] font-mono px-2.5 py-1">
          Double-click to edit points
        </div>
      )}

      {/* SVG canvas */}
      <div
        ref={svgContainerRef}
        className="w-full h-full flex items-center justify-center"
        style={{
          transform: `scale(${zoom / 100})`,
          transformOrigin: "center center",
          cursor: isDragging ? "grabbing" : editMode === "points" ? "crosshair" : "default",
        }}
        onClick={handleSvgClick}
        onMouseDown={(e) => {
          handlePointOverlayMouseDown(e)
          if (editMode !== "points") handleMouseDown(e)
        }}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  )
}
