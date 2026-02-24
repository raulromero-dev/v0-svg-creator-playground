import type { NextRequest } from "next/server"
import { cookies } from "next/headers"

interface TokenData {
  access_token: string
  token_type: string
  id_token: string
  expires_in: number
  scope: string
  refresh_token: string
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    console.log("[v0] Callback hit. Origin:", request.nextUrl.origin, "Full URL:", request.url)

    if (!code) {
      throw new Error("Authorization code is required")
    }

    const storedState = request.cookies.get("oauth_state")?.value
    const storedNonce = request.cookies.get("oauth_nonce")?.value
    const codeVerifier = request.cookies.get("oauth_code_verifier")?.value

    console.log("[v0] Cookies - state exists:", !!storedState, "nonce exists:", !!storedNonce, "verifier exists:", !!codeVerifier)
    console.log("[v0] State match:", state === storedState)

    if (!validate(state, storedState)) {
      throw new Error(`State mismatch - received: ${state?.substring(0, 8)}... stored: ${storedState?.substring(0, 8)}...`)
    }

    console.log("[v0] Exchanging code for token with origin:", request.nextUrl.origin)
    const tokenData = await exchangeCodeForToken(code, codeVerifier, request.nextUrl.origin)
    console.log("[v0] Token exchange successful, has id_token:", !!tokenData.id_token)
    
    const decodedNonce = decodeNonce(tokenData.id_token)
    console.log("[v0] Nonce match:", decodedNonce === storedNonce)

    if (!validate(decodedNonce, storedNonce)) {
      throw new Error("Nonce mismatch")
    }

    await setAuthCookies(tokenData)

    const cookieStore = await cookies()
    cookieStore.set("oauth_state", "", { maxAge: 0 })
    cookieStore.set("oauth_nonce", "", { maxAge: 0 })
    cookieStore.set("oauth_code_verifier", "", { maxAge: 0 })

    // Redirect back to the main app page
    return Response.redirect(new URL("/", request.url))
  } catch (error) {
    console.error("[v0] OAuth callback error:", error instanceof Error ? error.message : error)
    console.error("[v0] Full error:", error)
    return Response.redirect(new URL("/?auth_error=true", request.url))
  }
}

function validate(value: string | null, storedValue: string | undefined): boolean {
  if (!value || !storedValue) {
    return false
  }
  return value === storedValue
}

function decodeNonce(idToken: string): string {
  const payload = idToken.split(".")[1]
  const decodedPayload = Buffer.from(payload, "base64").toString("utf-8")
  const nonceMatch = decodedPayload.match(/"nonce":"([^"]+)"/)
  return nonceMatch ? nonceMatch[1] : ""
}

async function exchangeCodeForToken(
  code: string,
  code_verifier: string | undefined,
  requestOrigin: string
): Promise<TokenData> {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID as string,
    client_secret: process.env.VERCEL_APP_CLIENT_SECRET as string,
    code: code,
    code_verifier: code_verifier || "",
    redirect_uri: `${requestOrigin}/api/auth/callback`,
  })

  const response = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    body: params,
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Failed to exchange code for token: ${JSON.stringify(errorData)}`)
  }

  return await response.json()
}

async function setAuthCookies(tokenData: TokenData) {
  const cookieStore = await cookies()

  cookieStore.set("access_token", tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: tokenData.expires_in,
  })

  cookieStore.set("refresh_token", tokenData.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  })
}
