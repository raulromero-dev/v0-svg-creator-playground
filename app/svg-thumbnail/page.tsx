import type { Metadata } from "next"
import { SvgThumbnail } from "./svg-thumbnail"

export const metadata: Metadata = {
  title: "SVG Generator - Thumbnail",
}

export default function ThumbnailPage() {
  return <SvgThumbnail />
}
