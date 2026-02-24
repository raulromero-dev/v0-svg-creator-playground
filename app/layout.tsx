import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { ErrorBoundary } from "@/components/error-boundary"
import { AuthProvider } from "@/components/image-combiner/auth-context"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SVG Generator - Text & Image to SVG with Gemini 3.1",
  description:
    "Transform your text descriptions and images into high-quality SVG files using Google's Gemini 3.1 AI. Create, edit, and export scalable vector graphics instantly.",
  keywords: [
    "SVG creator",
    "text to SVG",
    "image to SVG",
    "Gemini 3.1",
    "AI SVG generator",
    "vector graphics",
    "Google AI",
    "SVG editor",
    "AI vector graphics",
    "Vercel AI Gateway",
  ],
  authors: [{ name: "v0" }],
  creator: "v0",
  publisher: "v0",
  generator: "v0.app",
  metadataBase: new URL("https://svg-creator.vercel.app"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://svg-creator.vercel.app",
    title: "SVG Generator - Text & Image to SVG with Gemini 3.1",
    description:
      "Transform your text descriptions and images into high-quality SVG files using Google's Gemini 3.1 AI.",
    siteName: "SVG Generator",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SVG Generator - AI-Powered Vector Graphics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SVG Generator - Text & Image to SVG with Gemini 3.1",
    description:
      "Transform your text descriptions and images into high-quality SVG files using Google's Gemini 3.1 AI.",
    creator: "@vercel",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
}

export const viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={{ backgroundColor: "#0A0A0A" }}
    >
      <body className={`${geistSans.className} font-sans antialiased`} style={{ backgroundColor: "#0A0A0A" }}>
        <AuthProvider>
          <ErrorBoundary>
            <Suspense fallback={null}>{children}</Suspense>
          </ErrorBoundary>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
