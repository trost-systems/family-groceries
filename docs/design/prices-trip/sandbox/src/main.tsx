import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './page.css'

const Agentation = import.meta.env.DEV ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation }))) : null

const root = document.getElementById('root')
if (!root) throw new Error('no #root')
createRoot(root).render(
  <StrictMode>
    <App />
    {Agentation && (
      <Suspense>
        <Agentation />
      </Suspense>
    )}
  </StrictMode>,
)
