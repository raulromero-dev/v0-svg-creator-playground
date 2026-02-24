import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const aiGatewayKey = cookieStore.get("ai_gateway_key")?.value

  if (!aiGatewayKey) {
    return Response.json({ balance: null, error: "Not authenticated" }, { status: 401 })
  }

  try {
    const response = await fetch("https://ai-gateway.vercel.sh/v1/credits", {
      headers: {
        Authorization: `Bearer ${aiGatewayKey}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`AI Gateway error: ${response.status}`)
    }

    const data = await response.json() as { balance: string; total_used: string }
    return Response.json({ balance: data.balance, total_used: data.total_used })
  } catch (err) {
    console.error("[v0] Failed to fetch balance:", err)
    return Response.json({ balance: null, error: "Failed to fetch balance" }, { status: 500 })
  }
}
