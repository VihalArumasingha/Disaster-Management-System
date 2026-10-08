import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from '../../components/ui/Home'
import AuthPage from '../../auth/components/AuthPage'
import RoleDashboard, { StaffDashboard } from '../../auth/components/RoleDashboard'
import { USER_ROLES } from '../../constants/roles'
import DmcOfficerLayout from '../../layouts/dmcOfficer/DmcOfficerLayout'
import NgoManagerLayout from '../../layouts/ngoManager/NgoManagerLayout'

const DmcDashboardPage = lazy(() => import('../../roles/dmcOfficer/pages/DmcDashboardPage'))
const EscalatedReportsPage = lazy(() => import('../../roles/dmcOfficer/pages/EscalatedReportsPage'))
const HazardReviewQueue = lazy(() => import('../../roles/dmcOfficer/pages/HazardReviewQueue'))
const HazardClusterDetails = lazy(() => import('../../roles/dmcOfficer/pages/HazardClusterDetails'))
const WarningsPage = lazy(() => import('../../roles/dmcOfficer/pages/WarningsPage'))
const CreateWarningPage = lazy(() => import('../../roles/dmcOfficer/pages/CreateWarningPage'))
const ReviewWarningPage = lazy(() => import('../../roles/dmcOfficer/pages/ReviewWarningPage'))
const WarningUpdatePage = lazy(() => import('../../roles/dmcOfficer/pages/WarningUpdatePage'))
const TargetAreasPage = lazy(() => import('../../roles/dmcOfficer/pages/TargetAreasPage'))
const CreateTargetAreaPage = lazy(() => import('../../roles/dmcOfficer/pages/CreateTargetAreaPage'))
const DmcProfilePage = lazy(() => import('../../roles/dmcOfficer/pages/DmcProfilePage'))
const ShelterManagementPage = lazy(() => import('../../components/NGODashboard/ShelterManagement.jsx'))
const OrganizationManagementPage = lazy(() => import('../../components/NGODashboard/OrganizationManagement.jsx'))
const ReliefSupplyManagementPage = lazy(() => import('../../components/NGODashboard/ReliefSupplyManagement.jsx'))
const ImpactMonitoringPage = lazy(() => import('../../components/NGODashboard/ImpactMonitoring.jsx'))
const AnalyticsReportsPage = lazy(() => import('../../components/NGODashboard/AnalyticsReports.jsx'))

const DonationPage = lazy(() => import('../../components/NGODashboard/Donationpage.jsx'))
const DonationFormPage = lazy(() => import('../../components/NGODashboard/DonationForm.jsx'))
const EditDonationPage = lazy(() => import('../../components/NGODashboard/editdonatemoney.jsx'))
const ActiveDisasterPage = lazy(() => import('../../components/NGODashboard/activedisaster.jsx'))
const DisasterFormPage = lazy(() => import('../../components/NGODashboard/DisasterForm.jsx'))
const CollectingCentersPage = lazy(() => import('../../components/NGODashboard/center.jsx'))
const AssignReliefPage = lazy(() => import('../../components/NGODashboard/assignreliefpage.jsx'))
const InventoryPage = lazy(() => import('../../components/NGODashboard/inventory page.jsx'))
const VolunteerPage = lazy(() => import('../../components/NGODashboard/volunteerpage.jsx'))
const EditVolunteerPage = lazy(() => import('../../components/NGODashboard/editvolunteer.jsx'))
const ReliefDistributionPage = lazy(() => import('../../components/NGODashboard/distributionpage.jsx'))
const NgoPastPage = lazy(() => import('../../components/NGODashboard/ngopast.jsx'))
const OverviewPage = lazy(() => import('../../components/NGODashboard/OverviewPage.jsx'))


const withLoading = (page) => (
    <Suspense fallback={<div className="px-5 py-20 text-center text-slate-600">Loading page…</div>}>
        {page}
    </Suspense>
)

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
            <Route path="/dmcofficer" element={<DmcOfficerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={withLoading(<DmcDashboardPage />)} />
                <Route path="escalated-reports" element={withLoading(<EscalatedReportsPage />)} />
                <Route path="hazard-reviews" element={withLoading(<HazardReviewQueue />)} />
                <Route path="hazard-reviews/clusters/:clusterId" element={withLoading(<HazardClusterDetails />)} />
                <Route path="warnings" element={withLoading(<WarningsPage />)} />
                <Route path="warnings/create" element={withLoading(<CreateWarningPage />)} />
                <Route path="warnings/:warningId/edit" element={withLoading(<CreateWarningPage />)} />
                <Route path="warnings/:warningId/review" element={withLoading(<ReviewWarningPage />)} />
                <Route path="warnings/:warningId/update" element={withLoading(<WarningUpdatePage />)} />
                <Route path="target-areas" element={withLoading(<TargetAreasPage />)} />
                <Route path="target-areas/create" element={withLoading(<CreateTargetAreaPage />)} />
                <Route path="shelters" element={withLoading(<ShelterManagementPage />)} />
                <Route path="organizations" element={withLoading(<OrganizationManagementPage />)} />
                <Route path="relief-supplies" element={withLoading(<ReliefSupplyManagementPage />)} />
                <Route path="relief-distributions" element={withLoading(<ReliefSupplyManagementPage initialTab="distributions" canAudit />)} />
                <Route path="impact-monitoring" element={withLoading(<ImpactMonitoringPage canEdit />)} />
                <Route path="analytics-reports" element={withLoading(<AnalyticsReportsPage />)} />
                <Route path="profile" element={withLoading(<DmcProfilePage />)} />
            </Route>
            <Route path="/dutyofficer/dashboard" element={<RoleDashboard role={USER_ROLES.dutyofficer} />} />

            {/* NGO Manager — nested layout */}
            <Route path="/ngomanager" element={<NgoManagerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={withLoading(<OverviewPage />)} />
                <Route path="shelters" element={withLoading(<ShelterManagementPage apiBase="/ngomanager" />)} />
                <Route path="organizations" element={withLoading(<OrganizationManagementPage apiBase="/ngomanager" />)} />
                <Route path="relief-supplies" element={withLoading(<ReliefSupplyManagementPage apiBase="/ngomanager" />)} />
                <Route path="relief-distributions" element={withLoading(<ReliefSupplyManagementPage apiBase="/ngomanager" initialTab="distributions" />)} />
                <Route path="impact-monitoring" element={withLoading(<ImpactMonitoringPage apiBase="/ngomanager" />)} />
                <Route path="analytics-reports" element={withLoading(<AnalyticsReportsPage apiBase="/ngomanager" />)} />
                <Route path="donations" element={withLoading(<DonationPage />)} />
                <Route path="donations/new" element={withLoading(<DonationFormPage />)} />
                <Route path="donations/:donationId/edit" element={withLoading(<EditDonationPage />)} />
                <Route path="active-disasters" element={withLoading(<ActiveDisasterPage />)} />
                <Route path="disaster/new" element={withLoading(<DisasterFormPage />)} />
                <Route path="disaster/:disasterId/edit" element={withLoading(<DisasterFormPage />)} />
                <Route path="collecting-centers" element={withLoading(<CollectingCentersPage />)} />
                <Route path="assign-relief-teams" element={withLoading(<AssignReliefPage />)} />
                <Route path="relief-quantities" element={withLoading(<InventoryPage />)} />
                <Route path="volunteers" element={withLoading(<VolunteerPage />)} />
                <Route path="volunteers/new" element={withLoading(<EditVolunteerPage />)} />
                <Route path="volunteers/:volunteerId/edit" element={withLoading(<EditVolunteerPage />)} />
                <Route path="relief-distribution" element={withLoading(<ReliefDistributionPage />)} />
                <Route path="past" element={withLoading(<NgoPastPage />)} />
            </Route>

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