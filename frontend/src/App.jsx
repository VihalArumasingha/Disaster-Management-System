import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './app/routes'
import AppProviders from './app/providers'

function App() {
    return (
        <AppProviders>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AppProviders>
    )
}

export default App