import { Routes, Route, Navigate } from 'react-router-dom'
import Home from '../../components/ui/Home'

function AppRoutes() {
    return (
        <Routes>
            <Route
                path="/"
                element={<Home />}
            />

            <Route
                path="/login"
                element={
                    <div className="flex min-h-screen items-center justify-center">
                        <h1 className="text-3xl font-bold">
                            Disaster Management System
                        </h1>
                    </div>
                }
            />

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