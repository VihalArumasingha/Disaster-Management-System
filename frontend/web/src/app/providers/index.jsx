import { useEffect, useState } from 'react'
import { AuthContext } from '../../auth/hooks'
import {
    getCurrentUser,
    login as loginRequest,
    logout as logoutRequest,
    register as registerRequest
} from '../../auth/services/authApi'

function AppProviders({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        let active = true

        getCurrentUser()
            .then((response) => {
                if (active) setUser(response.user)
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

    const login = async (credentials) => {
        const response = await loginRequest({
            ...credentials,
            client: 'web'
        })
        setUser(response.user)
        return response.user
    }

    const register = (userData) => registerRequest(userData)

    const logout = async () => {
        await logoutRequest()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, loadError, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export default AppProviders