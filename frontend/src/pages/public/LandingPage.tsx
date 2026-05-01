import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleUserRound,
  ClipboardList,
  Compass,
  FileCheck2,
  GraduationCap,
  LogIn,
  LogOut,
  Moon,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
} from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppModal } from '../../components/ui'
import { BrandLogo } from '../../components/brandLogos'
import { authApi, dashboardPathByRole, publicApi } from '../../services/api'
import { LoginForm, RegisterForm } from '../auth/AuthPages'

const featureItems = [
  {
    icon: <FileCheck2 size={18} />,
    title: 'Resume upload and validation',
    description: 'Upload your resume, review the parsed details, and spot missing sections before you start applying.',
    href: '/student/upload-resume',
  },
  {
    icon: <Compass size={18} />,
    title: 'Field and role recommendations',
    description: 'Discover which domains and entry-level roles fit your education, skills, projects, and current direction.',
    href: '/student/profile',
  },
  {
    icon: <SearchCheck size={18} />,
    title: 'Job matching',
    description: 'Compare your profile against a target job description to understand fit, relevance, and next improvements.',
    href: '/student/job-match',
  },
  {
    icon: <Target size={18} />,
    title: 'Skill gap report',
    description: 'See the missing skills that matter most for your target role and which ones should be improved first.',
    href: '/student/skill-gap',
  },
  {
    icon: <ClipboardList size={18} />,
    title: 'Interview preparation',
    description: 'Generate domain-aware interview questions and focus on the weak topics most likely to affect your readiness.',
    href: '/student/interview-prep',
  },
  {
    icon: <CircleUserRound size={18} />,
    title: 'Mock interview practice',
    description: 'Practice with guided mock interviews, track attempts, and review feedback to build confidence over time.',
    href: '/student/mock-interview',
  },
]

const fieldCards = [
  { title: 'IT / Software', description: 'Frontend, backend, testing, cloud, and product-focused software roles.' },
  { title: 'Data / Analytics', description: 'Data analyst, business analyst, reporting, SQL, BI, and insight-driven roles.' },
  { title: 'Commerce / Finance', description: 'Accounting, finance operations, audit, business support, and analyst roles.' },
  { title: 'Mechanical', description: 'Production, design, quality, maintenance, and graduate trainee pathways.' },
  { title: 'Marketing', description: 'Digital marketing, brand support, content, campaign coordination, and growth roles.' },
  { title: 'General Fresher', description: 'Students still shaping their direction can start with broad readiness guidance first.' },
]

const useCases = [
  {
    title: 'Software student',
    description: 'Upload your resume, compare it with a backend role, identify missing skills like SQL or APIs, and practice role-based interview questions.',
  },
  {
    title: 'Commerce student',
    description: 'See whether your current profile fits finance and accounting roles, then improve your job readiness before applying.',
  },
  {
    title: 'Mechanical student',
    description: 'Explore whether your strengths align more with production, quality, maintenance, or design-oriented job paths.',
  },
  {
    title: 'General fresher',
    description: 'Build confidence step by step by completing your profile, uploading your resume, and practicing mock interviews.',
  },
]

const faqs = [
  {
    question: 'How does CareerCompass choose recommended roles?',
    answer: 'CareerCompass uses your profile, resume, strengths, skills, projects, and available report data to suggest domains and roles that fit your current readiness.',
  },
  {
    question: 'Does the platform support non-IT students?',
    answer: 'Yes. CareerCompass is designed for multiple student backgrounds, including software, data, commerce, marketing, mechanical, and general fresher paths.',
  },
  {
    question: 'Can I use it without a job description?',
    answer: 'Yes. You can begin with your profile and resume alone. Adding a job description later makes matching and skill gap analysis more specific.',
  },
  {
    question: 'What happens after I upload my resume?',
    answer: 'The platform checks your resume content, runs analysis, highlights strengths and weak areas, and connects that data to job matching and interview preparation.',
  },
  {
    question: 'How are skill gaps identified?',
    answer: 'Skill gaps are identified by comparing your current profile and resume evidence against the role direction or job requirements you are targeting.',
  },
]

const organizationStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'CareerCompass',
  description: 'CareerCompass helps students and job seekers improve profile quality, identify skill gaps, prepare for interviews, and explore suitable roles across multiple fields.',
  url: 'https://careercompass.local',
  applicationCategory: 'Career Development',
}

export const LandingPage = () => {
  const navigate = useNavigate()
  const [loginOpen, setLoginOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [session, setSession] = useState(() => authApi.getSession())
  const [contactForm, setContactForm] = useState({
    fullName: '',
    email: '',
    subject: '',
    message: '',
  })
  const [contactOpen, setContactOpen] = useState(false)
  const [contactError, setContactError] = useState('')
  const [contactSuccess, setContactSuccess] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode)
    setLoginOpen(true)
  }

  const goToDashboard = () => {
    if (session) navigate(dashboardPathByRole(session.user.role))
  }

  const logout = () => {
    authApi.logout()
    setSession(null)
    navigate('/')
  }

  const goToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const setContactField = (field: 'fullName' | 'email' | 'subject' | 'message', value: string) => {
    setContactForm((current) => ({ ...current, [field]: value }))
  }

  const submitContactForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContactError('')
    setContactSuccess('')

    if (!contactForm.fullName.trim()) {
      setContactError('Please enter your full name.')
      return
    }
    if (!contactForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email.trim())) {
      setContactError('Please enter a valid email address.')
      return
    }
    if (!contactForm.subject.trim()) {
      setContactError('Please enter a subject.')
      return
    }
    if (!contactForm.message.trim() || contactForm.message.trim().length < 10) {
      setContactError('Please enter a message with at least 10 characters.')
      return
    }

    try {
      setContactSubmitting(true)
      const result = await publicApi.submitContactRequest({
        fullName: contactForm.fullName.trim(),
        email: contactForm.email.trim(),
        subject: contactForm.subject.trim(),
        message: contactForm.message.trim(),
      })
      setContactSuccess(result.message)
      setContactForm({
        fullName: session?.user.name ?? '',
        email: session?.user.email ?? '',
        subject: '',
        message: '',
      })
      setContactOpen(false)
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'Unable to send your message right now.')
    } finally {
      setContactSubmitting(false)
    }
  }

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')
  }, [])

  useEffect(() => {
    let mounted = true

    const syncSession = async () => {
      const storedSession = authApi.getSession()
      if (!mounted) return

      if (!storedSession) {
        setSession(null)
        return
      }

      setSession(storedSession)

      try {
        const refreshed = await authApi.refreshSession()
        if (!mounted) return
        setSession(refreshed)
      } catch {
        if (!mounted) return
        setSession(authApi.getSession())
      }
    }

    const handleStorage = () => {
      void syncSession()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncSession()
      }
    }

    void syncSession()
    window.addEventListener('storage', handleStorage)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      mounted = false
      window.removeEventListener('storage', handleStorage)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    setContactForm((current) => ({
      ...current,
      fullName: current.fullName || session?.user.name || '',
      email: current.email || session?.user.email || '',
    }))
  }, [session])

  useEffect(() => {
    document.title = 'CareerCompass | Career Guidance, Skill Gap Analysis, Job Matching, Interview Preparation'
    const ensureMeta = (name: string, content: string) => {
      let element = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
      if (!element) {
        element = document.createElement('meta')
        element.name = name
        document.head.appendChild(element)
      }
      element.content = content
    }
    ensureMeta(
      'description',
      'CareerCompass helps students and job seekers improve resume quality, explore suitable roles, identify skill gaps, prepare for interviews, and track job readiness across multiple fields.',
    )

    const scriptId = 'careercompass-org-schema'
    const previous = document.getElementById(scriptId)
    if (previous) previous.remove()
    const script = document.createElement('script')
    script.id = scriptId
    script.type = 'application/ld+json'
    script.text = JSON.stringify(organizationStructuredData)
    document.head.appendChild(script)

    return () => {
      document.getElementById(scriptId)?.remove()
    }
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    localStorage.setItem('interview-prep-theme', nextTheme)
  }

  return (
    <div className="landing-root min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.22),transparent_28%),linear-gradient(180deg,#060914,#0d1535)] text-indigo-50">
      <header className="landing-header border-t border-indigo-300/35">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5">
          <div className="landing-brand rounded-full border border-indigo-400/40 bg-[#121a38]/85 px-4 py-2">
            <BrandLogo compact />
          </div>
          <nav className="hidden items-center gap-5 text-sm text-slate-300 lg:flex">
            <button onClick={() => goToSection('how-it-works')} className="hover:text-white">How it works</button>
            <button onClick={() => goToSection('features')} className="hover:text-white">Features</button>
            <button onClick={() => goToSection('domains')} className="hover:text-white">Fields supported</button>
            <button onClick={() => goToSection('faq')} className="hover:text-white">FAQ</button>
            <button onClick={() => setContactOpen(true)} className="hover:text-white">Contact</button>
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle dark and light theme"
              className="theme-toggle rounded-full border border-indigo-300/45 bg-[#121a38]/85 p-1"
            >
              <span className={`theme-toggle-thumb ${theme === 'light' ? 'translate-x-6' : 'translate-x-0'}`}>
                {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />}
              </span>
            </button>
            {session ? (
              <>
                <button onClick={goToDashboard} className="app-primary-button rounded-xl px-4 py-2 text-sm font-semibold">Get Started</button>
                <button onClick={logout} className="app-logout-button inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => openAuth('login')}
                className="landing-login-button inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold"
              >
                <span className="landing-login-button-icon inline-flex h-7 w-7 items-center justify-center rounded-full">
                  <LogIn size={15} />
                </span>
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_0.95fr] md:py-14">
          <div>
            <span className="landing-chip inline-flex items-center gap-2 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 px-3 py-1 text-xs font-semibold text-fuchsia-100">
              <Sparkles size={14} /> Career guidance, skill improvement, job matching, and interview preparation in one place
            </span>
            <h1 className="landing-title mt-4 text-4xl font-bold leading-tight text-white md:text-5xl">
              CareerCompass helps students understand where they fit and what to improve next.
            </h1>
            <p className="landing-copy mt-4 max-w-3xl text-slate-300">
              Build your profile, upload your resume, explore suitable roles, identify skill gaps, prepare for interviews, and track job readiness across multiple domains, not only IT.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {session ? (
                <>
                  <Link to="/student/upload-resume" className="app-primary-button rounded-xl px-4 py-2 text-sm font-semibold">
                    Upload Resume
                  </Link>
                  <button onClick={() => goToSection('how-it-works')} className="landing-header-action rounded-xl border border-indigo-300/45 px-4 py-2 text-sm text-indigo-100">
                    See How It Works
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => openAuth('register')} className="app-primary-button rounded-xl px-4 py-2 text-sm font-semibold">
                    Get Started
                  </button>
                  <button onClick={() => goToSection('how-it-works')} className="landing-header-action rounded-xl border border-indigo-300/45 px-4 py-2 text-sm text-indigo-100">
                    See How It Works
                  </button>
                </>
              )}
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="landing-stat rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-4">
                <p className="landing-stat-value text-lg font-semibold text-white">Profile to role clarity</p>
                <p className="landing-stat-label mt-2 text-xs text-slate-400">Understand which roles fit your current skills, education, and project evidence.</p>
              </div>
              <div className="landing-stat rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-4">
                <p className="landing-stat-value text-lg font-semibold text-white">Field-aware preparation</p>
                <p className="landing-stat-label mt-2 text-xs text-slate-400">CareerCompass supports students from software, data, finance, marketing, mechanical, and general fresher paths.</p>
              </div>
              <div className="landing-stat rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-4">
                <p className="landing-stat-value text-lg font-semibold text-white">Actionable next steps</p>
                <p className="landing-stat-label mt-2 text-xs text-slate-400">Find the missing skills, weak topics, and practical steps that improve readiness.</p>
              </div>
            </div>
          </div>

          <div className="landing-panel rounded-2xl border border-indigo-400/35 bg-[#121a38]/85 p-6 shadow-sm">
            <p className="landing-kicker text-sm font-semibold text-cyan-200">What CareerCompass is for</p>
            <h2 className="landing-panel-title mt-2 text-2xl font-semibold text-white">A practical dashboard for early-career decisions</h2>
            <p className="landing-panel-copy mt-3 text-sm text-slate-400">
              CareerCompass is built for students and freshers who need clear direction, better preparation, and more confidence before applying to jobs or internships.
            </p>
            <div className="mt-5 space-y-3">
              {[
                'Know which roles fit your current profile.',
                'See missing skills before you apply.',
                'Prepare with field-aware interview questions and mock practice.',
                'Track progress through reports instead of guessing.',
              ].map((item) => (
                <div key={item} className="landing-purpose-item rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
                  {item}
                </div>
              ))}
            </div>
            <div className="landing-note mt-5 rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-3 text-sm text-cyan-100">
              <BadgeCheck className="mb-1" size={16} /> Useful for first-time users who are still discovering their direction and returning users who want to improve readiness step by step.
            </div>
          </div>
        </section>

        <section id="trust" className="mx-auto max-w-7xl px-4 py-6">
          <div className="landing-panel rounded-2xl border border-indigo-400/35 bg-[#121a38]/85 p-6 shadow-sm">
            <h2 className="landing-section-title text-2xl font-semibold text-white">Who CareerCompass helps</h2>
            <p className="landing-copy mt-3 text-slate-300">
              CareerCompass is designed for students and job seekers who want a clearer path from profile building to job readiness. It supports engineering students, commerce students, marketing learners, domain-switchers, and general freshers. The platform does not assume every user is preparing only for software jobs.
            </p>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="landing-section-title text-2xl font-semibold text-white">How CareerCompass works</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            {[
              'Create your profile',
              'Upload your resume',
              'Discover your best-fit roles',
              'Find skill gaps',
              'Prepare with interviews and mock tests',
            ].map((step, index) => (
              <div key={step} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-4 shadow-sm">
                <span className="app-primary-button inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <h3 className="landing-panel-title mt-3 font-semibold text-white">{step}</h3>
                <p className="landing-panel-copy mt-2 text-sm text-slate-400">
                  {index === 0 && 'Add your education, interests, preferred roles, and core strengths.'}
                  {index === 1 && 'Use your latest resume so the platform can analyze and personalize recommendations.'}
                  {index === 2 && 'Understand which roles are realistic now and which ones need improvement first.'}
                  {index === 3 && 'Spot the most important missing skills before applying for jobs or internships.'}
                  {index === 4 && 'Use question sets, mock interviews, and reports to practice more confidently.'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="landing-section-title text-2xl font-semibold text-white">Core features explained clearly</h2>
              <p className="landing-copy mt-2 text-slate-300">Each feature connects to a practical step in the student journey instead of acting like a disconnected tool.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featureItems.map((item) => (
              <div key={item.title} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-5 shadow-sm">
                <div className="landing-feature-icon inline-flex rounded-xl p-2">{item.icon}</div>
                <h3 className="landing-panel-title mt-4 font-semibold text-white">{item.title}</h3>
                <p className="landing-panel-copy mt-2 text-sm text-slate-400">{item.description}</p>
                <Link to={item.href} className="mt-4 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                  Open related page
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section id="domains" className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="landing-section-title text-2xl font-semibold text-white">Multi-domain support for different student backgrounds</h2>
          <p className="landing-copy mt-2 max-w-4xl text-slate-300">
            Students do not all start from the same field. CareerCompass keeps recommendations, job-fit guidance, and interview preparation more relevant by supporting multiple pathways.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {fieldCards.map((field) => (
              <div key={field.title} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-4 shadow-sm">
                <h3 className="landing-panel-title font-semibold text-white">{field.title}</h3>
                <p className="landing-panel-copy mt-2 text-sm text-slate-400">{field.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="landing-section-title text-2xl font-semibold text-white">Practical benefits for users</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[
              'Understand which roles fit your profile.',
              'Identify missing skills before applying.',
              'Practice interview questions relevant to your field.',
              'Track improvement across reports and mock attempts.',
              'Prepare more confidently for jobs and internships.',
            ].map((item) => (
              <div key={item} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-4 shadow-sm">
                <p className="landing-panel-copy text-sm text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="landing-section-title text-2xl font-semibold text-white">Example use cases</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {useCases.map((item) => (
              <div key={item.title} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-5 shadow-sm">
                <h3 className="landing-panel-title font-semibold text-white">{item.title}</h3>
                <p className="landing-panel-copy mt-2 text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="landing-section-title text-2xl font-semibold text-white">Product proof</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <BriefcaseBusiness className="text-emerald-300" />,
                title: 'Personalized reports',
                description: 'Resume analysis, job matching, and progress reports connect your work across the platform.',
              },
              {
                icon: <GraduationCap className="text-blue-300" />,
                title: 'Field-aware recommendations',
                description: 'Role suggestions take your background into account instead of forcing one generic path for every student.',
              },
              {
                icon: <ShieldCheck className="text-violet-300" />,
                title: 'Structured interview preparation',
                description: 'Interview preparation and mock practice help you work on weak topics in a more organized way.',
              },
            ].map((item) => (
              <div key={item.title} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-5 shadow-sm">
                {item.icon}
                <h3 className="landing-panel-title mt-3 font-semibold text-white">{item.title}</h3>
                <p className="landing-panel-copy mt-2 text-sm text-slate-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-7xl px-4 py-8">
          <h2 className="landing-section-title text-2xl font-semibold text-white">Frequently asked questions</h2>
          <div className="mt-4 space-y-4">
            {faqs.map((item) => (
              <div key={item.question} className="landing-panel rounded-xl border border-indigo-400/35 bg-[#121a38]/85 p-5 shadow-sm">
                <h3 className="landing-panel-title font-semibold text-white">{item.question}</h3>
                <p className="landing-panel-copy mt-2 text-sm text-slate-400">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="landing-cta rounded-2xl border p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-3xl">
                <p className="landing-cta-copy text-sm text-white">Start with one clear step</p>
                <h2 className="landing-cta-title text-2xl font-bold text-white">Upload your resume and explore your career path with field-aware guidance.</h2>
                <p className="mt-2 text-sm text-white/90">
                  Build your job-ready profile, review your skill gaps, practice smarter, and track improvement over time.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to="/student/upload-resume" className="landing-cta-primary rounded-xl px-4 py-2 text-sm font-semibold transition">
                  Upload Resume
                </Link>
                <Link to="/student/profile" className="landing-cta-secondary rounded-xl px-4 py-2 text-sm font-semibold transition">
                  Build Your Profile
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer mt-8 border-t border-indigo-500/25 bg-[#070b1a]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="font-semibold text-white">About CareerCompass</p>
            <p className="mt-2 text-sm text-indigo-200/75">
              CareerCompass helps students and job seekers understand where they fit, what to improve next, and how to prepare more confidently for internships and jobs.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Explore</p>
            <div className="mt-2 grid gap-2 text-sm text-indigo-200/75">
              <Link to="/student/upload-resume">Upload Resume</Link>
              <Link to="/student/skill-gap">Skill Gap Report</Link>
              <Link to="/student/interview-prep">Interview Preparation</Link>
              <Link to="/student/mock-interview">Mock Interview</Link>
              <Link to="/student/reports">My Reports</Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white">Support and trust</p>
            <div className="mt-2 grid gap-2 text-sm text-indigo-200/75">
              <a href="mailto:rahulkar849@gmail.com">rahulkar849@gmail.com</a>
              <button type="button" onClick={() => setContactOpen(true)} className="w-fit text-left">Contact us</button>
              <a href="#trust">Who this platform is for</a>
              <a href="#faq">Common questions</a>
              <span>Use the platform with your latest resume for better personalization.</span>
            </div>
          </div>
        </div>
      </footer>

      <AppModal
        open={contactOpen}
        title="Contact Us"
        onClose={() => setContactOpen(false)}
        panelClassName="max-w-xl border border-indigo-400/45 bg-[#121a38] text-indigo-50"
        headerClassName="border-b border-indigo-400/25 px-5 py-4"
        titleClassName="text-indigo-100"
        closeClassName="rounded-lg border border-indigo-400/45 p-1 text-indigo-200 hover:bg-indigo-500/20 hover:text-indigo-50"
      >
        <form onSubmit={(event) => void submitContactForm(event)} className="space-y-4 p-5">
          <p className="text-sm text-slate-300">Send your message directly to <a href="mailto:rahulkar849@gmail.com" className="font-medium text-cyan-300 hover:text-cyan-200">rahulkar849@gmail.com</a>.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Full name</label>
              <input
                value={contactForm.fullName}
                onChange={(event) => setContactField('fullName', event.target.value)}
                className="w-full rounded-xl border border-indigo-300/20 bg-slate-950/35 px-3.5 py-2 text-sm text-white outline-none transition focus:border-cyan-300/50"
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(event) => setContactField('email', event.target.value)}
                className="w-full rounded-xl border border-indigo-300/20 bg-slate-950/35 px-3.5 py-2 text-sm text-white outline-none transition focus:border-cyan-300/50"
                placeholder="Enter your email"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-200">Subject</label>
              <input
                value={contactForm.subject}
                onChange={(event) => setContactField('subject', event.target.value)}
                className="w-full rounded-xl border border-indigo-300/20 bg-slate-950/35 px-3.5 py-2 text-sm text-white outline-none transition focus:border-cyan-300/50"
                placeholder="What would you like to discuss?"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-200">Message</label>
              <textarea
                value={contactForm.message}
                onChange={(event) => setContactField('message', event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-indigo-300/20 bg-slate-950/35 px-3.5 py-2 text-sm text-white outline-none transition focus:border-cyan-300/50"
                placeholder="Write your question, support request, or feedback here."
              />
            </div>
          </div>
          {contactError ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{contactError}</p> : null}
          {contactSuccess ? <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{contactSuccess}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">All fields are required.</p>
            <button
              type="submit"
              disabled={contactSubmitting}
              className="app-primary-button rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {contactSubmitting ? 'Sending...' : 'Submit Message'}
            </button>
          </div>
        </form>
      </AppModal>

      <AppModal
        open={loginOpen}
        title={authMode === 'login' ? 'Login' : 'Sign up'}
        onClose={() => setLoginOpen(false)}
        panelClassName={theme === 'light'
          ? 'landing-auth-modal-light max-w-2xl border text-slate-700'
          : 'landing-auth-modal-dark max-w-2xl border text-indigo-50'}
        headerClassName={theme === 'light'
          ? 'landing-auth-modal-light-header px-5 py-4'
          : 'landing-auth-modal-dark-header px-5 py-4'}
        titleClassName={theme === 'light' ? 'text-slate-700' : 'text-indigo-100'}
        closeClassName={theme === 'light'
          ? 'rounded-lg border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          : 'rounded-lg border border-indigo-400/45 p-1 text-indigo-200 hover:bg-indigo-500/20 hover:text-indigo-50'}
        bodyClassName="overflow-y-auto"
      >
        <div className={theme === 'light' ? 'landing-auth-modal-light-body p-4 sm:p-5' : 'landing-auth-modal-dark-body p-4 sm:p-5'}>
          <div className={theme === 'light'
            ? 'landing-auth-switcher-light mb-5 grid grid-cols-2 rounded-xl p-1'
            : 'landing-auth-switcher-dark mb-5 grid grid-cols-2 rounded-xl p-1'}>
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                authMode === 'login'
                  ? theme === 'light'
                    ? 'landing-auth-switcher-light-active'
                    : 'landing-auth-switcher-dark-active'
                  : theme === 'light'
                    ? 'landing-auth-switcher-light-idle'
                    : 'landing-auth-switcher-dark-idle'
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('register')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                authMode === 'register'
                  ? theme === 'light'
                    ? 'landing-auth-switcher-light-active'
                    : 'landing-auth-switcher-dark-active'
                  : theme === 'light'
                    ? 'landing-auth-switcher-light-idle'
                    : 'landing-auth-switcher-dark-idle'
              }`}
            >
              Sign up
            </button>
          </div>
          {authMode === 'login' ? (
            <div className="space-y-3">
              <LoginForm showLinks={false} variant={theme === 'light' ? 'light' : 'dark'} onSuccess={() => { setLoginOpen(false); setSession(authApi.getSession()) }} navigateWithReload />
              <div className={`flex justify-between text-sm ${theme === 'light' ? 'text-slate-500' : 'text-indigo-200/80'}`}>
                <Link
                  to="/forgot-password"
                  className={theme === 'light' ? 'text-orange-600 hover:text-orange-500' : 'text-cyan-300 hover:text-cyan-100'}
                  onClick={() => setLoginOpen(false)}
                >
                  Forgot password?
                </Link>
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={theme === 'light' ? 'text-orange-600 hover:text-orange-500' : 'text-cyan-300 hover:text-cyan-100'}
                >
                  Register
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <RegisterForm showLoginLink={false} variant={theme === 'light' ? 'light' : 'dark'} onSuccess={() => { setLoginOpen(false); setSession(authApi.getSession()) }} navigateWithReload />
            </div>
          )}
        </div>
      </AppModal>
    </div>
  )
}
