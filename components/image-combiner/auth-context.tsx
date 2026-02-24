"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

interface User {
  name: string
  email: string
  username: string
  picture: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/user")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user ?? null)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
