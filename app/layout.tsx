import type React from "react"
import type { Metadata } from "next"
import { Suspense } from "react"
import { Analytics } from "@vercel/analytics/react"
import { ErrorBoundary } from "@/components/error-boundary"
import "./globals.css"

export const metadata: Metadata = {
  title: "SVG Creator - Text & Image to SVG with Gemini 3.1",
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
    title: "SVG Creator - Text & Image to SVG with Gemini 3.1",
    description:
      "Transform your text descriptions and images into high-quality SVG files using Google's Gemini 3.1 AI.",
    siteName: "SVG Creator",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SVG Creator - AI-Powered Vector Graphics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SVG Creator - Text & Image to SVG with Gemini 3.1",
    description:
      "Transform your text descriptions and images into high-quality SVG files using Google's Gemini 3.1 AI.",
    creator: "@vercel",
    images: ["/og-image.jpg"],
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
  themeColor: "#F5F5F5",
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
      style={{ backgroundColor: "#F5F5F5" }}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased" style={{ backgroundColor: "#F5F5F5", fontFamily: "'Google Sans', sans-serif" }}>
        <ErrorBoundary>
          <Suspense fallback={null}>{children}</Suspense>
        </ErrorBoundary>
        <Analytics />
      </body>
    </html>
  )
}
