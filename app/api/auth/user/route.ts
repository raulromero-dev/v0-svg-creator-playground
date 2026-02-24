import { cookies } from "next/headers"

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get("access_token")?.value

  if (!token) {
    return Response.json({ user: null })
  }

  try {
    const result = await fetch("https://api.vercel.com/login/oauth/userinfo", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (result.status !== 200) {
      return Response.json({ user: null })
    }

    const user = await result.json()
    return Response.json({
      user: {
        name: user.name,
        email: user.email,
        username: user.preferred_username,
        picture: user.picture,
      },
    })
  } catch {
    return Response.json({ user: null })
  }
}
