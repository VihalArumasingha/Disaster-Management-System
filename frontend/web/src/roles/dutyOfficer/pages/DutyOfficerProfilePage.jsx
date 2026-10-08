import { useAuth } from '../../../auth/hooks'
import { User, Mail, ShieldAlert, Phone } from 'lucide-react'

function DutyOfficerProfilePage() {
    const { user } = useAuth()

    return (
        <main className="mx-auto max-w-3xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Officer Profile</h1>
                <p className="mt-2 text-slate-600">Manage your duty officer account details.</p>
            </header>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="bg-blue-50/50 px-6 py-8 border-b border-slate-100 flex items-center gap-5">
                    <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-600 text-white shadow-md">
                        <User size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{user?.name || 'Officer'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                <ShieldAlert size={12} />
                                Duty Officer
                            </span>
                            <span className="inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                                Active Account
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Contact Information</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-slate-400">
                                <Mail size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900">Email Address</p>
                                <p className="text-sm text-slate-600">{user?.email || 'Not provided'}</p>
                            </div>
                        </div>
                        {user?.phone && (
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 text-slate-400">
                                    <Phone size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">Phone Number</p>
                                    <p className="text-sm text-slate-600">{user.phone}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    )
}

export default DutyOfficerProfilePage
