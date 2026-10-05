import { Outlet } from 'react-router-dom'
import CitizenBottomNav from './CitizenBottomNav'

function CitizenLayout() {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto min-h-screen w-full max-w-md pb-24">
                <Outlet />
            </div>

            <CitizenBottomNav />
        </div>
    )
}

export default CitizenLayout