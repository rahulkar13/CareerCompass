import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { ResumeSessionProvider } from './context/ResumeSessionContext'
import { appRouter } from './routes/appRoutes'
import { authApi } from './services/api'

const THEME_KEY = 'interview-prep-theme'

const isProtectedTextField = (target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement => {
  if (!(target instanceof HTMLElement)) return false
  const field = target.closest('input, textarea')
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false
  if (field instanceof HTMLInputElement && field.type === 'file') return false
  return !field.readOnly && !field.disabled
}

const isLinkLikeDrop = (event: DragEvent) => {
  const transfer = event.dataTransfer
  if (!transfer) return false
  if (transfer.files.length > 0) return false

  const availableTypes = Array.from(transfer.types)
  return availableTypes.includes('text/uri-list')
    || availableTypes.includes('text/html')
    || availableTypes.includes('text/plain')
}

const App = () => {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY)
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
    const initialTheme = stored === 'light' || stored === 'dark' ? stored : prefersLight ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  useEffect(() => {
    const root = document.documentElement

    const handlePointerMove = (event: PointerEvent) => {
      root.style.setProperty('--cursor-x', `${event.clientX}px`)
      root.style.setProperty('--cursor-y', `${event.clientY}px`)
    }

    window.addEventListener('pointermove', handlePointerMove)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const validateStoredSession = async () => {
      if (!mounted) return
      await authApi.validateSession()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void validateStoredSession()
      }
    }

    void validateStoredSession()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const blockAccidentalLinkDrop = (event: DragEvent) => {
      if (!isProtectedTextField(event.target) || !isLinkLikeDrop(event)) return
      event.preventDefault()
    }

    document.addEventListener('dragover', blockAccidentalLinkDrop)
    document.addEventListener('drop', blockAccidentalLinkDrop)

    return () => {
      document.removeEventListener('dragover', blockAccidentalLinkDrop)
      document.removeEventListener('drop', blockAccidentalLinkDrop)
    }
  }, [])

  return (
    <>
      <div className="cursor-glow" aria-hidden="true" />
      <ResumeSessionProvider>
        <RouterProvider router={appRouter} />
      </ResumeSessionProvider>
    </>
  )
}

export default App
