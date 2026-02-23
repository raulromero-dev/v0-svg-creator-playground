const SKIP_TAGS = ["defs", "style", "metadata", "title", "desc", "clippath", "lineargradient", "radialgradient", "stop"]
const SHAPE_TAGS = ["path", "rect", "circle", "ellipse", "line", "polygon", "polyline", "text", "image", "use"]

export function getSelectableElement(
  target: EventTarget | null,
  svgRoot: Element | null,
): SVGElement | null {
  if (!target || !(target instanceof SVGElement)) return null
  if (!svgRoot) return null

  // Skip overlay elements
  if (
    (target as Element).classList?.contains("v0-selection-overlay") ||
    (target as Element).classList?.contains("v0-point-overlay")
  )
    return null

  const tag = target.tagName.toLowerCase()

  if (tag === "svg" && target === svgRoot) return null
  if (SKIP_TAGS.includes(tag)) return null

  // Always prefer the deepest shape element the user clicked on
  if (SHAPE_TAGS.includes(tag)) return target

  // Walk up from non-shape elements to find nearest individual shape
  let walker: SVGElement | null = target
  while (walker && walker !== svgRoot) {
    const wTag = walker.tagName.toLowerCase()
    if (SKIP_TAGS.includes(wTag)) return null
    if (SHAPE_TAGS.includes(wTag)) return walker
    // Only select a <g> if it is a direct child of the SVG root (top-level group)
    if (wTag === "g" && walker.parentElement === svgRoot) return walker
    if (walker.parentElement instanceof SVGElement) {
      walker = walker.parentElement as SVGElement
    } else {
      return null
    }
  }
  return null
}
