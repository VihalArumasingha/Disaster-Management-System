import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import CitizenDashboard from './CitizenDashboard'
import MobileAuthPage from './MobileAuthPage'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/login" element={<MobileAuthPage mode="login" />} />
                    <Route path="/register" element={<MobileAuthPage mode="register" />} />
                    <Route path="/dashboard" element={<CitizenDashboard />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App