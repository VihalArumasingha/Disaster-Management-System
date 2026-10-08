import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks'
import CitizenLayout from '../../layouts/citizen/CitizenLayout'
import DmcOfficerLayout from '../../layouts/dmcOfficer/DmcOfficerLayout'
import DutyOfficerLayout from '../../layouts/dutyOfficer/DutyOfficerLayout'
import NgoManagerLayout from '../../layouts/DMCnewManager/DMCnewManagerLayout'
import { dashboardPathForRole } from '../utils/dashboardPaths'
import { USER_ROLES } from '../../constants/roles'

const roleContent = {
    [USER_ROLES.dmcofficer]: {
        title: 'DMC Officer Dashboard',
        description: 'Coordinate national disaster response, review incidents, and monitor active alerts.',
        panels: ['Incident coordination', 'Situation reports', 'Public alerts']
    },
    [USER_ROLES.dutyofficer]: {
        title: 'Duty Officer Dashboard',
        description: 'Monitor incoming reports and coordinate operational response during your shift.',
        panels: ['Incoming incidents', 'Response status', 'Shift handover']
    },
    [USER_ROLES.ngomanager]: {
        title: 'NGO Manager Dashboard',
        description: 'Coordinate relief operations, resources, and assistance with response partners.',
        panels: ['Relief coordination', 'Available resources', 'Partner updates']
    },
    [USER_ROLES.citizen]: {
        title: 'Citizen Dashboard',
        description: 'Access local safety information and community support.',
        panels: ['Local alerts', 'Safety information', 'Community support']
    }
}

const layouts = {
    [USER_ROLES.dmcofficer]: DmcOfficerLayout,
    [USER_ROLES.dutyofficer]: DutyOfficerLayout,
    [USER_ROLES.ngomanager]: NgoManagerLayout,
    [USER_ROLES.citizen]: CitizenLayout
}

export function StaffDashboard() {
    const { user, loading } = useAuth()

    if (loading) return <div className="py-24 text-center">Loading…</div>
    if (!user) return <Navigate to="/login" replace />
    if (user.role === USER_ROLES.citizen) return <Navigate to="/login" replace />

    const destination = dashboardPathForRole(user.role)
    return <Navigate to={destination} replace />
}

function RoleDashboard({ role }) {
    const { user, loading, logout } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState('')

    if (loading) return <div className="py-24 text-center">Loading…</div>
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== role) {
        return <Navigate to={dashboardPathForRole(user.role)} replace />
    }

    const Layout = layouts[role]
    const content = roleContent[role]

    const signOut = async () => {
        try {
            await logout()
            navigate('/login', { replace: true })
        } catch {
            setError('Could not sign out. Check your connection and try again.')
        }
    }

    return (
        <Layout>
            <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
                            SafeZone operations
                        </p>
                        <h1 className="mt-2 text-3xl font-bold text-gray-900">{content.title}</h1>
                        <p className="mt-2 text-gray-600">Signed in as {user.name}</p>
                    </div>
                    {error && (
                        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </p>
                    )}
                    <button
                        onClick={signOut}
                        className="self-start rounded-lg border border-gray-300 px-4 py-2 font-semibold text-gray-700 hover:bg-white"
                    >
                        Sign out
                    </button>
                </div>
                <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
                    <h2 className="text-xl font-semibold text-gray-900">Your workspace</h2>
                    <p className="mt-2 max-w-3xl text-gray-600">{content.description}</p>
                    <div className="mt-7 grid gap-4 md:grid-cols-3">
                        {content.panels.map((panel) => (
                            <article key={panel} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                                <h3 className="font-semibold text-gray-900">{panel}</h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    Your {panel.toLowerCase()} tools will be available here.
                                </p>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </Layout>
    )
}

export default RoleDashboard
