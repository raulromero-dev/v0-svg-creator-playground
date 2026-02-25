import { type NextRequest, NextResponse } from "next/server"
import { streamText, createGateway } from "ai"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const maxDuration = 450

const MAX_PROMPT_LENGTH = 5000
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]

interface ErrorResponse {
  error: string
  message?: string
  details?: string
}

// Map aspect ratio values to viewBox dimensions
const ASPECT_RATIO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "square": { width: 800, height: 800 },
  "portrait": { width: 450, height: 800 },
  "landscape": { width: 800, height: 450 },
  "wide": { width: 800, height: 343 },
  "4:3": { width: 800, height: 600 },
  "3:2": { width: 800, height: 533 },
  "2:3": { width: 533, height: 800 },
  "3:4": { width: 600, height: 800 },
  "5:4": { width: 800, height: 640 },
  "4:5": { width: 640, height: 800 },
}

function buildSystemPrompt(aspectRatio: string): string {
  const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS["square"]
  return `You are an expert SVG graphic designer. Your task is to generate clean, professional SVG code based on user descriptions or reference images.

IMPORTANT RULES:
- Output ONLY valid SVG code. No markdown, no code fences, no explanations before or after.
- Start with <svg and end with </svg>
- You MUST use this exact viewBox: viewBox="0 0 ${dims.width} ${dims.height}" — the aspect ratio is ${aspectRatio} (${dims.width}x${dims.height})
- Fill the entire viewBox with your design. Do not leave large empty margins.
- Use clean, well-structured paths and shapes
- Prefer simple geometric shapes (rect, circle, ellipse, polygon, path) over complex paths when possible
- Use descriptive fill colors (hex values)
- Keep the SVG optimized - no unnecessary attributes or empty groups
- Make designs visually appealing with good use of color, spacing, and composition
- Do NOT include any text outside the SVG tags
- Do NOT wrap in code blocks or markdown`
}

export async function POST(request: NextRequest) {
  try {
    // Require user's AI Gateway key for generation
    const cookieStore = await cookies()
    const aiGatewayKey = cookieStore.get("ai_gateway_key")?.value

    if (!aiGatewayKey) {
      return NextResponse.json<ErrorResponse>(
        { error: "Authentication required", message: "Please sign in to generate SVGs" },
        { status: 401 },
      )
    }

    const formData = await request.formData()
    const mode = formData.get("mode") as string
    const prompt = formData.get("prompt") as string
    const aspectRatio = (formData.get("aspectRatio") as string) || "square"
    const systemPrompt = buildSystemPrompt(aspectRatio)
    const dims = ASPECT_RATIO_DIMENSIONS[aspectRatio] || ASPECT_RATIO_DIMENSIONS["square"]

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

    // Use the user's AI Gateway key to route through their wallet
    const gateway = createGateway({ apiKey: aiGatewayKey })
    const model = gateway("google/gemini-3.1-pro-preview")

    if (mode === "text-to-image") {
      const svgPrompt = `Generate an SVG graphic with viewBox="0 0 ${dims.width} ${dims.height}" (aspect ratio: ${aspectRatio}) based on this description: ${prompt}`

      console.log("[v0] TEXT-TO-SVG | aspect:", aspectRatio, `(${dims.width}x${dims.height})`, "| prompt:", prompt.substring(0, 100))

      const result = streamText({
        model,
        system: systemPrompt,
        prompt: svgPrompt,
        providerOptions: {
          google: {
            thinking_level: "medium",
          },
        },
      })

      // Stream the text back to the client to avoid 504 timeouts
      return createStreamingResponse(result.textStream)

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

      const isSvgFile = (file: File | null) => file && (file.type === "image/svg+xml" || file.name?.endsWith(".svg"))

      const readSvgAsText = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer()
        return new TextDecoder().decode(arrayBuffer)
      }

      const messageParts: Array<{ type: "text" | "image"; text?: string; image?: string }> = []

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
        ? `${prompt}. Convert and combine these two inputs into a clean SVG graphic with viewBox="0 0 ${dims.width} ${dims.height}" (aspect ratio: ${aspectRatio}) with vector-friendly elements, following the instructions.`
        : `${prompt}. Use this input as a reference and generate a new SVG graphic with viewBox="0 0 ${dims.width} ${dims.height}" (aspect ratio: ${aspectRatio}) with simplified, vector-friendly elements based on the instructions.`

      messageParts.push({ type: "text", text: editingPrompt })

      console.log("[v0] IMAGE-TO-SVG | aspect:", aspectRatio, "| images:", !!hasImage1, !!hasImage2, "| prompt:", prompt.substring(0, 100))

      const result = streamText({
        model,
        system: systemPrompt,
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

      // Stream the text back to the client to avoid 504 timeouts
      return createStreamingResponse(result.textStream)

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

/**
 * Creates a streaming response that sends text chunks as they arrive from the model.
 * This prevents 504 Gateway Timeouts on Vercel by keeping the connection alive.
 * The client reads the stream, accumulates text, and extracts the SVG when done.
 */
function createStreamingResponse(textStream: AsyncIterable<string>) {
  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          // Send each chunk as an SSE-style event
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
        }
        // Signal end of stream
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      } catch (error) {
        console.error("[v0] Stream error:", error)
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
