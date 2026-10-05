import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import CitizenDashboard from './CitizenDashboard'
import MobileAuthPage from './MobileAuthPage'
import LocationTest from './pages/LocationTest'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/login" element={<MobileAuthPage mode="login" />} />
                    <Route path="/register" element={<MobileAuthPage mode="register" />} />
                    <Route path="/dashboard" element={<CitizenDashboard />} />
                    <Route path="/warnings/:warningId" element={<CitizenDashboard />} />
                    <Route path="/map" element={<CitizenDashboard />} />
                    <Route path="/report" element={<Navigate to="/report-hazard" replace />} />
                    <Route path="/report-hazard" element={<CitizenDashboard />} />
                    <Route path="/my-reports" element={<CitizenDashboard />} />
                    <Route path="/my-reports/:reportId" element={<CitizenDashboard />} />
                    <Route path="/test-location" element={<LocationTest />} />
                    <Route path="/alerts" element={<CitizenDashboard />} />
                    <Route path="/profile" element={<CitizenDashboard />} />

                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App