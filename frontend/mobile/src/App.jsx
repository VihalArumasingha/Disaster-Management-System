import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import CitizenDashboard from './CitizenDashboard'
import MobileAuthPage from './MobileAuthPage'
import LocationTest from './pages/LocationTest'
import ReportHazard from './pages/ReportHazard'
import MyReports from './pages/MyReports'
import ReportDetails from './pages/ReportDetails'
import CitizenLayout from './layouts/citizen/CitizenLayout'

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Authentication */}
                    <Route
                        path="/"
                        element={<Navigate to="/login" replace />}
                    />

                    <Route
                        path="/login"
                        element={<MobileAuthPage mode="login" />}
                    />

                    <Route
                        path="/register"
                        element={<MobileAuthPage mode="register" />}
                    />

                    {/* Citizen application */}
                    <Route element={<CitizenLayout />}>
                        <Route
                            path="/dashboard"
                            element={<CitizenDashboard />}
                        />

                        <Route
                            path="/report-hazard"
                            element={<ReportHazard />}
                        />

                        <Route
                            path="/my-reports"
                            element={<MyReports />}
                        />

                        <Route
                            path="/my-reports/:reportId"
                            element={<ReportDetails />}
                        />

                        {/* Temporary map test */}
                        <Route
                            path="/test-location"
                            element={<LocationTest />}
                        />
                    </Route>

                    {/* Unknown routes */}
                    <Route
                        path="*"
                        element={<Navigate to="/login" replace />}
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App