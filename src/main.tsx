import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { FeedbackProvider } from './components/Feedback'
import { SplashIntro } from './components/SplashIntro'
import './index.css'
import { AppStoreProvider } from './store/AppStore'
import { AuthProvider } from './store/Auth'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FeedbackProvider>
        <AuthProvider>
          <AppStoreProvider>
            <App />
            <SplashIntro />
          </AppStoreProvider>
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  </StrictMode>,
)
