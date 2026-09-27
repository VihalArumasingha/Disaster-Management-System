import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './app/routes'
import AppProviders from './app/providers'
import Header from './components/ui/Header'
import Footer from './components/ui/Footer'

function App() {
    return (
        <AppProviders>
            <BrowserRouter>
                <Header />
                <AppRoutes />
                <Footer />
            </BrowserRouter>
        </AppProviders>
    )
}

export default App