import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi, dashboardPathByRole } from '../../services/api'

const AuthShell = ({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) => (
  <div className="auth-root grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.26),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.24),transparent_35%),linear-gradient(180deg,#070b1a,#111b3d)] p-4">
    <div className="w-full max-w-md rounded-2xl border border-indigo-400/45 bg-[#121a38]/90 p-6 shadow-[0_24px_70px_-35px_rgba(6,182,212,0.72)] backdrop-blur-sm">
      <h1 className="text-2xl font-semibold text-indigo-50">{title}</h1>
      <p className="mb-5 text-sm text-indigo-200/75">{subtitle}</p>
      {children}
    </div>
  </div>
)

const required = (value: string) => value.trim().length > 0
const authStyles = {
  light: {
    input: 'w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-slate-700 outline-none placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-200/70',
    select: 'w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-slate-700 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-200/70',
    error: 'rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700',
    success: 'rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700',
    muted: 'text-sm text-slate-500',
    link: 'text-orange-600 hover:text-orange-500',
    section: 'rounded-2xl border border-slate-200 bg-white/88 p-5 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.25)]',
    sectionTitle: 'text-sm font-semibold text-slate-700',
    sectionCopy: 'mt-1 text-sm text-slate-500',
    label: 'mb-2 block text-sm font-medium text-slate-700',
    stickyActions: 'sticky bottom-0 -mx-1 mt-1 border-t border-slate-200 bg-white/96 px-1 pb-1 pt-4 backdrop-blur-sm',
    rolePicker: 'grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-100/90 p-1',
    roleActive: 'bg-orange-500 text-white shadow-[0_10px_25px_-18px_rgba(234,88,12,0.7)]',
    roleInactive: 'text-slate-600 hover:bg-white',
    secondaryButton: 'shrink-0 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60',
    primaryButton: 'w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 py-2.5 font-semibold text-white shadow-[0_18px_32px_-22px_rgba(221,107,32,0.42)] transition hover:from-orange-400 hover:to-amber-300 disabled:cursor-not-allowed disabled:opacity-70',
  },
  dark: {
    input: 'w-full rounded-xl border border-slate-700 bg-[rgba(11,19,35,0.92)] px-4 py-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-500/70 focus:ring-2 focus:ring-teal-500/18',
    select: 'w-full rounded-xl border border-slate-700 bg-[rgba(11,19,35,0.92)] px-4 py-3 text-slate-100 outline-none focus:border-teal-500/70 focus:ring-2 focus:ring-teal-500/18',
    error: 'rounded-xl border border-rose-500/22 bg-[rgba(72,26,35,0.42)] px-4 py-3 text-sm text-rose-100',
    success: 'rounded-xl border border-emerald-500/20 bg-[rgba(18,62,52,0.42)] px-4 py-3 text-sm text-emerald-100',
    muted: 'text-sm text-slate-400',
    link: 'text-teal-300 hover:text-teal-200',
    section: 'rounded-2xl border border-slate-700/90 bg-[linear-gradient(180deg,rgba(17,25,43,0.94),rgba(10,17,31,0.96))] p-5 shadow-[0_26px_44px_-34px_rgba(0,0,0,0.62)]',
    sectionTitle: 'text-sm font-semibold text-slate-100',
    sectionCopy: 'mt-1 text-sm text-slate-400',
    label: 'mb-2 block text-sm font-medium text-slate-200',
    stickyActions: 'sticky bottom-0 -mx-1 mt-1 border-t border-slate-700 bg-[rgba(12,19,35,0.98)] px-1 pb-1 pt-4 backdrop-blur-sm',
    rolePicker: 'grid grid-cols-2 gap-2 rounded-xl border border-slate-700 bg-[rgba(9,15,27,0.96)] p-1',
    roleActive: 'bg-[linear-gradient(135deg,#d97a34,#b85828)] text-white shadow-[0_16px_30px_-20px_rgba(191,95,38,0.62)]',
    roleInactive: 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
    secondaryButton: 'shrink-0 rounded-xl border border-[#8b4a2b] bg-[linear-gradient(135deg,rgba(67,34,23,0.96),rgba(45,24,18,0.92))] px-3 py-2 text-sm font-medium text-[#ffd9bf] transition hover:border-[#d97a34] hover:bg-[linear-gradient(135deg,rgba(88,42,26,0.98),rgba(58,28,20,0.94))] disabled:cursor-not-allowed disabled:opacity-60',
    primaryButton: 'w-full rounded-xl bg-gradient-to-r from-[#e07f36] to-[#bf5b2a] py-2.5 font-semibold text-white shadow-[0_24px_36px_-24px_rgba(196,95,38,0.58)] transition hover:from-[#eb8b42] hover:to-[#cb6430] disabled:cursor-not-allowed disabled:opacity-70',
  },
}

type AuthVariant = keyof typeof authStyles

const Field = ({ label, children, labelClassName }: { label: string; children: ReactNode; labelClassName: string }) => (
  <div>
    <label className={labelClassName}>{label}</label>
    {children}
  </div>
)

const FormSection = ({
  title,
  description,
  className = '',
  titleClassName = 'text-sm font-semibold text-indigo-100',
  descriptionClassName = 'mt-1 text-xs text-indigo-200/70',
  children,
}: {
  title: string
  description?: string
  className?: string
  titleClassName?: string
  descriptionClassName?: string
  children: ReactNode
}) => (
  <section className={className}>
    <h3 className={titleClassName}>{title}</h3>
    {description ? <p className={descriptionClassName}>{description}</p> : null}
    <div className="mt-4">{children}</div>
  </section>
)

export const LoginForm = ({
  showLinks = true,
  variant = 'light',
  onSuccess,
  navigateWithReload = false,
}: {
  showLinks?: boolean
  variant?: AuthVariant
  onSuccess?: () => void
  navigateWithReload?: boolean
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const styles = authStyles[variant]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!required(email) || !required(password)) return setError('Email and password are required.')
    if (password.length < 6) return setError('Password must be at least 6 characters.')
    try {
      setLoading(true)
      setError('')
      const session = await authApi.login({ email, password })
      onSuccess?.()
      const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
      const targetPath = nextPath ?? dashboardPathByRole(session.user.role)
      if (navigateWithReload) {
        window.location.assign(targetPath)
        return
      }
      navigate(targetPath, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.'
      const lowered = message.toLowerCase()
      if (lowered.includes('pending admin approval')) {
        onSuccess?.()
        if (navigateWithReload) {
          window.location.assign('/recruiter/access-status?status=pending')
          return
        }
        navigate('/recruiter/access-status?status=pending', { replace: true, state: { message } })
        return
      }
      if (lowered.includes('was rejected')) {
        onSuccess?.()
        if (navigateWithReload) {
          window.location.assign('/recruiter/access-status?status=rejected')
          return
        }
        navigate('/recruiter/access-status?status=rejected', { replace: true, state: { message } })
        return
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <input className={styles.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input className={styles.input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error ? <p className={styles.error}>{error}</p> : null}
      <button className={styles.primaryButton} disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
      {showLinks ? (
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className={styles.link}>Forgot password?</Link>
          <Link to="/register" className={styles.link}>Register</Link>
        </div>
      ) : null}
    </form>
  )
}

export const LoginPage = () => (
  <AuthShell title="Login" subtitle="Access your dashboard">
    <LoginForm />
  </AuthShell>
)

export const RegisterForm = ({
  showLoginLink = true,
  variant = 'light',
  onSuccess,
  navigateWithReload = false,
}: {
  showLoginLink?: boolean
  variant?: AuthVariant
  onSuccess?: () => void
  navigateWithReload?: boolean
}) => {
  const navigate = useNavigate()
  const location = useLocation()
  const styles = authStyles[variant]
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'recruiter'>('student')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [designation, setDesignation] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')

  const registerPayload = {
    name,
    email,
    password,
    role,
    ...(role === 'recruiter'
      ? {
          phone,
          company,
          designation,
          companyWebsite,
        }
      : {}),
  }

  const requestOtp = async () => {
    const result = await authApi.register(registerPayload)
    setOtpSent(true)
    setSuccess(result.message)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!otpSent) {
      if (!required(name) || !required(email) || !required(password)) return setError('Name, email, and password are required.')
      if (password.length < 6) return setError('Password must be at least 6 characters.')
      if (role === 'recruiter' && (!required(phone) || !required(company) || !required(designation))) {
        return setError('Phone number, company name, and designation are required for recruiter registration.')
      }
      try {
        setLoading(true)
        setError('')
        setSuccess('')
        await requestOtp()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed. Please try again.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!required(otp) || otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP sent to your email.')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      const result = await authApi.verifyRegistrationOtp({ email, otp })
      if ('status' in result && result.status === 'pending') {
        setSuccess(result.message)
        setPassword('')
        setOtp('')
        onSuccess?.()
        if (navigateWithReload) {
          window.location.assign('/recruiter/access-status?status=pending')
          return
        }
        return
      }
      if ('token' in result) {
        onSuccess?.()
        const nextPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname
        const targetPath = nextPath ?? dashboardPathByRole(result.user.role)
        if (navigateWithReload) {
          window.location.assign(targetPath)
          return
        }
        navigate(targetPath, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const resendOtp = async () => {
    try {
      setResendingOtp(true)
      setError('')
      setSuccess('')
      setOtp('')
      await requestOtp()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP right now. Please try again.')
    } finally {
      setResendingOtp(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className={styles.rolePicker}>
        <button type="button" onClick={() => setRole('student')} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${role === 'student' ? styles.roleActive : styles.roleInactive}`}>Student</button>
        <button type="button" onClick={() => setRole('recruiter')} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${role === 'recruiter' ? styles.roleActive : styles.roleInactive}`}>Recruiter</button>
      </div>

      <FormSection
        title="Personal details"
        description={role === 'recruiter' ? 'Share your contact details so the admin can review your recruiter access request.' : 'Create your student account with the basics below.'}
        className={styles.section}
        titleClassName={styles.sectionTitle}
        descriptionClassName={styles.sectionCopy}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" labelClassName={styles.label}>
            <input className={styles.input} placeholder="Enter your full name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </Field>
          <Field label={role === 'recruiter' ? 'Work email' : 'Email'} labelClassName={styles.label}>
            <input className={styles.input} placeholder={role === 'recruiter' ? 'name@company.com' : 'name@example.com'} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </Field>
          {role === 'recruiter' ? (
            <Field label="Phone number" labelClassName={styles.label}>
              <input className={styles.input} placeholder="Enter your phone number" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            </Field>
          ) : null}
        </div>
      </FormSection>

      {role === 'recruiter' ? (
        <FormSection
          title="Company details"
          description="These details help us verify that the request is for a genuine recruiter account."
          className={styles.section}
          titleClassName={styles.sectionTitle}
          descriptionClassName={styles.sectionCopy}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" labelClassName={styles.label}>
              <input className={styles.input} placeholder="Enter company name" value={company} onChange={(event) => setCompany(event.target.value)} autoComplete="organization" />
            </Field>
            <Field label="Designation" labelClassName={styles.label}>
              <input className={styles.input} placeholder="Enter your designation" value={designation} onChange={(event) => setDesignation(event.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Company website" labelClassName={styles.label}>
                <input className={styles.input} placeholder="https://company.com (optional)" value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} autoComplete="url" />
              </Field>
            </div>
          </div>
        </FormSection>
      ) : null}

      <FormSection
        title="Account details"
        description={
          otpSent
            ? 'Enter the OTP sent to your email to finish the registration flow.'
            : role === 'recruiter'
              ? 'Your request will stay pending until an admin reviews and approves it.'
              : 'Choose a secure password and verify your email with OTP before account activation.'
        }
        className={styles.section}
        titleClassName={styles.sectionTitle}
        descriptionClassName={styles.sectionCopy}
      >
        <Field label="Password" labelClassName={styles.label}>
          <input className={styles.input} placeholder="Create a password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" disabled={otpSent} />
        </Field>
        {otpSent ? (
          <div className="mt-4">
            <Field label="Email OTP" labelClassName={styles.label}>
              <input className={styles.input} placeholder="Enter 6-digit OTP" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" />
            </Field>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className={styles.sectionCopy}>Didn&apos;t receive the code? Request a fresh OTP for this email.</p>
              <button
                type="button"
                onClick={resendOtp}
                disabled={loading || resendingOtp}
                className={styles.secondaryButton}
              >
                {resendingOtp ? 'Resending...' : 'Resend OTP'}
              </button>
            </div>
          </div>
        ) : null}
        {role === 'recruiter' ? <p className={`${styles.sectionCopy} mt-3`}>Recruiter accounts require admin approval before recruiter dashboard access is enabled.</p> : null}
      </FormSection>

      {error ? <p className={styles.error}>{error}</p> : null}
      {success ? <p className={styles.success}>{success}</p> : null}
      <div className={styles.stickyActions}>
        <button className={styles.primaryButton} disabled={loading}>
          {loading
            ? (otpSent ? 'Verifying OTP...' : role === 'recruiter' ? 'Sending OTP...' : 'Sending OTP...')
            : (otpSent ? 'Verify OTP and Continue' : role === 'recruiter' ? 'Send OTP for Recruiter Request' : 'Send OTP for Signup')}
        </button>
        {showLoginLink ? <p className={`${styles.muted} mt-3`}>Already registered? <Link className={styles.link} to="/login">Login</Link></p> : null}
      </div>
    </form>
  )
}

export const RegisterPage = () => (
  <AuthShell title="Register" subtitle="Create a student account or request recruiter access">
    <RegisterForm />
  </AuthShell>
)

export const ForgotPasswordPage = () => (
  <AuthShell title="Forgot Password" subtitle="We will send reset instructions">
    <ForgotPasswordForm />
  </AuthShell>
)

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!required(email)) {
      setError('Email is required.')
      return
    }
    if (!otpSent) {
      try {
        setLoading(true)
        setError('')
        setSuccess('')
        const result = await authApi.forgotPassword({ email })
        setOtpSent(true)
        setSuccess(result.message)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to send password reset OTP right now.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!required(otp) || otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP sent to your email.')
      return
    }
    if (!required(password) || !required(confirmPassword)) {
      setError('Please enter and confirm your new password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      const result = await authApi.resetPassword({ email, otp, password })
      setSuccess(result.message)
      setPassword('')
      setConfirmPassword('')
      setOtp('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password right now.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <input
        className="w-full rounded-xl border border-indigo-400/40 bg-[#0f1735] px-3 py-2.5 text-indigo-50 outline-none placeholder:text-indigo-300/55 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25"
        placeholder="Enter your account email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
      />
      {otpSent ? (
        <>
          <input
            className="w-full rounded-xl border border-indigo-400/40 bg-[#0f1735] px-3 py-2.5 text-indigo-50 outline-none placeholder:text-indigo-300/55 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25"
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
          />
          <input
            className="w-full rounded-xl border border-indigo-400/40 bg-[#0f1735] px-3 py-2.5 text-indigo-50 outline-none placeholder:text-indigo-300/55 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25"
            type="password"
            placeholder="New password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
          <input
            className="w-full rounded-xl border border-indigo-400/40 bg-[#0f1735] px-3 py-2.5 text-indigo-50 outline-none placeholder:text-indigo-300/55 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-500/25"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </>
      ) : null}
      {error ? <p className="rounded-lg border border-rose-400/40 bg-rose-950/45 px-3 py-2 text-sm text-rose-100">{error}</p> : null}
      {success ? <p className="rounded-lg border border-emerald-400/30 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">{success}</p> : null}
      <button className={authStyles.dark.primaryButton} disabled={loading}>
        {loading ? (otpSent ? 'Resetting password...' : 'Sending OTP...') : (otpSent ? 'Verify OTP and Reset Password' : 'Send Password Reset OTP')}
      </button>
      <p className="text-sm text-indigo-200/80">
        Remembered your password? <Link to="/login" className="text-cyan-300 hover:text-cyan-100">Back to login</Link>
      </p>
    </form>
  )
}

export const ResetPasswordPage = ForgotPasswordPage

export const RoleSelectionPage = () => (
  <AuthShell title="Choose Role" subtitle="Open the dashboard for your role">
    <div className="space-y-3">
      <Link to="/student/dashboard" className="block rounded-xl border border-indigo-400/35 bg-[#0f1735] p-3 text-indigo-50 hover:border-cyan-300 hover:bg-cyan-400/10">Student / Job Seeker</Link>
      <Link to="/recruiter/dashboard" className="block rounded-xl border border-indigo-400/35 bg-[#0f1735] p-3 text-indigo-50 hover:border-fuchsia-300 hover:bg-fuchsia-400/10">Recruiter / HR</Link>
    </div>
  </AuthShell>
)
