import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import CitizenDashboard from './CitizenDashboard'
import MobileAuthPage from './MobileAuthPage'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<MobileAuthPage mode="login" />} />
                    <Route path="/register" element={<MobileAuthPage mode="register" />} />
                    <Route path="/dashboard" element={<CitizenDashboard />} />
                    <Route path="/map" element={<CitizenDashboard />} />
                    <Route path="/report" element={<CitizenDashboard />} />
                    <Route path="/alerts" element={<CitizenDashboard />} />
                    <Route path="/profile" element={<CitizenDashboard />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App