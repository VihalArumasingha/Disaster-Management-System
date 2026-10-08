import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from '../../components/ui/Home'
import AuthPage from '../../auth/components/AuthPage'
import RoleDashboard, { StaffDashboard } from '../../auth/components/RoleDashboard'
import { USER_ROLES } from '../../constants/roles'
import DmcOfficerLayout from '../../layouts/dmcOfficer/DmcOfficerLayout'
import DutyOfficerLayout from '../../layouts/dutyOfficer/DutyOfficerLayout'
import NgoManagerLayout from '../../layouts/ngoManager/NgoManagerLayout'

const DmcDashboardPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/DmcDashboardPage')
)

const EscalatedReportsPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/EscalatedReportsPage')
)

const DutyOfficerDashboardPage = lazy(() =>
    import('../../roles/dutyOfficer/pages/DutyOfficerDashboardPage')
)

const DutyOfficerClusterDetailsPage = lazy(() =>
    import('../../roles/dutyOfficer/pages/DutyOfficerClusterDetailsPage')
)

const DutyOfficerReportClustersPage = lazy(() =>
    import('../../roles/dutyOfficer/pages/DutyOfficerReportClustersPage')
)

const DutyOfficerReportsPage = lazy(() =>
    import('../../roles/dutyOfficer/pages/DutyOfficerReportsPage')
)

const DutyOfficerReportDetailsPage = lazy(() =>
    import('../../roles/dutyOfficer/pages/DutyOfficerReportDetailsPage')
)

const WarningsPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/WarningsPage')
)

const CreateWarningPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/CreateWarningPage')
)

const ReviewWarningPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/ReviewWarningPage')
)

const WarningUpdatePage = lazy(() =>
    import('../../roles/dmcOfficer/pages/WarningUpdatePage')
)

const TargetAreasPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/TargetAreasPage')
)

const CreateTargetAreaPage = lazy(() =>
    import('../../roles/dmcOfficer/pages/CreateTargetAreaPage')
)

const DmcProfilePage = lazy(() =>
    import('../../roles/dmcOfficer/pages/DmcProfilePage')
)

const DonationPage = lazy(() =>
    import('../../components/NGODashboard/Donationpage.jsx')
)

const withLoading = (page) => (
    <Suspense
        fallback={
            <div className="px-5 py-20 text-center text-slate-600">
                Loading page…
            </div>
        }
    >
        {page}
    </Suspense>
)

function AppRoutes() {
    return (
        <Routes>
            {/* Public */}
            <Route
                path="/"
                element={<Home />}
            />

            <Route
                path="/login"
                element={<AuthPage mode="login" />}
            />

            <Route
                path="/register"
                element={<AuthPage mode="register" />}
            />

            {/* Staff dashboard */}
            <Route
                path="/dashboard"
                element={<StaffDashboard />}
            />

            {/* =========================
                DMC OFFICER
            ========================= */}
            <Route
                path="/dmcofficer"
                element={<DmcOfficerLayout />}
            >
                <Route
                    index
                    element={<Navigate to="dashboard" replace />}
                />

                <Route
                    path="dashboard"
                    element={withLoading(<DmcDashboardPage />)}
                />

                <Route
                    path="escalated-reports"
                    element={withLoading(<EscalatedReportsPage />)}
                />

                <Route
                    path="warnings"
                    element={withLoading(<WarningsPage />)}
                />

                <Route
                    path="warnings/create"
                    element={withLoading(<CreateWarningPage />)}
                />

                <Route
                    path="warnings/:warningId/edit"
                    element={withLoading(<CreateWarningPage />)}
                />

                <Route
                    path="warnings/:warningId/review"
                    element={withLoading(<ReviewWarningPage />)}
                />

                <Route
                    path="warnings/:warningId/update"
                    element={withLoading(<WarningUpdatePage />)}
                />

                <Route
                    path="target-areas"
                    element={withLoading(<TargetAreasPage />)}
                />

                <Route
                    path="target-areas/create"
                    element={withLoading(<CreateTargetAreaPage />)}
                />

                <Route
                    path="profile"
                    element={withLoading(<DmcProfilePage />)}
                />
            </Route>

            {/* =========================
                DUTY OFFICER
            ========================= */}
            <Route
                path="/dutyofficer"
                element={<DutyOfficerLayout />}
            >
                <Route
                    index
                    element={<Navigate to="dashboard" replace />}
                />

                <Route
                    path="dashboard"
                    element={withLoading(<DutyOfficerDashboardPage />)}
                />

                <Route
                    path="hazard-reviews"
                    element={withLoading(<DutyOfficerReportClustersPage />)}
                />

                <Route
                    path="hazard-reviews/clusters/:clusterId"
                    element={withLoading(<DutyOfficerClusterDetailsPage />)}
                />

                {/* New Duty Officer report history page */}
                <Route
                    path="reports"
                    element={withLoading(<DutyOfficerReportsPage />)}
                />

                <Route
                    path="reports/:reportId"
                    element={withLoading(<DutyOfficerReportDetailsPage />)}
                />

                {/* Keep old route for compatibility.
                    Hazard Map is now part of the dashboard
                    and is no longer a sidebar destination. */}
                <Route
                    path="hazard-map"
                    element={
                        <Navigate
                            to="/dutyofficer/dashboard#hazard-map"
                            replace
                        />
                    }
                />
            </Route>

            {/* =========================
                NGO MANAGER
            ========================= */}
            <Route
                path="/ngomanager"
                element={<NgoManagerLayout />}
            >
                <Route
                    index
                    element={<Navigate to="dashboard" replace />}
                />

                <Route
                    path="dashboard"
                    element={
                        <RoleDashboard
                            role={USER_ROLES.ngomanager}
                        />
                    }
                />

                <Route
                    path="donations"
                    element={withLoading(<DonationPage />)}
                />
            </Route>

            {/* Not found */}
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