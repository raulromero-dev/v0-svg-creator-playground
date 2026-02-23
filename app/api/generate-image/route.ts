import { type NextRequest, NextResponse } from "next/server"
import { streamText } from "ai"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const MAX_PROMPT_LENGTH = 5000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]

interface GenerateImageResponse {
  svgCode: string
  prompt: string
  description?: string
}

interface ErrorResponse {
  error: string
  message?: string
  details?: string
}

const SVG_SYSTEM_PROMPT = `You are an expert SVG graphic designer. Your task is to generate clean, professional SVG code based on user descriptions or reference images.

IMPORTANT RULES:
- Output ONLY valid SVG code. No markdown, no code fences, no explanations before or after.
- Start with <svg and end with </svg>
- Use a viewBox attribute for scalability (e.g., viewBox="0 0 800 600")
- Use clean, well-structured paths and shapes
- Prefer simple geometric shapes (rect, circle, ellipse, polygon, path) over complex paths when possible
- Use descriptive fill colors (hex values)
- Keep the SVG optimized - no unnecessary attributes or empty groups
- Make designs visually appealing with good use of color, spacing, and composition
- Do NOT include any text outside the SVG tags
- Do NOT wrap in code blocks or markdown`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const mode = formData.get("mode") as string
    const prompt = formData.get("prompt") as string

    if (!mode) {
      return NextResponse.json<ErrorResponse>({ error: "Mode is required" }, { status: 400 })
    }

    if (!prompt?.trim()) {
      return NextResponse.json<ErrorResponse>({ error: "Prompt is required" }, { status: 400 })
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json<ErrorResponse>(
        { error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters allowed.` },
        { status: 400 },
      )
    }

    // Uses Vercel AI Gateway -- zero-config, no API key needed
    const model = "google/gemini-3.1-pro-preview"

    if (mode === "text-to-image") {
      const svgPrompt = `Generate an SVG graphic based on this description: ${prompt}`

      console.log("[v0] === TEXT-TO-SVG REQUEST ===")
      console.log("[v0] Mode:", mode)
      console.log("[v0] User prompt:", prompt)
      console.log("[v0] Full prompt sent to model:", svgPrompt)
      console.log("[v0] Model:", "google/gemini-3.1-pro-preview")
      console.log("[v0] System prompt length:", SVG_SYSTEM_PROMPT.length, "chars")

      const result = streamText({
        model,
        system: SVG_SYSTEM_PROMPT,
        prompt: svgPrompt,
        providerOptions: {
          google: {
            thinking_level: "medium",
          },
        },
      })

      // Collect the full streamed text
      let fullText = ""
      let chunkCount = 0
      for await (const chunk of result.textStream) {
        fullText += chunk
        chunkCount++
      }

      console.log("[v0] === TEXT-TO-SVG RESPONSE ===")
      console.log("[v0] Total chunks received:", chunkCount)
      console.log("[v0] Raw response length:", fullText.length, "chars")
      console.log("[v0] Raw response (first 500 chars):", fullText.substring(0, 500))

      // Extract SVG from response
      const svgCode = extractSvg(fullText)

      console.log("[v0] SVG extracted:", svgCode ? `Yes (${svgCode.length} chars)` : "No")
      if (svgCode) {
        console.log("[v0] SVG preview (first 300 chars):", svgCode.substring(0, 300))
      } else {
        console.log("[v0] Full raw response for debugging:", fullText)
      }

      if (!svgCode) {
        return NextResponse.json<ErrorResponse>(
          { error: "No SVG generated", details: "The model did not return valid SVG code. Raw response: " + fullText.substring(0, 200) },
          { status: 500 },
        )
      }

      return NextResponse.json<GenerateImageResponse>({
        svgCode,
        prompt: prompt,
        description: "",
      })
    } else if (mode === "image-editing") {
      const image1 = formData.get("image1") as File
      const image2 = formData.get("image2") as File
      const image1Url = formData.get("image1Url") as string
      const image2Url = formData.get("image2Url") as string

      const hasImage1 = image1 || image1Url
      const hasImage2 = image2 || image2Url

      if (!hasImage1) {
        return NextResponse.json<ErrorResponse>(
          { error: "At least one image is required for editing mode" },
          { status: 400 },
        )
      }

      if (image1) {
        if (image1.size > MAX_FILE_SIZE) {
          return NextResponse.json<ErrorResponse>(
            { error: `Image 1 too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB allowed.` },
            { status: 400 },
          )
        }
        if (!ALLOWED_IMAGE_TYPES.includes(image1.type)) {
          return NextResponse.json<ErrorResponse>(
            { error: "Image 1 has invalid format. Allowed: JPEG, PNG, WebP, GIF, SVG" },
            { status: 400 },
          )
        }
      }

      if (image2) {
        if (image2.size > MAX_FILE_SIZE) {
          return NextResponse.json<ErrorResponse>(
            { error: `Image 2 too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB allowed.` },
            { status: 400 },
          )
        }
        if (!ALLOWED_IMAGE_TYPES.includes(image2.type)) {
          return NextResponse.json<ErrorResponse>(
            { error: "Image 2 has invalid format. Allowed: JPEG, PNG, WebP, GIF, SVG" },
            { status: 400 },
          )
        }
      }

      const convertToDataUrl = async (source: File | string): Promise<string> => {
        if (typeof source === "string") {
          const response = await fetch(source)
          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const base64 = buffer.toString("base64")
          const contentType = response.headers.get("content-type") || "image/jpeg"
          return `data:${contentType};base64,${base64}`
        } else {
          const arrayBuffer = await source.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          const base64 = buffer.toString("base64")
          return `data:${source.type};base64,${base64}`
        }
      }

      // Helper to check if a file is SVG
      const isSvgFile = (file: File | null) => file && (file.type === "image/svg+xml" || file.name?.endsWith(".svg"))

      // Helper to read SVG file as text
      const readSvgAsText = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer()
        return new TextDecoder().decode(arrayBuffer)
      }

      const messageParts: Array<{ type: "text" | "image"; text?: string; image?: string }> = []

      // For SVG files, include the SVG code as text; for raster images, include as base64
      if (image1 && isSvgFile(image1)) {
        const svgText = await readSvgAsText(image1)
        messageParts.push({ type: "text", text: `Here is the reference SVG code for image 1:\n\n${svgText}` })
      } else {
        const image1DataUrl = await convertToDataUrl(hasImage1 ? image1 || image1Url : "")
        messageParts.push({ type: "image", image: image1DataUrl })
      }

      if (hasImage2) {
        if (image2 && isSvgFile(image2)) {
          const svgText = await readSvgAsText(image2)
          messageParts.push({ type: "text", text: `Here is the reference SVG code for image 2:\n\n${svgText}` })
        } else {
          const image2DataUrl = await convertToDataUrl(image2 || image2Url)
          messageParts.push({ type: "image", image: image2DataUrl })
        }
      }

      const editingPrompt = hasImage2
        ? `${prompt}. Convert and combine these two inputs into a clean SVG graphic with vector-friendly elements, following the instructions.`
        : `${prompt}. Use this input as a reference and generate a new SVG graphic with simplified, vector-friendly elements based on the instructions.`

      messageParts.push({ type: "text", text: editingPrompt })

      console.log("[v0] === IMAGE-TO-SVG REQUEST ===")
      console.log("[v0] Mode:", mode)
      console.log("[v0] User prompt:", prompt)
      console.log("[v0] Editing prompt sent:", editingPrompt)
      console.log("[v0] Has image1:", !!hasImage1, "Has image2:", !!hasImage2)
      console.log("[v0] Message parts count:", messageParts.length)
      console.log("[v0] Model:", "google/gemini-3.1-pro-preview")

      const result = streamText({
        model,
        system: SVG_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            // @ts-ignore - Type issue with content parts
            content: messageParts,
          },
        ],
        providerOptions: {
          google: {
            thinking_level: "medium",
          },
        },
      })

      // Collect the full streamed text
      let fullText = ""
      let chunkCount = 0
      for await (const chunk of result.textStream) {
        fullText += chunk
        chunkCount++
      }

      console.log("[v0] === IMAGE-TO-SVG RESPONSE ===")
      console.log("[v0] Total chunks received:", chunkCount)
      console.log("[v0] Raw response length:", fullText.length, "chars")
      console.log("[v0] Raw response (first 500 chars):", fullText.substring(0, 500))

      // Extract SVG from response
      const svgCode = extractSvg(fullText)

      console.log("[v0] SVG extracted:", svgCode ? `Yes (${svgCode.length} chars)` : "No")
      if (!svgCode) {
        console.log("[v0] Full raw response for debugging:", fullText)
      }

      if (!svgCode) {
        return NextResponse.json<ErrorResponse>(
          { error: "No SVG generated", details: "The model did not return valid SVG code. Raw response: " + fullText.substring(0, 200) },
          { status: 500 },
        )
      }

      return NextResponse.json<GenerateImageResponse>({
        svgCode,
        prompt: editingPrompt,
        description: "",
      })
    } else {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid mode", details: "Mode must be 'text-to-image' or 'image-editing'" },
        { status: 400 },
      )
    }
  } catch (error) {
    console.error("Error in generate-image route:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

    return NextResponse.json<ErrorResponse>(
      {
        error: "Failed to generate SVG",
        details: errorMessage,
      },
      { status: 500 },
    )
  }
}

function extractSvg(text: string): string | null {
  // Try to extract SVG from the response text
  // First, try to find <svg...>...</svg> pattern
  const svgMatch = text.match(/<svg[\s\S]*?<\/svg>/i)
  if (svgMatch) {
    return svgMatch[0]
  }

  // Try removing markdown code fences if present
  const codeBlockMatch = text.match(/```(?:svg|xml|html)?\s*\n?([\s\S]*?)```/i)
  if (codeBlockMatch) {
    const inner = codeBlockMatch[1].trim()
    const innerSvgMatch = inner.match(/<svg[\s\S]*?<\/svg>/i)
    if (innerSvgMatch) {
      return innerSvgMatch[0]
    }
  }

  return null
}
