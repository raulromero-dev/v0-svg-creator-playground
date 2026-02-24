"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"

interface User {
  name: string
  email: string
  username: string
  picture: string
  teamId: string | null
  balance: string | null
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  balance: string | null
  refreshBalance: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  balance: null,
  refreshBalance: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/user")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user ?? null)
        if (data.user?.balance != null) {
          setBalance(data.user.balance)
        }
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/balance")
      const data = await res.json()
      if (data.balance != null) {
        setBalance(data.balance)
      }
    } catch {
      // Silently fail
    }
  }, [])

  const signOut = useCallback(async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    setUser(null)
    setBalance(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, balance, refreshBalance, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
