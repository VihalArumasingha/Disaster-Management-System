import { BrowserRouter, useLocation } from 'react-router-dom'
import AppRoutes from './app/routes'
import AppProviders from './app/providers'
import Header from './components/ui/Header'
import Footer from './components/ui/Footer'

function SiteFrame() {
    const { pathname } = useLocation()
    const isDmcWorkspace = pathname.startsWith('/dmcofficer')

    return (
        <>
            {!isDmcWorkspace && <Header />}
            <AppRoutes />
            {!isDmcWorkspace && <Footer />}
        </>
    )
}

function App() {
    return (
        <AppProviders>
            <BrowserRouter>
                <SiteFrame />
            </BrowserRouter>
        </AppProviders>
    )
}

export default App