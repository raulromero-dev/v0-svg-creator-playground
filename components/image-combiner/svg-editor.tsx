"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { getSelectableElement as getSelectableElementFn } from "./get-selectable-element"

interface SvgEditorProps {
  svgCode: string
  onSvgChange: (newSvgCode: string) => void
}

// ---- Path command parser/serializer ----

interface PathCmd {
  type: string
  values: number[]
}

function parsePath(d: string): PathCmd[] {
  const commands: PathCmd[] = []
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

function serializePath(commands: PathCmd[]): string {
  return commands.map((cmd) => `${cmd.type}${cmd.values.join(" ")}`).join(" ")
}

interface AnchorPoint {
  cmdIndex: number
  valueIndex: number
  x: number
  y: number
  isAbsolute: boolean
}

interface ControlHandle {
  cmdIndex: number
  valueIndex: number
  x: number
  y: number
  anchorX: number
  anchorY: number
  isAbsolute: boolean
}

function getPointsAndHandles(commands: PathCmd[]) {
  const anchors: AnchorPoint[] = []
  const handles: ControlHandle[] = []
  let curX = 0, curY = 0
  let startX = 0, startY = 0

  for (let i = 0; i < commands.length; i++) {
    const { type, values } = commands[i]
    const isAbs = type === type.toUpperCase()

    switch (type.toUpperCase()) {
      case "M":
        for (let j = 0; j < values.length; j += 2) {
          const x = isAbs ? values[j] : curX + values[j]
          const y = isAbs ? values[j + 1] : curY + values[j + 1]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y, isAbsolute: isAbs })
          curX = x; curY = y
          if (j === 0) { startX = x; startY = y }
        }
        break
      case "L":
        for (let j = 0; j < values.length; j += 2) {
          const x = isAbs ? values[j] : curX + values[j]
          const y = isAbs ? values[j + 1] : curY + values[j + 1]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y, isAbsolute: isAbs })
          curX = x; curY = y
        }
        break
      case "H":
        for (let j = 0; j < values.length; j++) {
          const x = isAbs ? values[j] : curX + values[j]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y: curY, isAbsolute: isAbs })
          curX = x
        }
        break
      case "V":
        for (let j = 0; j < values.length; j++) {
          const y = isAbs ? values[j] : curY + values[j]
          anchors.push({ cmdIndex: i, valueIndex: j, x: curX, y, isAbsolute: isAbs })
          curY = y
        }
        break
      case "C":
        for (let j = 0; j < values.length; j += 6) {
          const cp1x = isAbs ? values[j] : curX + values[j]
          const cp1y = isAbs ? values[j + 1] : curY + values[j + 1]
          const cp2x = isAbs ? values[j + 2] : curX + values[j + 2]
          const cp2y = isAbs ? values[j + 3] : curY + values[j + 3]
          const x = isAbs ? values[j + 4] : curX + values[j + 4]
          const y = isAbs ? values[j + 5] : curY + values[j + 5]
          handles.push({ cmdIndex: i, valueIndex: j, x: cp1x, y: cp1y, anchorX: curX, anchorY: curY, isAbsolute: isAbs })
          handles.push({ cmdIndex: i, valueIndex: j + 2, x: cp2x, y: cp2y, anchorX: x, anchorY: y, isAbsolute: isAbs })
          anchors.push({ cmdIndex: i, valueIndex: j + 4, x, y, isAbsolute: isAbs })
          curX = x; curY = y
        }
        break
      case "S":
        for (let j = 0; j < values.length; j += 4) {
          const cp2x = isAbs ? values[j] : curX + values[j]
          const cp2y = isAbs ? values[j + 1] : curY + values[j + 1]
          const x = isAbs ? values[j + 2] : curX + values[j + 2]
          const y = isAbs ? values[j + 3] : curY + values[j + 3]
          handles.push({ cmdIndex: i, valueIndex: j, x: cp2x, y: cp2y, anchorX: x, anchorY: y, isAbsolute: isAbs })
          anchors.push({ cmdIndex: i, valueIndex: j + 2, x, y, isAbsolute: isAbs })
          curX = x; curY = y
        }
        break
      case "Q":
        for (let j = 0; j < values.length; j += 4) {
          const cpx = isAbs ? values[j] : curX + values[j]
          const cpy = isAbs ? values[j + 1] : curY + values[j + 1]
          const x = isAbs ? values[j + 2] : curX + values[j + 2]
          const y = isAbs ? values[j + 3] : curY + values[j + 3]
          handles.push({ cmdIndex: i, valueIndex: j, x: cpx, y: cpy, anchorX: curX, anchorY: curY, isAbsolute: isAbs })
          anchors.push({ cmdIndex: i, valueIndex: j + 2, x, y, isAbsolute: isAbs })
          curX = x; curY = y
        }
        break
      case "T":
        for (let j = 0; j < values.length; j += 2) {
          const x = isAbs ? values[j] : curX + values[j]
          const y = isAbs ? values[j + 1] : curY + values[j + 1]
          anchors.push({ cmdIndex: i, valueIndex: j, x, y, isAbsolute: isAbs })
          curX = x; curY = y
        }
        break
      case "A":
        for (let j = 0; j < values.length; j += 7) {
          const x = isAbs ? values[j + 5] : curX + values[j + 5]
          const y = isAbs ? values[j + 6] : curY + values[j + 6]
          anchors.push({ cmdIndex: i, valueIndex: j + 5, x, y, isAbsolute: isAbs })
          curX = x; curY = y
        }
        break
      case "Z":
        curX = startX; curY = startY
        break
    }
  }
  return { anchors, handles }
}

// ---- Component ----

export function SvgEditor({ svgCode, onSvgChange }: SvgEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [selectedElement, setSelectedElement] = useState<SVGElement | null>(null)
  const [zoom, setZoom] = useState(100)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [checkerboard, setCheckerboard] = useState(false)
  const [wireframe, setWireframe] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pointDragActive, setPointDragActive] = useState(false)
  const [overlayKey, setOverlayKey] = useState(0) // bump to force overlay redraw
  const dragStartRef = useRef<{ x: number; y: number; origTx: number; origTy: number } | null>(null)
  const currentElementRef = useRef<SVGElement | null>(null)
  const pointDragRef = useRef<{
    cmdIndex: number
    valueIndex: number
    startSvgX: number
    startSvgY: number
    origValX: number
    origValY: number
    pathElement: SVGPathElement
    commands: PathCmd[]
    isHCommand: boolean
    isVCommand: boolean
  } | null>(null)

  // Undo history
  const undoStackRef = useRef<string[]>([])
  const MAX_UNDO = 50
  const lastSvgRef = useRef<string>(svgCode)
  const isUndoingRef = useRef(false)
  // Flag to skip re-injection when the SVG change originated from within the editor
  const isSelfEditRef = useRef(false)

  // Wrap onSvgChange to capture previous state for undo
  const commitChange = useCallback((newSvg: string) => {
    const prev = lastSvgRef.current
    if (prev && prev !== newSvg) {
      undoStackRef.current.push(prev)
      if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift()
    }
    lastSvgRef.current = newSvg
    isSelfEditRef.current = true
    onSvgChange(newSvg)
  }, [onSvgChange])

  // Stable refs so native DOM listeners always get current versions
  const commitChangeRef = useRef(commitChange)
  commitChangeRef.current = commitChange
  const setPointDragActiveRef = useRef(setPointDragActive)
  setPointDragActiveRef.current = setPointDragActive

  // Parse and inject SVG — only when it's a new generation, switching generations, or undo.
  // Self-edits (drag, delete, etc.) are applied live on the DOM and don't need re-injection.
  useEffect(() => {
    if (!svgContainerRef.current || !svgCode) return

    // Skip re-injection for edits made within the editor
    if (isSelfEditRef.current) {
      isSelfEditRef.current = false
      lastSvgRef.current = svgCode
      console.log("[v0] Skipping re-injection (self-edit)")
      return
    }

    console.log("[v0] Injecting SVG, overflow in source:", svgCode.includes('overflow="hidden"'), "svgCode length:", svgCode.length)
    console.log("[v0] First 200 chars:", svgCode.substring(0, 200))

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
    imported.setAttribute("overflow", "hidden")
    imported.style.overflow = "hidden" // Override any inline style="overflow: visible" from the model
    svgContainerRef.current.appendChild(imported)
    console.log("[v0] SVG injected, overflow attr:", imported.getAttribute("overflow"), "style.overflow:", imported.style.overflow)

    setSelectedElement(null)
    lastSvgRef.current = svgCode
    // Only clear undo stack for truly new SVGs (new generation), not undo/redo
    if (isUndoingRef.current) {
      isUndoingRef.current = false
    } else {
      undoStackRef.current = []
    }
  }, [svgCode])

  const getTranslate = (el: SVGElement): { tx: number; ty: number } => {
    const t = el.getAttribute("transform") || ""
    const m = t.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/)
    return m ? { tx: parseFloat(m[1]), ty: parseFloat(m[2]) } : { tx: 0, ty: 0 }
  }

  const setTranslateOnEl = (el: SVGElement, tx: number, ty: number) => {
    let t = el.getAttribute("transform") || ""
    if (/translate\([^)]*\)/.test(t)) {
      t = t.replace(/translate\([^)]*\)/, `translate(${tx}, ${ty})`)
    } else {
      t = `translate(${tx}, ${ty}) ${t}`.trim()
    }
    el.setAttribute("transform", t)
  }

  // Check if any user-edited element extends beyond the viewBox and update overflow accordingly
  const updateOverflowForBounds = useCallback(() => {
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
    if (!svgRoot) return
    const vb = svgRoot.viewBox?.baseVal
    if (!vb || (vb.width === 0 && vb.height === 0)) return

    // Get the bounding box of all visible content
    const bbox = svgRoot.getBBox()
    const extends_beyond =
      bbox.x < vb.x ||
      bbox.y < vb.y ||
      bbox.x + bbox.width > vb.x + vb.width ||
      bbox.y + bbox.height > vb.y + vb.height

    const overflowValue = extends_beyond ? "visible" : "hidden"
    console.log("[v0] updateOverflowForBounds: bbox=", bbox, "viewBox=", { x: vb.x, y: vb.y, w: vb.width, h: vb.height }, "extends_beyond=", extends_beyond, "setting:", overflowValue)
    svgRoot.setAttribute("overflow", overflowValue)
    svgRoot.style.overflow = overflowValue
  }, [])

  const serializeSvg = useCallback(() => {
    const svgEl = svgContainerRef.current?.querySelector("#editable-svg")
    if (!svgEl) return null
    // Clone and strip editor overlays before serializing
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    clone.querySelectorAll(".v0-selection-overlay, .v0-point-overlay, .v0-wireframe-style").forEach((el) => el.remove())
    clone.removeAttribute("id")
    // Clean editor-specific inline styles but preserve the overflow value as an attribute
    const currentOverflow = (svgEl as SVGSVGElement).style.overflow || (svgEl as SVGSVGElement).getAttribute("overflow") || "hidden"
    clone.removeAttribute("style")
    clone.setAttribute("overflow", currentOverflow)
    const result = new XMLSerializer().serializeToString(clone)
    console.log("[v0] serializeSvg, overflow in output:", result.includes('overflow'), "overflow value:", currentOverflow, "first 200:", result.substring(0, 200))
    return result
  }, [])

  const getSelectableElement = (target: EventTarget | null): SVGElement | null => {
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") ?? null
    return getSelectableElementFn(target, svgRoot)
  }

  // Click to select element
  const handleSvgClick = useCallback((e: React.MouseEvent) => {
    const target = getSelectableElement(e.target as EventTarget)
    if (target) {
      setSelectedElement(target)
      // Blur any focused text input so Delete/Backspace works for element deletion
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      e.stopPropagation()
    }
  }, [])

  // Mousedown to start element drag (only when not clicking on a point overlay)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Check if target is a point overlay element
    const t = e.target as Element
    if (t.classList?.contains("v0-point-overlay")) return

    const target = getSelectableElement(e.target as EventTarget)
    if (!target) return

    setSelectedElement(target)
    currentElementRef.current = target
    // Blur any focused text input so Delete/Backspace works for element deletion
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

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
  }, [])

  // Element drag effect
  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent) => {
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
    const handleUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      updateOverflowForBounds()
      const newSvg = serializeSvg()
      if (newSvg) commitChange(newSvg)
    }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp) }
  }, [isDragging, serializeSvg, commitChange, updateOverflowForBounds])

  // Point drag effect -- activated by pointDragActive state
  useEffect(() => {
    if (!pointDragActive) return
    const handleMove = (e: MouseEvent) => {
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
      const cmd = ref.commands[ref.cmdIndex]
      if (ref.isHCommand) {
        cmd.values[ref.valueIndex] = ref.origValX + dx
      } else if (ref.isVCommand) {
        cmd.values[ref.valueIndex] = ref.origValY + dy
      } else {
        cmd.values[ref.valueIndex] = ref.origValX + dx
        cmd.values[ref.valueIndex + 1] = ref.origValY + dy
      }
      ref.pathElement.setAttribute("d", serializePath(ref.commands))
    }
    const handleUp = () => {
      pointDragRef.current = null
      setPointDragActive(false)
      updateOverflowForBounds()
      const newSvg = serializeSvg()
      if (newSvg) commitChange(newSvg)
      // Bump overlay key to force redraw with updated positions
      setOverlayKey((k) => k + 1)
    }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp) }
  }, [pointDragActive, serializeSvg, commitChange, updateOverflowForBounds])

  // Draw overlays: bounding box + path points (immediately on selection)
  useEffect(() => {
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
    if (!svgRoot) return

    // Clean up all overlays
    svgRoot.querySelectorAll(".v0-selection-overlay, .v0-point-overlay").forEach((el) => el.remove())

    if (!selectedElement || !svgRoot.contains(selectedElement)) return

    const ns = "http://www.w3.org/2000/svg"

    // --- Bounding box ---
    const bbox = (selectedElement as SVGGraphicsElement).getBBox?.()
    const elemCtm = (selectedElement as SVGGraphicsElement).getCTM?.()
    const svgCtm = svgRoot.getCTM?.()
    if (bbox && elemCtm && svgCtm) {
      const transformCorner = (x: number, y: number) => {
        const p = svgRoot.createSVGPoint()
        p.x = x; p.y = y
        return p.matrixTransform(elemCtm).matrixTransform(svgCtm.inverse())
      }
      const tl = transformCorner(bbox.x, bbox.y)
      const tr = transformCorner(bbox.x + bbox.width, bbox.y)
      const bl = transformCorner(bbox.x, bbox.y + bbox.height)
      const br = transformCorner(bbox.x + bbox.width, bbox.y + bbox.height)

      const outline = document.createElementNS(ns, "polygon")
      outline.setAttribute("points", `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`)
      outline.setAttribute("fill", "none")
      outline.setAttribute("stroke", "white")
      outline.setAttribute("stroke-width", "1.5")
      outline.setAttribute("stroke-dasharray", "4 2")
      outline.setAttribute("class", "v0-selection-overlay")
      outline.style.pointerEvents = "none"
      svgRoot.appendChild(outline)
    }

    // --- Collect all editable child shapes ---
    const getAllEditableElements = (el: SVGElement): SVGElement[] => {
      const elTag = el.tagName.toLowerCase()
      const editableTags = ["path", "polygon", "polyline", "rect", "circle", "ellipse", "line"]
      if (editableTags.includes(elTag)) return [el]
      const result: SVGElement[] = []
      for (const child of Array.from(el.querySelectorAll(editableTags.join(",")))) {
        result.push(child as SVGElement)
      }
      return result
    }

    const editableEls = getAllEditableElements(selectedElement)
    if (editableEls.length === 0) return

    // Helper to create a draggable anchor point for any shape
    const createShapeAnchor = (
      x: number, y: number, transformPt: (x: number, y: number) => { x: number; y: number },
      onDrag: (dx: number, dy: number, startX: number, startY: number) => void,
      onDragEnd: () => void,
    ) => {
      const tp = transformPt(x, y)
      const rect = document.createElementNS(ns, "rect")
      rect.setAttribute("x", String(tp.x - 4))
      rect.setAttribute("y", String(tp.y - 4))
      rect.setAttribute("width", "8")
      rect.setAttribute("height", "8")
      rect.setAttribute("fill", "white")
      rect.setAttribute("stroke", "#333")
      rect.setAttribute("stroke-width", "1")
      rect.setAttribute("class", "v0-point-overlay")
      rect.style.cursor = "pointer"
      rect.style.pointerEvents = "all"

      rect.addEventListener("mousedown", (ev: Event) => {
        const me = ev as MouseEvent
        me.stopPropagation()
        me.preventDefault()
        const svgR = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
        if (!svgR) return
        const pt = svgR.createSVGPoint()
        const ctm2 = svgR.getScreenCTM()
        if (!ctm2) return
        pt.x = me.clientX; pt.y = me.clientY
        const svgP = pt.matrixTransform(ctm2.inverse())
        const startSvgX = svgP.x, startSvgY = svgP.y

        const moveHandler = (moveEv: MouseEvent) => {
          const pt2 = svgR.createSVGPoint()
          const ctm3 = svgR.getScreenCTM()
          if (!ctm3) return
          pt2.x = moveEv.clientX; pt2.y = moveEv.clientY
          const mvP = pt2.matrixTransform(ctm3.inverse())
          onDrag(mvP.x - startSvgX, mvP.y - startSvgY, startSvgX, startSvgY)
        }
        const upHandler = () => {
          window.removeEventListener("mousemove", moveHandler)
          window.removeEventListener("mouseup", upHandler)
          onDragEnd()
          updateOverflowForBounds()
          const newSvg = serializeSvg()
          if (newSvg) commitChangeRef.current(newSvg)
          setOverlayKey((k) => k + 1)
        }
        window.addEventListener("mousemove", moveHandler)
        window.addEventListener("mouseup", upHandler)
      })

      svgRoot.appendChild(rect)
    }

    for (let elIdx = 0; elIdx < editableEls.length; elIdx++) {
      const shapeEl = editableEls[elIdx]
      const tag = shapeEl.tagName.toLowerCase()

      const elCtm = (shapeEl as SVGGraphicsElement).getCTM?.()
      if (!elCtm || !svgCtm) continue
      const toRoot = svgCtm.inverse().multiply(elCtm)

      const transformPt = (x: number, y: number) => {
        const p = svgRoot.createSVGPoint()
        p.x = x; p.y = y
        const tp = p.matrixTransform(toRoot)
        return { x: tp.x, y: tp.y }
      }

      // --- Handle polygon / polyline points ---
      if (tag === "polygon" || tag === "polyline") {
        const pointsAttr = shapeEl.getAttribute("points") || ""
        const coords = pointsAttr.trim().split(/[\s,]+/).map(Number)
        for (let j = 0; j < coords.length; j += 2) {
          const origX = coords[j], origY = coords[j + 1]
          const idx = j
          createShapeAnchor(origX, origY, transformPt,
            (dx, dy) => {
              coords[idx] = origX + dx
              coords[idx + 1] = origY + dy
              const newPts = []
              for (let k = 0; k < coords.length; k += 2) {
                newPts.push(`${coords[k]},${coords[k + 1]}`)
              }
              shapeEl.setAttribute("points", newPts.join(" "))
            },
            () => { /* handled by upHandler */ }
          )
        }
        continue
      }

      // --- Handle rect corners ---
      if (tag === "rect") {
        const rx = parseFloat(shapeEl.getAttribute("x") || "0")
        const ry = parseFloat(shapeEl.getAttribute("y") || "0")
        const rw = parseFloat(shapeEl.getAttribute("width") || "0")
        const rh = parseFloat(shapeEl.getAttribute("height") || "0")
        const corners = [
          { attr: "tl" }, { attr: "tr" }, { attr: "bl" }, { attr: "br" },
        ]
        const getCorner = (c: string) => {
          const cx = parseFloat(shapeEl.getAttribute("x") || "0")
          const cy = parseFloat(shapeEl.getAttribute("y") || "0")
          const cw = parseFloat(shapeEl.getAttribute("width") || "0")
          const ch = parseFloat(shapeEl.getAttribute("height") || "0")
          switch (c) {
            case "tl": return { x: cx, y: cy }
            case "tr": return { x: cx + cw, y: cy }
            case "bl": return { x: cx, y: cy + ch }
            case "br": return { x: cx + cw, y: cy + ch }
            default: return { x: cx, y: cy }
          }
        }
        for (const corner of corners) {
          const cp = getCorner(corner.attr)
          createShapeAnchor(cp.x, cp.y, transformPt,
            (dx, dy) => {
              switch (corner.attr) {
                case "tl":
                  shapeEl.setAttribute("x", String(rx + dx))
                  shapeEl.setAttribute("y", String(ry + dy))
                  shapeEl.setAttribute("width", String(Math.max(1, rw - dx)))
                  shapeEl.setAttribute("height", String(Math.max(1, rh - dy)))
                  break
                case "tr":
                  shapeEl.setAttribute("y", String(ry + dy))
                  shapeEl.setAttribute("width", String(Math.max(1, rw + dx)))
                  shapeEl.setAttribute("height", String(Math.max(1, rh - dy)))
                  break
                case "bl":
                  shapeEl.setAttribute("x", String(rx + dx))
                  shapeEl.setAttribute("width", String(Math.max(1, rw - dx)))
                  shapeEl.setAttribute("height", String(Math.max(1, rh + dy)))
                  break
                case "br":
                  shapeEl.setAttribute("width", String(Math.max(1, rw + dx)))
                  shapeEl.setAttribute("height", String(Math.max(1, rh + dy)))
                  break
              }
            },
            () => { /* handled by upHandler */ }
          )
        }
        continue
      }

      // --- Handle circle ---
      if (tag === "circle") {
        const ccx = parseFloat(shapeEl.getAttribute("cx") || "0")
        const ccy = parseFloat(shapeEl.getAttribute("cy") || "0")
        const cr = parseFloat(shapeEl.getAttribute("r") || "0")
        // Center point
        createShapeAnchor(ccx, ccy, transformPt,
          (dx, dy) => {
            shapeEl.setAttribute("cx", String(ccx + dx))
            shapeEl.setAttribute("cy", String(ccy + dy))
          }, () => {}
        )
        // Radius handle (right edge)
        createShapeAnchor(ccx + cr, ccy, transformPt,
          (dx) => {
            shapeEl.setAttribute("r", String(Math.max(1, cr + dx)))
          }, () => {}
        )
        continue
      }

      // --- Handle ellipse ---
      if (tag === "ellipse") {
        const ecx = parseFloat(shapeEl.getAttribute("cx") || "0")
        const ecy = parseFloat(shapeEl.getAttribute("cy") || "0")
        const erx = parseFloat(shapeEl.getAttribute("rx") || "0")
        const ery = parseFloat(shapeEl.getAttribute("ry") || "0")
        // Center
        createShapeAnchor(ecx, ecy, transformPt,
          (dx, dy) => {
            shapeEl.setAttribute("cx", String(ecx + dx))
            shapeEl.setAttribute("cy", String(ecy + dy))
          }, () => {}
        )
        // Rx handle
        createShapeAnchor(ecx + erx, ecy, transformPt,
          (dx) => { shapeEl.setAttribute("rx", String(Math.max(1, erx + dx))) }, () => {}
        )
        // Ry handle
        createShapeAnchor(ecx, ecy + ery, transformPt,
          (_, dy) => { shapeEl.setAttribute("ry", String(Math.max(1, ery + dy))) }, () => {}
        )
        continue
      }

      // --- Handle line ---
      if (tag === "line") {
        const lx1 = parseFloat(shapeEl.getAttribute("x1") || "0")
        const ly1 = parseFloat(shapeEl.getAttribute("y1") || "0")
        const lx2 = parseFloat(shapeEl.getAttribute("x2") || "0")
        const ly2 = parseFloat(shapeEl.getAttribute("y2") || "0")
        createShapeAnchor(lx1, ly1, transformPt,
          (dx, dy) => {
            shapeEl.setAttribute("x1", String(lx1 + dx))
            shapeEl.setAttribute("y1", String(ly1 + dy))
          }, () => {}
        )
        createShapeAnchor(lx2, ly2, transformPt,
          (dx, dy) => {
            shapeEl.setAttribute("x2", String(lx2 + dx))
            shapeEl.setAttribute("y2", String(ly2 + dy))
          }, () => {}
        )
        continue
      }

      // --- Handle path elements (existing logic) ---
      if (tag !== "path") continue
      const pathEl = shapeEl as SVGPathElement
      const d = pathEl.getAttribute("d")
      if (!d) continue

      const commands = parsePath(d)
      const { anchors, handles } = getPointsAndHandles(commands)

      // --- Handle lines ---
      for (const h of handles) {
        const hp = transformPt(h.x, h.y)
        const ap = transformPt(h.anchorX, h.anchorY)
        const line = document.createElementNS(ns, "line")
        line.setAttribute("x1", String(ap.x))
        line.setAttribute("y1", String(ap.y))
        line.setAttribute("x2", String(hp.x))
        line.setAttribute("y2", String(hp.y))
        line.setAttribute("stroke", "#888")
        line.setAttribute("stroke-width", "0.8")
        line.setAttribute("class", "v0-point-overlay")
        line.style.pointerEvents = "none"
        svgRoot.appendChild(line)
      }

      // --- Control handle circles (black filled) ---
      for (const h of handles) {
        const hp = transformPt(h.x, h.y)
        const circle = document.createElementNS(ns, "circle")
        circle.setAttribute("cx", String(hp.x))
        circle.setAttribute("cy", String(hp.y))
        circle.setAttribute("r", "4")
        circle.setAttribute("fill", "black")
        circle.setAttribute("stroke", "#555")
        circle.setAttribute("stroke-width", "0.5")
        circle.setAttribute("class", "v0-point-overlay")
        circle.style.cursor = "pointer"
        circle.style.pointerEvents = "all"

        // Native mousedown listener -- uses ref to call React state setter
        circle.addEventListener("mousedown", (function(cmdIdx: number, valIdx: number, isAbs: boolean, pIdx: number) {
          return function(ev: Event) {
            const me = ev as MouseEvent
            me.stopPropagation()
            me.preventDefault()

            const svgR = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
            if (!svgR) return
            const pt = svgR.createSVGPoint()
            const ctm = svgR.getScreenCTM()
            if (!ctm) return
            pt.x = me.clientX; pt.y = me.clientY
            const svgP = pt.matrixTransform(ctm.inverse())

            // Re-parse the path's current d attribute
            const currentD = pathEl.getAttribute("d")
            if (!currentD) return
            const currentCmds = parsePath(currentD)
            const cmd = currentCmds[cmdIdx]
            const cmdType = cmd.type.toUpperCase()

            pointDragRef.current = {
              cmdIndex: cmdIdx,
              valueIndex: valIdx,
              startSvgX: svgP.x,
              startSvgY: svgP.y,
              origValX: cmd.values[valIdx],
              origValY: cmdType === "H" ? 0 : cmdType === "V" ? cmd.values[valIdx] : cmd.values[valIdx + 1],
              pathElement: pathEl,
              commands: JSON.parse(JSON.stringify(currentCmds)),
              isHCommand: cmdType === "H",
              isVCommand: cmdType === "V",
            }
            setPointDragActiveRef.current(true)
          }
        })(h.cmdIndex, h.valueIndex, h.isAbsolute, elIdx))

        svgRoot.appendChild(circle)
      }

      // --- Anchor points (white squares) ---
      for (const a of anchors) {
        const ap = transformPt(a.x, a.y)
        const rect = document.createElementNS(ns, "rect")
        rect.setAttribute("x", String(ap.x - 4))
        rect.setAttribute("y", String(ap.y - 4))
        rect.setAttribute("width", "8")
        rect.setAttribute("height", "8")
        rect.setAttribute("fill", "white")
        rect.setAttribute("stroke", "#333")
        rect.setAttribute("stroke-width", "1")
        rect.setAttribute("class", "v0-point-overlay")
        rect.style.cursor = "pointer"
        rect.style.pointerEvents = "all"

        // Native mousedown listener
        rect.addEventListener("mousedown", (function(cmdIdx: number, valIdx: number, isAbs: boolean, pIdx: number) {
          return function(ev: Event) {
            const me = ev as MouseEvent
            me.stopPropagation()
            me.preventDefault()

            const svgR = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
            if (!svgR) return
            const pt = svgR.createSVGPoint()
            const ctm = svgR.getScreenCTM()
            if (!ctm) return
            pt.x = me.clientX; pt.y = me.clientY
            const svgP = pt.matrixTransform(ctm.inverse())

            const currentD = pathEl.getAttribute("d")
            if (!currentD) return
            const currentCmds = parsePath(currentD)
            const cmd = currentCmds[cmdIdx]
            const cmdType = cmd.type.toUpperCase()

            pointDragRef.current = {
              cmdIndex: cmdIdx,
              valueIndex: valIdx,
              startSvgX: svgP.x,
              startSvgY: svgP.y,
              origValX: cmd.values[valIdx],
              origValY: cmdType === "H" ? 0 : cmdType === "V" ? cmd.values[valIdx] : cmd.values[valIdx + 1],
              pathElement: pathEl,
              commands: JSON.parse(JSON.stringify(currentCmds)),
              isHCommand: cmdType === "H",
              isVCommand: cmdType === "V",
            }
            setPointDragActiveRef.current(true)
          }
        })(a.cmdIndex, a.valueIndex, a.isAbsolute, elIdx))

        svgRoot.appendChild(rect)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElement, isDragging, svgCode, overlayKey])

  // Click outside to deselect
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === svgContainerRef.current) {
      setSelectedElement(null)
    }
  }, [])

  // Keyboard handling -- all through refs to avoid stale closures
  const selectedElementRef = useRef<SVGElement | null>(null)
  selectedElementRef.current = selectedElement
  const serializeSvgRef = useRef(serializeSvg)
  serializeSvgRef.current = serializeSvg
  const onSvgChangeRef = useRef(onSvgChange)
  onSvgChangeRef.current = onSvgChange

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedElement(null)
        return
      }

      // Ctrl+Z / Cmd+Z to undo
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey
      if (isUndo) {
        const activeEl = document.activeElement
        if (activeEl?.tagName === "TEXTAREA" || activeEl?.tagName === "INPUT") return
        e.preventDefault()
        e.stopPropagation()
        const prev = undoStackRef.current.pop()
        if (prev) {
          isUndoingRef.current = true
          lastSvgRef.current = prev
          onSvgChangeRef.current(prev)
          setSelectedElement(null)
        }
        return
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedElementRef.current) {
        const activeEl = document.activeElement
        if (activeEl?.tagName === "TEXTAREA" || activeEl?.tagName === "INPUT") return
        e.preventDefault()
        const el = selectedElementRef.current
        el.remove()
        setSelectedElement(null)
        const newSvg = serializeSvgRef.current()
        if (newSvg) commitChangeRef.current(newSvg)
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [])

  // Wireframe mode: hold Option/Alt to see blue outlines
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") setWireframe(true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") setWireframe(false)
    }
    // Also release on blur (e.g. user switches tabs while holding Alt)
    const handleBlur = () => setWireframe(false)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    window.addEventListener("blur", handleBlur)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
      window.removeEventListener("blur", handleBlur)
    }
  }, [])

  // Inject/remove wireframe stylesheet into the SVG
  useEffect(() => {
    const svgRoot = svgContainerRef.current?.querySelector("#editable-svg") as SVGSVGElement
    if (!svgRoot) return

    const existingStyle = svgRoot.querySelector("style.v0-wireframe-style")

    if (wireframe) {
      if (!existingStyle) {
        const ns = "http://www.w3.org/2000/svg"
        const style = document.createElementNS(ns, "style")
        style.setAttribute("class", "v0-wireframe-style")
        style.textContent = `
          #editable-svg *:not(.v0-selection-overlay):not(.v0-point-overlay):not(defs):not(defs *):not(style):not(clipPath):not(clipPath *):not(mask):not(mask *) {
            fill: none !important;
            stroke: #0D99FF !important;
            stroke-width: 1px !important;
            stroke-opacity: 1 !important;
            opacity: 1 !important;
          }
          #editable-svg defs * {
            fill: none !important;
            stroke: none !important;
          }
        `
        svgRoot.insertBefore(style, svgRoot.firstChild)
      }
    } else {
      existingStyle?.remove()
    }
  }, [wireframe])

  const handleZoom = useCallback((newZoom: number) => {
    setZoom(Math.max(10, Math.min(800, newZoom)))
  }, [])

  const handleResetView = useCallback(() => {
    setZoom(100)
    setPanOffset({ x: 0, y: 0 })
  }, [])

  // Figma-style wheel: Cmd/Ctrl+scroll = zoom, plain scroll = pan
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom (trackpad sends ctrlKey with pinch) or Cmd+scroll
        const delta = -e.deltaY
        const zoomFactor = 1 + delta * 0.01
        setZoom((prev) => Math.max(10, Math.min(800, prev * zoomFactor)))
      } else {
        // Plain two-finger scroll = pan
        setPanOffset((prev) => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }))
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => container.removeEventListener("wheel", handleWheel)
  }, [])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full rounded relative overflow-hidden flex flex-col ${checkerboard ? "" : "bg-white"}`}
      style={checkerboard ? {
        backgroundImage: "linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)",
        backgroundSize: "20px 20px",
        backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        backgroundColor: "#ffffff",
      } : undefined}
      onClick={handleContainerClick}
    >
      {/* SVG canvas */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div
          ref={svgContainerRef}
          className="w-full h-full flex items-center justify-center"
          style={{
            transform: `scale(${zoom / 100}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: "center center",
            cursor: isDragging ? "grabbing" : "default",
          }}
          onClick={handleSvgClick}
          onMouseDown={handleMouseDown}
        />
      </div>

      {/* Zoom controls - bottom bar, outside the image */}
      <div className="flex-shrink-0 flex items-center justify-center py-2 bg-black border-t border-white/10">
        <div className="flex items-center gap-0 bg-black/80 rounded border border-white/10 text-white text-xs font-mono">
          <button
            onClick={() => handleZoom(zoom - 25)}
            className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-r border-white/10"
          >
            -
          </button>
          <span className="px-3 py-1.5 min-w-[50px] text-center">{Math.round(zoom)}%</span>
          <button
            onClick={() => handleZoom(zoom + 25)}
            className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10"
          >
            +
          </button>
          <button
            onClick={handleResetView}
            className="px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10"
          >
            reset
          </button>
          <button
            onClick={() => setCheckerboard((prev) => !prev)}
            className={`px-2.5 py-1.5 hover:bg-white/10 transition-colors border-l border-white/10 ${checkerboard ? "bg-white/15" : ""}`}
            title={checkerboard ? "Switch to white background" : "Switch to checkerboard background"}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="7" height="7" fill="currentColor" fillOpacity={checkerboard ? "1" : "0.4"} />
              <rect x="7" y="7" width="7" height="7" fill="currentColor" fillOpacity={checkerboard ? "1" : "0.4"} />
              <rect x="7" y="0" width="7" height="7" fill="currentColor" fillOpacity="0.15" />
              <rect x="0" y="7" width="7" height="7" fill="currentColor" fillOpacity="0.15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
