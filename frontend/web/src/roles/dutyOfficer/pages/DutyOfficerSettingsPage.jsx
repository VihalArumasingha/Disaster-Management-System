import { useState } from 'react'
import { Bell, MapPin } from 'lucide-react'
import { useAuth } from '../../../auth/hooks'

function DutyOfficerSettingsPage() {
    const { user } = useAuth()
    
    // UI-only state
    const [highPriorityAlerts, setHighPriorityAlerts] = useState(true)
    const [escalationNotifications, setEscalationNotifications] = useState(true)

    return (
        <main className="mx-auto max-w-3xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                <p className="mt-2 text-slate-600">Preferences and configuration.</p>
            </header>

            <div className="space-y-6">
                {/* Officer Profile Settings */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <MapPin size={18} className="text-slate-500" />
                            Officer Profile
                        </h2>
                    </div>
                    <div className="p-5">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700">Name</label>
                                <input 
                                    type="text" 
                                    disabled 
                                    value={user?.name || ''} 
                                    className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-500 shadow-sm opacity-70" 
                                />
                                <p className="mt-1 text-xs text-slate-500">Managed by system administrator.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Notifications Settings */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Bell size={18} className="text-slate-500" />
                            Notifications
                        </h2>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-slate-900">High-priority cluster alerts</h3>
                                <p className="text-sm text-slate-500">Get notified when new critical or high clusters emerge.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setHighPriorityAlerts(!highPriorityAlerts)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${highPriorityAlerts ? 'bg-blue-600' : 'bg-slate-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${highPriorityAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-slate-900">Escalation notifications</h3>
                                <p className="text-sm text-slate-500">Get notified when DMC acknowledges your escalations.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setEscalationNotifications(!escalationNotifications)}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${escalationNotifications ? 'bg-blue-600' : 'bg-slate-200'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${escalationNotifications ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}

export default DutyOfficerSettingsPage
