import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LangProvider } from './shared/i18n'
import { installTokens } from './tokens'
import './index.css'

installTokens()

const Agentation = import.meta.env.DEV ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation }))) : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
    {Agentation && (
      <Suspense>
        <Agentation />
      </Suspense>
    )}
  </StrictMode>,
)
