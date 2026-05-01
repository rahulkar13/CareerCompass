import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { authApi, dashboardPathByRole } from '../services/api'
import type { UserRole } from '../types'

const AuthLoading = (): ReactElement => (
  <div className="auth-root grid min-h-screen place-items-center p-4">
    <div className="app-card w-full max-w-md rounded-2xl border p-6 text-center">
      <p className="text-sm text-slate-400">Checking your session...</p>
    </div>
  </div>
)

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: UserRole[] }): ReactElement => {
  const location = useLocation()
  const session = authApi.getSession()
  const [status, setStatus] = useState<'checking' | 'ready' | 'blocked'>(session ? 'checking' : 'blocked')
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(session?.user.role ?? null)

  useEffect(() => {
    let mounted = true

    if (!session) {
      setStatus('blocked')
      return () => {
        mounted = false
      }
    }

    authApi.refreshSession()
      .then((nextSession) => {
        if (!mounted) return
        setResolvedRole(nextSession.user.role)
        setStatus('ready')
      })
      .catch(() => {
        if (!mounted) return
        setStatus('blocked')
      })

    return () => {
      mounted = false
    }
  }, [session])

  if (!session || status === 'blocked') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (status === 'checking') {
    return <AuthLoading />
  }

  if (allowedRoles?.length && resolvedRole && !allowedRoles.includes(resolvedRole)) {
    return <Navigate to={dashboardPathByRole(resolvedRole)} replace />
  }

  if (resolvedRole === 'recruiter') {
    const accountStatus = authApi.getSession()?.user.accountStatus ?? session.user.accountStatus
    if (accountStatus && accountStatus !== 'active') {
      return <Navigate to={`/recruiter/access-status?status=${encodeURIComponent(accountStatus)}`} replace />
    }
  }

  return <Outlet />
}

export const PublicOnlyRoute = (): ReactElement => {
  const session = authApi.getSession()
  const [status, setStatus] = useState<'checking' | 'guest' | 'authenticated'>(session ? 'checking' : 'guest')
  const [resolvedRole, setResolvedRole] = useState<UserRole | null>(session?.user.role ?? null)

  useEffect(() => {
    let mounted = true

    if (!session) {
      setStatus('guest')
      return () => {
        mounted = false
      }
    }

    authApi.refreshSession()
      .then((nextSession) => {
        if (!mounted) return
        setResolvedRole(nextSession.user.role)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!mounted) return
        setStatus('guest')
      })

    return () => {
      mounted = false
    }
  }, [session])

  if (status === 'checking') {
    return <AuthLoading />
  }

  if (status === 'guest' || !resolvedRole) {
    return <Outlet />
  }

  return <Navigate to={dashboardPathByRole(resolvedRole)} replace />
}
