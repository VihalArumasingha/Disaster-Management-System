import { Routes, Route } from 'react-router-dom'
import Home from '../../components/ui/Home'
import AuthPage from '../../auth/components/AuthPage'
import RoleDashboard, { StaffDashboard } from '../../auth/components/RoleDashboard'
import { USER_ROLES } from '../../constants/roles'

function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/"
                element={<Home />}
            />

            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/dashboard" element={<StaffDashboard />} />
            <Route path="/dmcofficer/dashboard" element={<RoleDashboard role={USER_ROLES.dmcofficer} />} />
            <Route path="/dutyofficer/dashboard" element={<RoleDashboard role={USER_ROLES.dutyofficer} />} />
            <Route path="/ngomanager/dashboard" element={<RoleDashboard role={USER_ROLES.ngomanager} />} />

            <Route
                path="*"
                element={
                    <div className="flex min-h-screen items-center justify-center">
                        <h1 className="text-2xl font-semibold">
                            Page Not Found
                        </h1>
                    </div>
                }
            />
        </Routes>
    )
}

export default AppRoutes