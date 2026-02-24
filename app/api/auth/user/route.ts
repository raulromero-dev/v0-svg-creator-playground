import { cookies } from "next/headers"

async function fetchAiGateway<T>(endpoint: string, apiKey: string): Promise<T> {
  const response = await fetch(`https://ai-gateway.vercel.sh${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new Error(`AI Gateway error: ${response.status} ${response.statusText}`)
  }

  return response.json() as T
}

async function exchangeForAiGatewayKey(accessToken: string, teamId: string): Promise<string> {
  const response = await fetch(`https://api.vercel.com/v2/api-keys?teamId=${teamId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      purpose: "ai-gateway",
      name: "SVG Generator Key",
      exchange: true,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to exchange token: ${response.status} ${text}`)
  }

  const data = await response.json()
  // The exchange endpoint returns the bearer token directly
  return data.bearerToken || data.token || data.apiKey
}

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value

  if (!token) {
    return Response.json({ user: null })
  }

  try {
    // Fetch user info
    const result = await fetch("https://api.vercel.com/login/oauth/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (result.status !== 200) {
      return Response.json({ user: null })
    }

    const userInfo = await result.json()

    // Fetch full user profile to get teamId
    const profileResult = await fetch("https://api.vercel.com/v2/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    let teamId: string | null = null
    let teamSlug: string | null = null
    if (profileResult.ok) {
      const profileData = await profileResult.json()
      console.log("[v0] /v2/user response keys:", Object.keys(profileData.user || {}))
      console.log("[v0] defaultTeamId:", profileData.user?.defaultTeamId, "username:", profileData.user?.username, "id:", profileData.user?.id)
      teamId = profileData.user?.defaultTeamId || profileData.user?.id || null

      // Fetch team slug for building dashboard URLs
      if (teamId) {
        try {
          const teamResult = await fetch(`https://api.vercel.com/v2/teams/${teamId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          console.log("[v0] /v2/teams/${teamId} status:", teamResult.status)
          if (teamResult.ok) {
            const teamData = await teamResult.json()
            console.log("[v0] team data keys:", Object.keys(teamData), "slug:", teamData.slug, "name:", teamData.name)
            teamSlug = teamData.slug || null
          } else {
            const errText = await teamResult.text()
            console.log("[v0] team fetch error:", errText)
          }
        } catch (err) {
          console.log("[v0] team fetch exception:", err)
        }
      }
    }

    // Exchange for AI Gateway key if we don't have one yet
    let aiGatewayKey = cookieStore.get("ai_gateway_key")?.value
    if (!aiGatewayKey && teamId) {
      try {
        aiGatewayKey = await exchangeForAiGatewayKey(token, teamId)
        // Store the key in a cookie for future requests
        cookieStore.set("ai_gateway_key", aiGatewayKey, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        })
      } catch (err) {
        console.error("[v0] Failed to exchange for AI Gateway key:", err)
      }
    }

    // Fetch balance if we have an AI Gateway key
    let balance: string | null = null
    if (aiGatewayKey) {
      try {
        const credits = await fetchAiGateway<{ balance: string; total_used: string }>("/v1/credits", aiGatewayKey)
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
        teamSlug,
        balance,
      },
    })
  } catch {
    return Response.json({ user: null })
  }
}
