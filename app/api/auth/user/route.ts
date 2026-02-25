import { cookies } from "next/headers"
import { fetchVercelApi, getCredits } from "@/lib/ai-gateway"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value

  if (!token) {
    return Response.json({ user: null })
  }

  try {
    // Fetch user info from OAuth userinfo endpoint
    const userInfoResult = await fetch("https://api.vercel.com/login/oauth/userinfo", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })

    console.log("[v0] userinfo status:", userInfoResult.status)

    if (userInfoResult.status !== 200) {
      return Response.json({ user: null })
    }

    const userInfo = await userInfoResult.json()
    console.log("[v0] userInfo all keys:", JSON.stringify(Object.keys(userInfo)))
    console.log("[v0] userInfo:", JSON.stringify({ name: userInfo.name, email: userInfo.email, teamId: userInfo.teamId, sub: userInfo.sub }))

    // Get teamId: prefer userinfo.teamId, fall back to user_id cookie with team_ prefix
    const rawUserId = cookieStore.get("user_id")?.value
    const teamId = userInfo.teamId || (rawUserId ? `team_${rawUserId}` : null)
    console.log("[v0] rawUserId from cookie:", rawUserId)
    console.log("[v0] teamId (resolved):", teamId)

    // Exchange access token for AI Gateway key if we don't have one yet
    let aiGatewayKey = cookieStore.get("ai_gateway_key")?.value
    console.log("[v0] existing ai_gateway_key:", !!aiGatewayKey)

    if (!aiGatewayKey && teamId) {
      // Try both tokens - refresh_token may have broader API access than access_token
      const refreshToken = cookieStore.get("refresh_token")?.value
      const tokensToTry = [
        ...(refreshToken ? [{ value: refreshToken, type: "refresh_token" }] : []),
        { value: token, type: "access_token" },
      ]

      for (const t of tokensToTry) {
        try {
          console.log("[v0] Exchanging token for AI Gateway key using:", t.type)
          console.log("[v0] Token prefix:", t.value.substring(0, 10) + "...")
          console.log("[v0] Token length:", t.value.length)
          const data = await fetchVercelApi<{ bearerToken?: string; token?: string }>(
            `/api-keys?teamId=${teamId}`,
            t.value,
          {
            method: "POST",
            body: JSON.stringify({
              purpose: "ai-gateway",
              name: "AI Wallet API Key",
              exchange: true,
            }),
          }
        )
          console.log("[v0] Key exchange SUCCESS with:", t.type, "keys:", Object.keys(data))
          aiGatewayKey = data.bearerToken || data.token
          if (aiGatewayKey) {
            cookieStore.set("ai_gateway_key", aiGatewayKey, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 30,
              path: "/",
            })
          }
          break // success, stop trying
        } catch (err) {
          console.error(`[v0] Failed with ${t.type}:`, err instanceof Error ? err.message : err)
        }
      }
    }

    // Fetch balance using the AI Gateway helper
    let balance: string | null = null
    console.log("[v0] aiGatewayKey available for balance:", !!aiGatewayKey)
    if (aiGatewayKey) {
      try {
        const credits = await getCredits(aiGatewayKey)
        console.log("[v0] credits response:", JSON.stringify(credits))
        balance = credits.balance
      } catch (err) {
        console.error("[v0] Failed to fetch balance:", err)
      }
    }

    return Response.json({
      user: {
        name: userInfo.name,
        email: userInfo.email,
        username: userInfo.preferred_username,
        picture: userInfo.picture,
        teamId,
        balance,
      },
    })
  } catch (err) {
    console.error("[v0] User route error:", err)
    return Response.json({ user: null })
  }
}
