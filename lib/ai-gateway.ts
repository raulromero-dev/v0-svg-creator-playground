export class AiGatewayError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AiGatewayError"
    this.status = status
  }
}

export async function fetchAiGateway<T>(endpoint: string, apiKey: string): Promise<T> {
  const response = await fetch(`https://ai-gateway.vercel.sh${endpoint}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  })

  if (!response.ok) {
    throw new AiGatewayError(
      `Failed to fetch AI Gateway API: ${response.status} ${response.statusText}`,
      response.status
    )
  }

  return response.json() as T
}

export async function getCredits(apiKey: string) {
  const response = await fetchAiGateway<{ balance: string; total_used: string }>("/v1/credits", apiKey)
  return response
}

export async function fetchVercelApi<T>(
  endpoint: string,
  accessToken: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`https://api.vercel.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Vercel API error ${response.status}: ${text}`)
  }

  return response.json() as T
}
