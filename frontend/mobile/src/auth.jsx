import { useEffect, useState } from 'react'
import { AuthContext } from './authContext'
import {
    getCurrentUser,
    login as loginRequest,
    logout as logoutRequest,
    register as registerRequest
} from './services/authApi'

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        let active = true

        getCurrentUser()
            .then(({ user: currentUser }) => {
                if (active) setUser(currentUser)
            })
            .catch((error) => {
                if (!active) return
                setUser(null)
                if (error.response?.status !== 401) {
                    setLoadError('Could not verify your saved session. Try signing in again.')
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })

        return () => {
            active = false
        }
    }, [])

    const signIn = async (credentials) => {
        const response = await loginRequest(credentials)
        setUser(response.user)
        return response.user
    }

    const signUp = (userData) => registerRequest(userData)

    const signOut = async () => {
        await logoutRequest()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, loadError, signIn, signUp, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}
