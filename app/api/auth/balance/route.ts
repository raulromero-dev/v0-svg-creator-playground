import { cookies } from "next/headers"
import { getCredits, AiGatewayError } from "@/lib/ai-gateway"

export async function GET() {
  const cookieStore = await cookies()
  const aiGatewayKey = cookieStore.get("ai_gateway_key")?.value

  if (!aiGatewayKey) {
    return Response.json({ balance: null, error: "Not authenticated" }, { status: 401 })
  }

  try {
    const credits = await getCredits(aiGatewayKey)
    return Response.json({ balance: credits.balance, total_used: credits.total_used })
  } catch (err) {
    if (err instanceof AiGatewayError) {
      console.error("AI Gateway error fetching balance:", err.message, "status:", err.status)
      return Response.json({ balance: null, error: err.message }, { status: err.status })
    }
    console.error("Failed to fetch balance:", err)
    return Response.json({ balance: null, error: "Failed to fetch balance" }, { status: 500 })
  }
}
