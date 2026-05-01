import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AppModal, AppSelect, Card, PageHeader, ProgressBar, StatCards, TrendChart } from '../../components/ui'
import { authApi, recruiterApi } from '../../services/api'

type ApiRecord = Record<string, any>

type RecruiterJobForm = {
  title: string
  company: string
  location: string
  employmentType: string
  opportunityType: string
  domain: string
  roleLabel: string
  experienceLevel: string
  requiredSkills: string
  optionalSkills: string
  description: string
  salaryRange: string
  applyLink: string
  deadline: string
  status: 'active' | 'inactive'
}

type CompanyForm = {
  phone: string
  company: string
  designation: string
  companyWebsite: string
  companyDescription: string
  companyLocation: string
  hiringDomains: string
  companySize: string
  companyLogo: string
  hiringFor: string
}

type RecruiterPreferences = {
  emailNotifications: boolean
  candidateAlerts: boolean
  weeklySummary: boolean
  contactByEmail: boolean
  contactByPhone: boolean
  defaultCandidateView: 'matches' | 'saved'
  reminderFrequency: 'daily' | 'weekly' | 'off'
}

type RecruiterInterviewQuestionForm = {
  role: string
  domain: string
  roundType: string
  difficulty: string
  topic: string
  questionText: string
  answerHint: string
  keyPoints: string
  tags: string
}

type RecruiterCodingQuestionForm = {
  domain: string
  role: string
  topic: string
  difficulty: string
  title: string
  problemStatement: string
  inputFormat: string
  outputFormat: string
  constraints: string
  sampleInput: string
  sampleOutput: string
  explanation: string
  supportedLanguages: string
  timeLimit: string
  visibleTestCases: string
  hiddenTestCases: string
  tags: string
}

const recruiterSelectClassName = 'w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2'
const textInputClassName = 'w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2'
const textAreaClassName = 'min-h-28 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2'
const recruiterPrimaryButtonClassName = 'app-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const recruiterCompactPrimaryButtonClassName = 'app-primary-button rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const recruiterSecondaryButtonClassName = 'admin-subtle-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const recruiterCompactSecondaryButtonClassName = 'admin-subtle-button rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const recruiterDangerButtonClassName = 'app-danger-button rounded-xl px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const defaultJobForm: RecruiterJobForm = {
  title: '',
  company: '',
  location: '',
  employmentType: 'full-time',
  opportunityType: 'full-time',
  domain: '',
  roleLabel: '',
  experienceLevel: '',
  requiredSkills: '',
  optionalSkills: '',
  description: '',
  salaryRange: '',
  applyLink: '',
  deadline: '',
  status: 'active',
}
const defaultCompanyForm: CompanyForm = {
  phone: '',
  company: '',
  designation: '',
  companyWebsite: '',
  companyDescription: '',
  companyLocation: '',
  hiringDomains: '',
  companySize: '',
  companyLogo: '',
  hiringFor: '',
}
const defaultPreferences: RecruiterPreferences = {
  emailNotifications: true,
  candidateAlerts: true,
  weeklySummary: true,
  contactByEmail: true,
  contactByPhone: false,
  defaultCandidateView: 'matches',
  reminderFrequency: 'weekly',
}
const defaultInterviewQuestionForm: RecruiterInterviewQuestionForm = {
  role: '',
  domain: 'it_software',
  roundType: 'technical',
  difficulty: 'Intermediate',
  topic: '',
  questionText: '',
  answerHint: '',
  keyPoints: '',
  tags: '',
}
const defaultCodingQuestionForm: RecruiterCodingQuestionForm = {
  domain: 'it_software',
  role: '',
  topic: '',
  difficulty: 'Intermediate',
  title: '',
  problemStatement: '',
  inputFormat: '',
  outputFormat: '',
  constraints: '',
  sampleInput: '',
  sampleOutput: '',
  explanation: '',
  supportedLanguages: 'python,javascript',
  timeLimit: '2',
  visibleTestCases: '[{"input":"","output":"","explanation":""}]',
  hiddenTestCases: '[]',
  tags: '',
}

const asId = (row: ApiRecord) => String(row._id ?? row.id ?? '')
const parseList = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const monthKey = (value?: string) => (value ? new Date(value).toLocaleDateString(undefined, { month: 'short' }) : 'Unknown')
const recruiterPreferenceKey = (userId: string) => `career-compass-recruiter-settings:${userId}`
const codingRolePattern = /developer|engineer|software|frontend|backend|full.?stack|web|mobile|app|qa|test automation|sdet|data|analytics|analyst|bi|sql|python|java|javascript|react|node|devops|cloud|api/i

const isCodingRelevantForJob = (job?: ApiRecord | null) => {
  const domain = String(job?.domain ?? '').trim().toLowerCase()
  const role = String(job?.roleLabel ?? job?.title ?? '').trim()
  if (domain === 'it_software') return true
  if (domain === 'data_analytics') return /sql|python|analyst|analytics|bi/i.test(role.toLowerCase())
  return codingRolePattern.test(role)
}

const formatRoundStatusLabel = (status: string) => {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'assigned') return 'Assigned to student'
  if (normalized === 'started' || normalized === 'in_progress') return 'Student started'
  if (normalized === 'completed') return 'Completed and ready for review'
  if (normalized === 'reviewed') return 'Reviewed'
  return normalized ? normalized.replace(/_/g, ' ') : 'Assigned'
}

const summarizeRoundResult = (round: ApiRecord) => {
  const score = Number(round.resultSummary?.score ?? round.sessionSummary?.score ?? 0)
  const passed = Number(round.resultSummary?.passedCount ?? round.sessionSummary?.passedCount ?? 0)
  const total = Number(round.resultSummary?.totalCount ?? round.sessionSummary?.totalCount ?? 0)
  const language = String(round.resultSummary?.selectedLanguage ?? round.sessionSummary?.selectedLanguage ?? '').trim()
  const timeTakenSec = Number(round.resultSummary?.timeTakenSec ?? round.sessionSummary?.timeTakenSec ?? 0)
  return {
    score,
    passed,
    total,
    language,
    timeTakenSec,
    strengths: Array.isArray(round.resultSummary?.strengths) ? round.resultSummary.strengths : [],
    weakPoints: Array.isArray(round.resultSummary?.weakPoints) ? round.resultSummary.weakPoints : [],
    summary: String(round.resultSummary?.summary ?? round.sessionSummary?.summary ?? '').trim(),
    answers: Array.isArray(round.sessionSummary?.answers) ? round.sessionSummary.answers : [],
    submittedCode: String(round.sessionSummary?.submittedCode ?? ''),
  }
}

const normalizeJobForm = (job?: ApiRecord | null): RecruiterJobForm => ({
  title: String(job?.title ?? ''),
  company: String(job?.company ?? ''),
  location: String(job?.location ?? ''),
  employmentType: String(job?.employmentType ?? 'full-time'),
  opportunityType: String(job?.opportunityType ?? job?.employmentType ?? 'full-time'),
  domain: String(job?.domain ?? ''),
  roleLabel: String(job?.roleLabel ?? ''),
  experienceLevel: String(job?.experienceLevel ?? ''),
  requiredSkills: Array.isArray(job?.requiredSkills) ? job.requiredSkills.join(', ') : '',
  optionalSkills: Array.isArray(job?.optionalSkills) ? job.optionalSkills.join(', ') : '',
  description: String(job?.description ?? job?.descriptionText ?? ''),
  salaryRange: String(job?.salaryRange ?? ''),
  applyLink: String(job?.applyLink ?? ''),
  deadline: String(job?.deadline ?? '').slice(0, 10),
  status: String(job?.status ?? 'active') === 'inactive' ? 'inactive' : 'active',
})

const normalizeCompanyForm = (profile?: ApiRecord | null): CompanyForm => ({
  phone: String(profile?.phone ?? ''),
  company: String(profile?.company ?? ''),
  designation: String(profile?.designation ?? ''),
  companyWebsite: String(profile?.companyWebsite ?? ''),
  companyDescription: String(profile?.companyDescription ?? ''),
  companyLocation: String(profile?.companyLocation ?? ''),
  hiringDomains: Array.isArray(profile?.hiringDomains) ? profile.hiringDomains.join(', ') : '',
  companySize: String(profile?.companySize ?? ''),
  companyLogo: String(profile?.companyLogo ?? ''),
  hiringFor: Array.isArray(profile?.hiringFor) ? profile.hiringFor.join(', ') : '',
})

const buildJobPayload = (form: RecruiterJobForm) => ({
  title: form.title.trim(),
  company: form.company.trim(),
  location: form.location.trim(),
  employmentType: form.employmentType.trim(),
  opportunityType: form.opportunityType.trim(),
  domain: form.domain.trim(),
  roleLabel: form.roleLabel.trim(),
  experienceLevel: form.experienceLevel.trim(),
  requiredSkills: parseList(form.requiredSkills),
  optionalSkills: parseList(form.optionalSkills),
  description: form.description.trim(),
  salaryRange: form.salaryRange.trim(),
  applyLink: form.applyLink.trim(),
  deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
  status: form.status,
})

const buildCompanyPayload = (form: CompanyForm) => ({
  phone: form.phone.trim(),
  company: form.company.trim(),
  designation: form.designation.trim(),
  companyWebsite: form.companyWebsite.trim(),
  companyDescription: form.companyDescription.trim(),
  companyLocation: form.companyLocation.trim(),
  hiringDomains: parseList(form.hiringDomains),
  companySize: form.companySize.trim(),
  companyLogo: form.companyLogo.trim(),
  hiringFor: parseList(form.hiringFor),
})

const parseJsonArray = (value: string) => {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const toggleClassName = 'rounded-full border px-3 py-1.5 text-xs font-semibold transition'

const SectionTitle = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="mb-4">
    <h3 className="text-base font-semibold text-white">{title}</h3>
    <p className="text-sm text-slate-400">{subtitle}</p>
  </div>
)

const FieldLabel = ({ children }: { children: string }) => <label className="mb-2 block text-sm font-medium text-slate-200">{children}</label>

const RecruiterToggle = ({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string
  helper: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex w-full items-start justify-between gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4 text-left transition hover:border-slate-500"
  >
    <div>
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs text-slate-400">{helper}</p>
    </div>
    <span className={`mt-1 inline-flex h-6 w-11 rounded-full p-1 transition ${checked ? 'bg-orange-500/80' : 'bg-slate-700'}`}>
      <span className={`h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </span>
  </button>
)

export const RecruiterAccessStatusPage = () => {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status') ?? 'pending'
  const incomingMessage = (location.state as { message?: string } | null)?.message
  const content = status === 'rejected'
    ? {
        title: 'Recruiter access is restricted',
        body: incomingMessage ?? 'Your recruiter request was not approved. Recruiter tools stay locked until an administrator changes the account status.',
        tone: 'border-rose-500/30 bg-rose-950/20 text-rose-100',
      }
    : {
        title: 'Recruiter approval is pending',
        body: incomingMessage ?? 'Your recruiter request is waiting for admin approval. You can log in after the account is approved.',
        tone: 'border-amber-500/30 bg-amber-950/20 text-amber-100',
      }

  return (
    <div className="auth-root recruiter-theme grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-xl p-8">
        <h1 className="text-2xl font-semibold text-white">{content.title}</h1>
        <p className={`mt-4 rounded-2xl border px-4 py-4 text-sm ${content.tone}`}>{content.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/login" className={recruiterPrimaryButtonClassName}>Back to login</Link>
          <Link to="/register" className={recruiterSecondaryButtonClassName}>Open registration</Link>
        </div>
      </Card>
    </div>
  )
}

export const RecruiterDashboardPage = () => {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<ApiRecord[]>([])
  const [applications, setApplications] = useState<ApiRecord[]>([])
  const [savedCandidates, setSavedCandidates] = useState<ApiRecord[]>([])
  const [profile, setProfile] = useState<ApiRecord | null>(null)

  useEffect(() => {
    void Promise.all([
      recruiterApi.listJobs(),
      recruiterApi.listApplications(),
      recruiterApi.listShortlisted(),
      recruiterApi.getProfile(),
    ]).then(([jobRows, applicationRows, savedRows, profileRow]) => {
      setJobs(jobRows)
      setApplications(applicationRows)
      setSavedCandidates(savedRows)
      setProfile(profileRow)
    })
  }, [])

  const stats = [
    { label: 'Active job listings', value: String(jobs.filter((job) => String(job.status ?? 'active') !== 'inactive').length) },
    { label: 'Applications received', value: String(applications.length) },
    { label: 'Saved candidates', value: String(savedCandidates.length) },
    { label: 'Company profile completion', value: `${Math.round((['company', 'designation', 'companyWebsite', 'companyDescription', 'companyLocation'].filter((key) => String(profile?.[key] ?? '').trim()).length / 5) * 100) || 0}%` },
  ]

  const trendMap = applications.reduce<Record<string, { name: string; value: number; secondary: number }>>((acc, row) => {
    const key = monthKey(String(row.createdAt ?? ''))
    if (!acc[key]) acc[key] = { name: key, value: 0, secondary: 0 }
    acc[key].value += Number(row.assignedRounds?.find((item: ApiRecord) => item.resultSummary?.score)?.resultSummary?.score ?? 0)
    acc[key].secondary += 1
    return acc
  }, {})
  const trendData = Object.values(trendMap).map((item) => ({
    ...item,
    value: Math.round(item.value / Math.max(item.secondary, 1)),
  }))
  const recentJobs = jobs.slice(0, 3)
  const recentActivity = [
    ...recentJobs.map((job) => ({
      id: `job-${asId(job)}`,
      title: `Job updated: ${String(job.title ?? 'Untitled role')}`,
      body: `${String(job.status ?? 'active').toUpperCase()} | ${String(job.location ?? 'Location pending')}`,
      date: String(job.updatedAt ?? job.createdAt ?? ''),
    })),
    ...applications.slice(0, 3).map((application) => ({
      id: `application-${asId(application)}`,
      title: `Application received: ${String(application.student?.name ?? 'Student')}`,
      body: `${String(application.job?.title ?? 'Job')} | ${String(application.status ?? 'applied')}`,
      date: String(application.createdAt ?? application.appliedAt ?? ''),
    })),
  ].slice(0, 5)
  const notifications = [
    {
      id: 'jobs',
      label: jobs.length ? `${applications.filter((item) => ['applied', 'under_review'].includes(String(item.status ?? ''))).length} applications need review` : 'No jobs posted yet',
      helper: jobs.length ? 'Review fresh applications and assign the next round from the Candidates page.' : 'Create the first job to start receiving applications.',
    },
    {
      id: 'saved',
      label: `${applications.filter((item) => ['interview_assigned', 'coding_round_assigned'].includes(String(item.status ?? ''))).length} assigned rounds in progress`,
      helper: applications.length ? 'Watch for completed interview and coding rounds that are ready for review.' : 'Candidate round updates will appear here after students start applying.',
    },
  ]

  return (
    <div className="recruiter-theme space-y-5">
      <PageHeader
        title="Recruiter Dashboard"
        subtitle="Keep hiring activity organized with one clear summary page."
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/recruiter/jobs')} className={recruiterPrimaryButtonClassName}>Post new job</button>
            <button type="button" onClick={() => navigate('/recruiter/candidates')} className={recruiterSecondaryButtonClassName}>View candidates</button>
          </div>
        )}
      />
      <StatCards stats={stats} />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
        <TrendChart data={trendData.length ? trendData : [{ name: 'Now', value: 0, secondary: 0 }]} />
        <Card className="space-y-4">
          <SectionTitle title="Quick actions" subtitle="Jump into the most common recruiter work." />
          <button type="button" onClick={() => navigate('/recruiter/jobs')} className="w-full rounded-2xl border border-slate-700 px-4 py-4 text-left transition hover:border-slate-500">
            <p className="text-sm font-semibold text-white">Manage jobs</p>
            <p className="mt-1 text-xs text-slate-400">Create roles, update status, and keep listings current.</p>
          </button>
          <button type="button" onClick={() => navigate('/recruiter/candidates')} className="w-full rounded-2xl border border-slate-700 px-4 py-4 text-left transition hover:border-slate-500">
            <p className="text-sm font-semibold text-white">Review candidate matches</p>
            <p className="mt-1 text-xs text-slate-400">Filter fit scores, save strong profiles, and open details.</p>
          </button>
          <button type="button" onClick={() => navigate('/recruiter/company')} className="w-full rounded-2xl border border-slate-700 px-4 py-4 text-left transition hover:border-slate-500">
            <p className="text-sm font-semibold text-white">Update company profile</p>
            <p className="mt-1 text-xs text-slate-400">Keep brand, domains, and recruiter contact details accurate.</p>
          </button>
        </Card>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Recent notifications" subtitle="Small operational reminders without extra clutter." />
          <div className="space-y-3">
            {notifications.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-4">
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="mt-1 text-xs text-slate-400">{item.helper}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Recent activity" subtitle="A concise view of the latest recruiter work." />
          <div className="space-y-3">
            {recentActivity.length ? recentActivity.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-4">
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-400">{item.body}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">{item.date ? new Date(item.date).toLocaleString() : 'Just now'}</p>
              </div>
            )) : <p className="text-sm text-slate-400">Recruiter activity will appear here once you start posting jobs and reviewing candidates.</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}

export const RecruiterJobsPage = () => {
  const [jobs, setJobs] = useState<ApiRecord[]>([])
  const [profile, setProfile] = useState<ApiRecord | null>(null)
  const [applications, setApplications] = useState<ApiRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [jobForm, setJobForm] = useState<RecruiterJobForm>(defaultJobForm)
  const [editingJobId, setEditingJobId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadData = async () => {
    const [jobRows, profileRow, applicationRows] = await Promise.all([
      recruiterApi.listJobs(),
      recruiterApi.getProfile(),
      recruiterApi.listApplications(),
    ])
    setJobs(jobRows)
    setProfile(profileRow)
    setApplications(applicationRows)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const search = `${job.title ?? ''} ${job.company ?? ''} ${job.domain ?? ''} ${job.roleLabel ?? ''} ${job.location ?? ''}`.toLowerCase()
    const matchesQuery = !query.trim() || search.includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || String(job.status ?? 'active') === statusFilter
    return matchesQuery && matchesStatus
  }), [jobs, query, statusFilter])

  const startCreate = () => {
    setEditingJobId('')
    setJobForm({
      ...defaultJobForm,
      company: String(profile?.company ?? ''),
    })
    setModalOpen(true)
    setMessage('')
  }

  const startEdit = (job: ApiRecord) => {
    setEditingJobId(asId(job))
    setJobForm(normalizeJobForm(job))
    setModalOpen(true)
    setMessage('')
  }

  const saveJob = async () => {
    if (!jobForm.title.trim() || !jobForm.company.trim() || !jobForm.description.trim()) {
      setMessage('Title, company, and job description are required.')
      return
    }
    try {
      setSaving(true)
      setMessage('')
      const payload = buildJobPayload(jobForm)
      if (editingJobId) {
        await recruiterApi.updateJob(editingJobId, payload)
      } else {
        await recruiterApi.createJob(payload)
      }
      await loadData()
      setModalOpen(false)
      setJobForm(defaultJobForm)
      setEditingJobId('')
      setMessage('Job saved successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the job right now.')
    } finally {
      setSaving(false)
    }
  }

  const toggleJobStatus = async (job: ApiRecord) => {
    await recruiterApi.updateJob(asId(job), { status: String(job.status ?? 'active') === 'inactive' ? 'active' : 'inactive' })
    await loadData()
  }

  const removeJob = async (job: ApiRecord) => {
    if (!window.confirm(`Delete "${String(job.title ?? 'this job')}"?`)) return
    await recruiterApi.deleteJob(asId(job))
    await loadData()
  }

  const applicantCount = (jobId: string) => applications.filter((application) => String(application.job?.id ?? application.jobId ?? '') === jobId).length

  return (
    <div className="recruiter-theme space-y-5">
      <PageHeader
        title="Jobs"
        subtitle="Create, update, search, and maintain recruiter job listings in one place."
        action={<button type="button" onClick={startCreate} className={recruiterPrimaryButtonClassName}>Create job</button>}
      />
      <Card className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className={textInputClassName} placeholder="Search title, company, field, role, or location" />
        <AppSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          className={recruiterSelectClassName}
        />
        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          {filteredJobs.length} jobs shown
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {filteredJobs.map((job) => (
          <Card key={asId(job)} className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{String(job.title ?? 'Untitled role')}</h3>
                <p className="text-sm text-slate-400">{String(job.company ?? '-')} | {String(job.location ?? 'Location not set')}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${String(job.status ?? 'active') === 'inactive' ? 'bg-slate-700 text-slate-200' : 'bg-emerald-500/20 text-emerald-200'}`}>
                {String(job.status ?? 'active')}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Domain</p>
                <p className="mt-1 text-sm text-slate-200">{String(job.domain ?? 'Not set')}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Applicants</p>
                <p className="mt-1 text-sm text-slate-200">{applicantCount(asId(job))}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
                <p className="mt-1 text-sm text-slate-200">{String(job.roleLabel ?? 'Not set')}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Work type</p>
                <p className="mt-1 text-sm text-slate-200">{String(job.opportunityType ?? job.employmentType ?? 'Not set')}</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">{String(job.description ?? job.descriptionText ?? '').slice(0, 200) || 'No job description added yet.'}</p>
            <div className="flex flex-wrap gap-2">
              {(Array.isArray(job.requiredSkills) ? job.requiredSkills : []).slice(0, 6).map((skill: string) => (
                <span key={skill} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200">{skill}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => startEdit(job)} className={recruiterCompactPrimaryButtonClassName}>Edit</button>
              <button type="button" onClick={() => { void toggleJobStatus(job) }} className={recruiterCompactSecondaryButtonClassName}>
                {String(job.status ?? 'active') === 'inactive' ? 'Activate' : 'Deactivate'}
              </button>
              <button type="button" onClick={() => { void removeJob(job) }} className={recruiterDangerButtonClassName}>Delete</button>
            </div>
          </Card>
        ))}
        {!filteredJobs.length ? <Card><p className="text-sm text-slate-400">No jobs match the current filters. Create a job or widen the search.</p></Card> : null}
      </div>
      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}
      <AppModal open={modalOpen} onClose={() => setModalOpen(false)} title={editingJobId ? 'Edit job' : 'Create job'} panelClassName="recruiter-modal-panel" headerClassName="recruiter-modal-header" bodyClassName="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div><FieldLabel>Job title</FieldLabel><input value={jobForm.title} onChange={(event) => setJobForm((current) => ({ ...current, title: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Company name</FieldLabel><input value={jobForm.company} onChange={(event) => setJobForm((current) => ({ ...current, company: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Location</FieldLabel><input value={jobForm.location} onChange={(event) => setJobForm((current) => ({ ...current, location: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Domain / field</FieldLabel><input value={jobForm.domain} onChange={(event) => setJobForm((current) => ({ ...current, domain: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Target role</FieldLabel><input value={jobForm.roleLabel} onChange={(event) => setJobForm((current) => ({ ...current, roleLabel: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Experience level</FieldLabel><input value={jobForm.experienceLevel} onChange={(event) => setJobForm((current) => ({ ...current, experienceLevel: event.target.value }))} className={textInputClassName} placeholder="Fresher, 1-3 years, Senior" /></div>
          <div><FieldLabel>Job type</FieldLabel><AppSelect value={jobForm.employmentType} onChange={(value) => setJobForm((current) => ({ ...current, employmentType: value }))} options={[{ value: 'full-time', label: 'Full-time' }, { value: 'part-time', label: 'Part-time' }, { value: 'contract', label: 'Contract' }, { value: 'hybrid', label: 'Hybrid' }]} className={recruiterSelectClassName} /></div>
          <div><FieldLabel>Internship or full-time</FieldLabel><AppSelect value={jobForm.opportunityType} onChange={(value) => setJobForm((current) => ({ ...current, opportunityType: value }))} options={[{ value: 'full-time', label: 'Full-time' }, { value: 'internship', label: 'Internship' }]} className={recruiterSelectClassName} /></div>
          <div className="md:col-span-2"><FieldLabel>Required skills</FieldLabel><input value={jobForm.requiredSkills} onChange={(event) => setJobForm((current) => ({ ...current, requiredSkills: event.target.value }))} className={textInputClassName} placeholder="React, TypeScript, SQL" /></div>
          <div className="md:col-span-2"><FieldLabel>Optional skills</FieldLabel><input value={jobForm.optionalSkills} onChange={(event) => setJobForm((current) => ({ ...current, optionalSkills: event.target.value }))} className={textInputClassName} placeholder="Figma, Docker, AWS" /></div>
          <div className="md:col-span-2"><FieldLabel>Job description</FieldLabel><textarea value={jobForm.description} onChange={(event) => setJobForm((current) => ({ ...current, description: event.target.value }))} className={textAreaClassName} /></div>
          <div><FieldLabel>Salary or stipend</FieldLabel><input value={jobForm.salaryRange} onChange={(event) => setJobForm((current) => ({ ...current, salaryRange: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Application link</FieldLabel><input value={jobForm.applyLink} onChange={(event) => setJobForm((current) => ({ ...current, applyLink: event.target.value }))} className={textInputClassName} placeholder="https://company.com/jobs/apply" /></div>
          <div><FieldLabel>Deadline</FieldLabel><input type="date" value={jobForm.deadline} onChange={(event) => setJobForm((current) => ({ ...current, deadline: event.target.value }))} className={textInputClassName} /></div>
          <div><FieldLabel>Status</FieldLabel><AppSelect value={jobForm.status} onChange={(value) => setJobForm((current) => ({ ...current, status: value as 'active' | 'inactive' }))} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} className={recruiterSelectClassName} /></div>
        </div>
        {message ? <p className="mt-4 text-sm text-cyan-300">{message}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => { void saveJob() }} disabled={saving} className={recruiterPrimaryButtonClassName}>{saving ? 'Saving...' : editingJobId ? 'Update job' : 'Create job'}</button>
          <button type="button" onClick={() => setModalOpen(false)} className={recruiterSecondaryButtonClassName}>Cancel</button>
        </div>
      </AppModal>
    </div>
  )
}

export const RecruiterCandidatesPage = () => {
  const [applications, setApplications] = useState<ApiRecord[]>([])
  const [jobs, setJobs] = useState<ApiRecord[]>([])
  const [interviewQuestions, setInterviewQuestions] = useState<ApiRecord[]>([])
  const [codingQuestions, setCodingQuestions] = useState<ApiRecord[]>([])
  const [detailApplication, setDetailApplication] = useState<ApiRecord | null>(null)
  const [assignmentTarget, setAssignmentTarget] = useState<ApiRecord | null>(null)
  const [activeTab, setActiveTab] = useState<'applications' | 'shortlisted'>('applications')
  const [jobFilter, setJobFilter] = useState('all')
  const [fieldFilter, setFieldFilter] = useState('all')
  const [scoreFilter, setScoreFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [assignmentCategory, setAssignmentCategory] = useState<'interview' | 'coding'>('interview')
  const [assignmentForm, setAssignmentForm] = useState({
    roundType: 'technical',
    difficulty: 'Intermediate',
    questionCount: '6',
    topics: '',
    questionSource: 'platform',
    selectedInterviewQuestionIds: [] as string[],
    selectedCodingQuestionIds: [] as string[],
    deadline: '',
    timeLimitSec: '0',
  })
  const [interviewQuestionForm, setInterviewQuestionForm] = useState<RecruiterInterviewQuestionForm>(defaultInterviewQuestionForm)
  const [codingQuestionForm, setCodingQuestionForm] = useState<RecruiterCodingQuestionForm>(defaultCodingQuestionForm)
  const [feedback, setFeedback] = useState('')
  const selectedJobForAssignment = assignmentTarget?.job ?? jobs.find((job) => asId(job) === String(assignmentTarget?.job?.id ?? assignmentTarget?.jobId ?? '')) ?? null
  const codingAssignmentAllowed = assignmentCategory === 'coding' ? isCodingRelevantForJob(selectedJobForAssignment) : true

  const loadData = async () => {
    const [applicationRows, jobRows, interviewQuestionRows, codingQuestionRows] = await Promise.all([
      recruiterApi.listApplications(),
      recruiterApi.listJobs(),
      recruiterApi.listInterviewQuestions(),
      recruiterApi.listCodingQuestions(),
    ])
    setApplications(applicationRows)
    setJobs(jobRows)
    setInterviewQuestions(interviewQuestionRows)
    setCodingQuestions(codingQuestionRows)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredApplications = useMemo(() => applications.filter((row) => {
    const jobId = String(row.job?.id ?? row.jobId ?? '')
    const field = String(row.student?.field ?? '')
    const score = Number(row.assignedRounds?.find((item: ApiRecord) => item.resultSummary?.score)?.resultSummary?.score ?? 0)
    const isShortlisted = String(row.status ?? '') === 'shortlisted'
    const matchesJob = jobFilter === 'all' || jobId === jobFilter
    const matchesField = fieldFilter === 'all' || field.toLowerCase() === fieldFilter.toLowerCase()
    const matchesScore = scoreFilter === 'all'
      || (scoreFilter === '80' && score >= 80)
      || (scoreFilter === '60' && score >= 60)
      || (scoreFilter === '0' && score < 60)
    const matchesStatus = statusFilter === 'all'
      || String(row.status ?? '') === statusFilter
      || (statusFilter === 'saved' && isShortlisted)
    return matchesJob && matchesField && matchesScore && matchesStatus
  }), [applications, fieldFilter, jobFilter, scoreFilter, statusFilter])

  const shortlistedApplications = useMemo(() => filteredApplications.filter((row) => String(row.status ?? '') === 'shortlisted'), [filteredApplications])

  const cards = activeTab === 'shortlisted' ? shortlistedApplications : filteredApplications

  const updateDecision = async (application: ApiRecord, status: string) => {
    try {
      await recruiterApi.updateApplicationDecision(String(application._id ?? application.id ?? ''), { status })
      setFeedback(`Application marked as ${status}.`)
      await loadData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to update the application.')
    }
  }

  const openAssignModal = (application: ApiRecord, category: 'interview' | 'coding') => {
    setAssignmentTarget(application)
    setAssignmentCategory(category)
    setAssignmentForm({
      roundType: category === 'coding' ? 'coding_round' : 'technical',
      difficulty: 'Intermediate',
      questionCount: category === 'coding' ? '3' : '6',
      topics: '',
      questionSource: 'platform',
      selectedInterviewQuestionIds: [],
      selectedCodingQuestionIds: [],
      deadline: '',
      timeLimitSec: '0',
    })
    setAssignmentModalOpen(true)
  }

  const submitAssignment = async () => {
    if (!assignmentTarget) return
    if (assignmentCategory === 'coding' && !codingAssignmentAllowed) {
      setFeedback('Coding rounds can only be assigned to coding-related jobs such as software or data roles.')
      return
    }
    const payload = {
      roundType: assignmentForm.roundType,
      difficulty: assignmentForm.difficulty,
      questionCount: Number(assignmentForm.questionCount || (assignmentCategory === 'coding' ? 3 : 6)),
      topics: parseList(assignmentForm.topics),
      questionSource: assignmentForm.questionSource,
      customInterviewQuestionIds: assignmentForm.selectedInterviewQuestionIds,
      customCodingQuestionIds: assignmentForm.selectedCodingQuestionIds,
      deadline: assignmentForm.deadline ? new Date(assignmentForm.deadline).toISOString() : null,
      timeLimitSec: Number(assignmentForm.timeLimitSec || 0),
    }
    if (assignmentCategory === 'interview') {
      await recruiterApi.assignInterviewRound(String(assignmentTarget._id ?? assignmentTarget.id ?? ''), payload)
      setFeedback('Interview round assigned.')
    } else {
      await recruiterApi.assignCodingRound(String(assignmentTarget._id ?? assignmentTarget.id ?? ''), payload)
      setFeedback('Coding round assigned.')
    }
    setAssignmentModalOpen(false)
    await loadData()
  }

  const createInterviewQuestion = async () => {
    await recruiterApi.createInterviewQuestion({
      ...interviewQuestionForm,
      keyPoints: parseList(interviewQuestionForm.keyPoints),
      tags: parseList(interviewQuestionForm.tags),
    })
    setInterviewQuestionForm(defaultInterviewQuestionForm)
    setFeedback('Recruiter interview question created.')
    await loadData()
  }

  const createCodingQuestion = async () => {
    await recruiterApi.createCodingQuestion({
      ...codingQuestionForm,
      constraints: parseList(codingQuestionForm.constraints),
      supportedLanguages: parseList(codingQuestionForm.supportedLanguages),
      timeLimit: Number(codingQuestionForm.timeLimit || 2),
      visibleTestCases: parseJsonArray(codingQuestionForm.visibleTestCases),
      hiddenTestCases: parseJsonArray(codingQuestionForm.hiddenTestCases),
      tags: parseList(codingQuestionForm.tags),
    })
    setCodingQuestionForm(defaultCodingQuestionForm)
    setFeedback('Recruiter coding question created.')
    await loadData()
  }

  const jobOptions = [{ value: 'all', label: 'All jobs' }, ...jobs.map((job) => ({ value: asId(job), label: String(job.title ?? 'Untitled role') }))]
  const fieldOptions = [{ value: 'all', label: 'All fields' }, ...[...new Set(applications.map((row) => String(row.student?.field ?? '')).filter(Boolean))].map((field) => ({ value: field, label: field }))]

  return (
    <div className="recruiter-theme space-y-5">
      <PageHeader title="Candidates" subtitle="Manage real job applications, assign recruiter-controlled rounds, review results, and make hiring decisions." />
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setActiveTab('applications')} className={`${toggleClassName} ${activeTab === 'applications' ? 'app-primary-button' : 'admin-subtle-button'}`}>Applications</button>
          <button type="button" onClick={() => setActiveTab('shortlisted')} className={`${toggleClassName} ${activeTab === 'shortlisted' ? 'app-primary-button' : 'admin-subtle-button'}`}>Shortlisted</button>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <AppSelect value={jobFilter} onChange={setJobFilter} options={jobOptions} className={recruiterSelectClassName} />
          <AppSelect value={fieldFilter} onChange={setFieldFilter} options={fieldOptions} className={recruiterSelectClassName} />
          <AppSelect
            value={scoreFilter}
            onChange={setScoreFilter}
            options={[
              { value: 'all', label: 'All fit scores' },
              { value: '80', label: '80% and above' },
              { value: '60', label: '60% and above' },
              { value: '0', label: 'Below 60%' },
            ]}
            className={recruiterSelectClassName}
          />
          <AppSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All application states' },
              { value: 'applied', label: 'Applied' },
              { value: 'under_review', label: 'Under review' },
              { value: 'interview_assigned', label: 'Interview assigned' },
              { value: 'coding_round_assigned', label: 'Coding assigned' },
              { value: 'completed', label: 'Completed' },
              { value: 'shortlisted', label: 'Shortlisted' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'hired', label: 'Hired' },
            ]}
            className={recruiterSelectClassName}
          />
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="space-y-4">
          <SectionTitle title="Recruiter Interview Questions" subtitle="Create your own interview questions and keep them private to your hiring workflow." />
          <div className="grid gap-3 md:grid-cols-2">
            <input value={interviewQuestionForm.role} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, role: event.target.value }))} className={textInputClassName} placeholder="Role" />
            <input value={interviewQuestionForm.domain} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, domain: event.target.value }))} className={textInputClassName} placeholder="Domain" />
            <AppSelect value={interviewQuestionForm.roundType} onChange={(value) => setInterviewQuestionForm((current) => ({ ...current, roundType: value }))} options={[{ value: 'hr', label: 'HR' }, { value: 'technical', label: 'Technical' }, { value: 'resume_based', label: 'Resume-based' }, { value: 'mixed', label: 'Mixed' }, { value: 'role_based', label: 'Role-based' }]} className={recruiterSelectClassName} />
            <AppSelect value={interviewQuestionForm.difficulty} onChange={(value) => setInterviewQuestionForm((current) => ({ ...current, difficulty: value }))} options={[{ value: 'Beginner', label: 'Beginner' }, { value: 'Intermediate', label: 'Intermediate' }, { value: 'Advanced', label: 'Advanced' }]} className={recruiterSelectClassName} />
            <input value={interviewQuestionForm.topic} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, topic: event.target.value }))} className={textInputClassName} placeholder="Topic" />
            <input value={interviewQuestionForm.tags} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, tags: event.target.value }))} className={textInputClassName} placeholder="Tags, comma separated" />
            <textarea value={interviewQuestionForm.questionText} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, questionText: event.target.value }))} className={`${textAreaClassName} md:col-span-2`} placeholder="Interview question" />
            <textarea value={interviewQuestionForm.answerHint} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, answerHint: event.target.value }))} className={`${textAreaClassName} md:col-span-2`} placeholder="Optional answer hint" />
            <input value={interviewQuestionForm.keyPoints} onChange={(event) => setInterviewQuestionForm((current) => ({ ...current, keyPoints: event.target.value }))} className={`${textInputClassName} md:col-span-2`} placeholder="Key points, comma separated" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void createInterviewQuestion() }} className={recruiterPrimaryButtonClassName}>Create interview question</button>
          </div>
          <div className="space-y-2">
            {interviewQuestions.slice(0, 6).map((question) => (
              <div key={String(question._id ?? question.id ?? '')} className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{String(question.questionText ?? '')}</p>
                    <p className="mt-1 text-xs text-slate-400">{String(question.role ?? '')} | {String(question.roundType ?? '')} | {String(question.topic ?? '')}</p>
                  </div>
                  <button type="button" onClick={() => { void recruiterApi.deleteInterviewQuestion(String(question._id ?? question.id ?? '')).then(loadData) }} className="app-danger-button rounded-lg px-3 py-2 text-xs font-semibold">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="space-y-4">
          <SectionTitle title="Recruiter Coding Questions" subtitle="Create custom coding problems with private test cases for your applicants." />
          <div className="grid gap-3 md:grid-cols-2">
            <input value={codingQuestionForm.role} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, role: event.target.value }))} className={textInputClassName} placeholder="Role" />
            <input value={codingQuestionForm.domain} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, domain: event.target.value }))} className={textInputClassName} placeholder="Domain" />
            <input value={codingQuestionForm.topic} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, topic: event.target.value }))} className={textInputClassName} placeholder="Topic" />
            <AppSelect value={codingQuestionForm.difficulty} onChange={(value) => setCodingQuestionForm((current) => ({ ...current, difficulty: value }))} options={[{ value: 'Beginner', label: 'Beginner' }, { value: 'Intermediate', label: 'Intermediate' }, { value: 'Advanced', label: 'Advanced' }]} className={recruiterSelectClassName} />
            <input value={codingQuestionForm.title} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, title: event.target.value }))} className={`${textInputClassName} md:col-span-2`} placeholder="Problem title" />
            <textarea value={codingQuestionForm.problemStatement} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, problemStatement: event.target.value }))} className={`${textAreaClassName} md:col-span-2`} placeholder="Problem statement" />
            <input value={codingQuestionForm.inputFormat} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, inputFormat: event.target.value }))} className={textInputClassName} placeholder="Input format" />
            <input value={codingQuestionForm.outputFormat} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, outputFormat: event.target.value }))} className={textInputClassName} placeholder="Output format" />
            <input value={codingQuestionForm.constraints} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, constraints: event.target.value }))} className={`${textInputClassName} md:col-span-2`} placeholder="Constraints, comma separated" />
            <textarea value={codingQuestionForm.visibleTestCases} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, visibleTestCases: event.target.value }))} className={`${textAreaClassName} md:col-span-2`} placeholder='Visible test cases JSON [{"input":"","output":"","explanation":""}]' />
            <textarea value={codingQuestionForm.hiddenTestCases} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, hiddenTestCases: event.target.value }))} className={`${textAreaClassName} md:col-span-2`} placeholder='Hidden test cases JSON []' />
            <input value={codingQuestionForm.supportedLanguages} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, supportedLanguages: event.target.value }))} className={textInputClassName} placeholder="python,javascript" />
            <input value={codingQuestionForm.timeLimit} onChange={(event) => setCodingQuestionForm((current) => ({ ...current, timeLimit: event.target.value }))} className={textInputClassName} placeholder="Time limit minutes" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void createCodingQuestion() }} className={recruiterPrimaryButtonClassName}>Create coding question</button>
          </div>
          <div className="space-y-2">
            {codingQuestions.slice(0, 6).map((question) => (
              <div key={String(question._id ?? question.id ?? '')} className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{String(question.title ?? '')}</p>
                    <p className="mt-1 text-xs text-slate-400">{String(question.role ?? '')} | {String(question.topic ?? '')} | {String(question.difficulty ?? '')}</p>
                  </div>
                  <button type="button" onClick={() => { void recruiterApi.deleteCodingQuestion(String(question._id ?? question.id ?? '')).then(loadData) }} className="app-danger-button rounded-lg px-3 py-2 text-xs font-semibold">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {feedback ? <p className="text-sm text-cyan-300">{feedback}</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {cards.map((application) => {
          const score = Number(application.assignedRounds?.find((item: ApiRecord) => item.resultSummary?.score)?.resultSummary?.score ?? 0)
          const codingEligible = isCodingRelevantForJob(application.job)
          const codingRounds = Array.isArray(application.assignedRounds)
            ? (application.assignedRounds as ApiRecord[]).filter((round) => String(round.roundCategory ?? '') === 'coding')
            : []
          const completedCodingRound = codingRounds.find((round) => ['completed', 'reviewed'].includes(String(round.status ?? '').toLowerCase()))
          return (
            <Card key={String(application._id ?? application.id ?? '')} className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{String(application.student?.name ?? 'Candidate')}</h3>
                  <p className="text-sm text-slate-400">{String(application.student?.field ?? 'Field not shared')} | {String(application.student?.targetRole ?? 'Role not shared')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${String(application.status ?? '') === 'shortlisted' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-200'}`}>
                  {String(application.status ?? 'applied')}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-200">Readiness score</p>
                  <p className="text-sm font-semibold text-white">{score}%</p>
                </div>
                <div className="mt-3">
                  <ProgressBar label="Fit summary" value={score} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Job</p>
                  <p className="mt-1 text-sm text-slate-200">{String(application.job?.title ?? '-')}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Resume</p>
                  <p className="mt-1 text-sm text-slate-200">{String(application.resume?.fileName ?? 'Resume attached')}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Applied on</p>
                  <p className="mt-1 text-sm text-slate-200">{application.appliedAt ? new Date(String(application.appliedAt)).toLocaleDateString() : '-'}</p>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Assigned rounds</p>
                  <p className="mt-1 text-sm text-slate-200">{Array.isArray(application.assignedRounds) ? application.assignedRounds.length : 0}</p>
                </div>
              </div>
              <div className={`rounded-2xl border px-4 py-3 ${codingEligible ? 'border-cyan-500/25 bg-cyan-500/5' : 'border-amber-500/25 bg-amber-500/8'}`}>
                <p className="text-xs uppercase tracking-wide text-slate-400">Coding round eligibility</p>
                <p className={`mt-1 text-sm font-medium ${codingEligible ? 'text-cyan-200' : 'text-amber-200'}`}>
                  {codingEligible ? 'This job supports recruiter-assigned coding rounds.' : 'Coding rounds are not recommended for this job.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {codingEligible
                    ? 'Assign a coding round when you want the student to complete a practical programming assessment.'
                    : 'Use interview rounds for this application unless the role is changed to a coding-related job.'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Assessment progress</p>
                <div className="mt-2 space-y-2">
                  {(application.assignedRounds as ApiRecord[] | undefined)?.length ? (
                    (application.assignedRounds as ApiRecord[]).map((round) => (
                      <div key={String(round._id ?? round.id ?? '')} className="rounded-xl border border-slate-800 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{String(round.roundCategory ?? '').toUpperCase()} | {String(round.roundType ?? '-')}</p>
                            <p className="text-xs text-slate-400">Difficulty: {String(round.difficulty ?? 'Intermediate')} {round.deadline ? `| Deadline: ${new Date(String(round.deadline)).toLocaleString()}` : ''}</p>
                          </div>
                          <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200">{formatRoundStatusLabel(String(round.status ?? 'assigned'))}</span>
                        </div>
                        {(() => {
                          const result = summarizeRoundResult(round)
                          if (!result.score && !result.total && !result.summary) return null
                          return (
                            <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Recruiter review snapshot</p>
                              {result.score ? <p className="mt-2 text-sm text-slate-100">Score: {result.score}%</p> : null}
                              {result.total ? <p className="mt-1 text-xs text-slate-300">Test cases passed: {result.passed}/{result.total}</p> : null}
                              {result.language ? <p className="mt-1 text-xs text-slate-300">Language: {result.language}</p> : null}
                              {result.timeTakenSec ? <p className="mt-1 text-xs text-slate-300">Time taken: {result.timeTakenSec}s</p> : null}
                              {result.summary ? <p className="mt-2 text-xs text-slate-300">{result.summary}</p> : null}
                            </div>
                          )
                        })()}
                      </div>
                    ))
                  ) : <p className="text-sm text-slate-400">No recruiter-assigned rounds yet.</p>}
                </div>
              </div>
              {completedCodingRound ? (
                <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-200">Coding result ready for review</p>
                  <p className="mt-1 text-xs text-slate-300">
                    The student completed a recruiter-assigned coding round. Open details to review the candidate profile together with the round outcome.
                  </p>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openAssignModal(application, 'interview')} className={recruiterCompactPrimaryButtonClassName}>Assign interview</button>
                <button
                  type="button"
                  onClick={() => openAssignModal(application, 'coding')}
                  disabled={!codingEligible}
                  className={codingEligible ? recruiterCompactSecondaryButtonClassName : recruiterCompactSecondaryButtonClassName}
                >
                  Assign coding
                </button>
                <button type="button" onClick={() => { void updateDecision(application, 'shortlisted') }} className={recruiterCompactSecondaryButtonClassName}>Shortlist</button>
                <button type="button" onClick={() => { void updateDecision(application, 'hired') }} className={recruiterCompactPrimaryButtonClassName}>Hire</button>
                <button type="button" onClick={() => { void updateDecision(application, 'rejected') }} className={recruiterDangerButtonClassName}>Reject</button>
                <button type="button" onClick={() => setDetailApplication(application)} className={recruiterCompactSecondaryButtonClassName}>{completedCodingRound ? 'Review result' : 'Open details'}</button>
              </div>
            </Card>
          )
        })}
        {!cards.length ? <Card><p className="text-sm text-slate-400">No candidates match the current filters.</p></Card> : null}
      </div>
      <AppModal open={Boolean(detailApplication)} onClose={() => setDetailApplication(null)} title="Application details" panelClassName="recruiter-modal-panel" headerClassName="recruiter-modal-header" bodyClassName="p-5">
        {detailApplication ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">{String(detailApplication.student?.name ?? 'Candidate')}</h3>
              <p className="text-sm text-slate-400">{String(detailApplication.student?.field ?? 'Field not shared')} | {String(detailApplication.student?.targetRole ?? 'Role not shared')}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Education</p>
                <p className="mt-1 text-sm text-slate-200">{String(detailApplication.student?.education ?? '-') || '-'}</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Resume summary</p>
                <p className="mt-1 text-sm text-slate-200">{(detailApplication.resume?.extractedExperience ?? []).slice(0, 3).join(' | ') || '-'}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Profile summary</p>
              <p className="mt-1 text-sm text-slate-200">{String(detailApplication.student?.summary ?? 'No summary shared.')}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Readiness and skill gap summary</p>
              <p className="mt-1 text-sm text-slate-200">Readiness: {Number(detailApplication.student?.readinessSummary?.readinessScore ?? 0) || 0}%</p>
              <p className="mt-2 text-xs text-slate-400">Missing skills: {((detailApplication.student?.readinessSummary?.missingSkills ?? []) as string[]).slice(0, 8).join(', ') || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Key skills</p>
              <p className="mt-1 text-sm text-slate-200">{(detailApplication.student?.skills ?? []).slice(0, 12).join(', ') || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Projects</p>
              <p className="mt-1 text-sm text-slate-200">{(detailApplication.student?.projects ?? []).slice(0, 6).join(' | ') || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Application status</p>
              <p className="mt-1 text-sm text-slate-200">{String(detailApplication.status ?? 'applied')} for {String(detailApplication.job?.title ?? 'selected job')}.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Resume in application context</p>
              <p className="mt-1 text-sm text-slate-200">{String(detailApplication.resume?.fileName ?? 'Resume attached')}</p>
              <p className="mt-2 text-xs text-slate-400">{String(detailApplication.resume?.previewText ?? 'No preview available.') || 'No preview available.'}</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Assigned round review</p>
              <div className="mt-3 space-y-3">
                {(detailApplication.assignedRounds as ApiRecord[] | undefined)?.length ? (
                  (detailApplication.assignedRounds as ApiRecord[]).map((round) => {
                    const result = summarizeRoundResult(round)
                    return (
                      <div key={String(round._id ?? round.id ?? '')} className="rounded-xl border border-slate-800 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{String(round.roundCategory ?? '').toUpperCase()} | {String(round.roundType ?? '-')}</p>
                            <p className="mt-1 text-xs text-slate-400">{formatRoundStatusLabel(String(round.status ?? 'assigned'))}</p>
                          </div>
                          {result.score ? <span className="rounded-full border border-cyan-500/30 px-3 py-1 text-xs text-cyan-200">{result.score}%</span> : null}
                        </div>
                        {result.total ? <p className="mt-2 text-xs text-slate-300">Test cases passed: {result.passed}/{result.total}</p> : null}
                        {result.language ? <p className="mt-1 text-xs text-slate-300">Language used: {result.language}</p> : null}
                        {result.summary ? <p className="mt-2 text-xs text-slate-300">{result.summary}</p> : null}
                        {(round.customInterviewQuestions as ApiRecord[] | undefined)?.length ? (
                          <div className="mt-3 rounded-xl border border-slate-800 p-3">
                            <p className="text-xs uppercase tracking-wide text-cyan-300">Recruiter interview questions</p>
                            <div className="mt-2 space-y-2">
                              {(round.customInterviewQuestions as ApiRecord[]).map((question) => (
                                <div key={String(question.id ?? '')} className="rounded-lg border border-slate-800 px-3 py-2">
                                  <p className="text-sm text-slate-100">{String(question.questionText ?? '')}</p>
                                  <p className="mt-1 text-xs text-slate-400">{String(question.topic ?? '')} | {String(question.roundType ?? '')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {(round.customCodingQuestions as ApiRecord[] | undefined)?.length ? (
                          <div className="mt-3 rounded-xl border border-slate-800 p-3">
                            <p className="text-xs uppercase tracking-wide text-cyan-300">Recruiter coding questions</p>
                            <div className="mt-2 space-y-2">
                              {(round.customCodingQuestions as ApiRecord[]).map((question) => (
                                <div key={String(question.id ?? '')} className="rounded-lg border border-slate-800 px-3 py-2">
                                  <p className="text-sm text-slate-100">{String(question.title ?? '')}</p>
                                  <p className="mt-1 text-xs text-slate-400">{String(question.topic ?? '')} | {String(question.difficulty ?? '')}</p>
                                  <p className="mt-2 text-xs text-slate-300">{String(question.problemStatement ?? '')}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {(result as ApiRecord).answers ? (
                          <div className="mt-3 rounded-xl border border-slate-800 p-3">
                            <p className="text-xs uppercase tracking-wide text-cyan-300">Student answers</p>
                            <div className="mt-2 space-y-2">
                              {((result as ApiRecord).answers as ApiRecord[]).map((answerItem, index) => (
                                <div key={`${String(answerItem.questionId ?? '')}-${index}`} className="rounded-lg border border-slate-800 px-3 py-2">
                                  <p className="text-xs text-slate-500">{String(answerItem.questionText ?? '')}</p>
                                  <p className="mt-1 text-sm text-slate-200">{String(answerItem.answer ?? 'No answer recorded.') || 'No answer recorded.'}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {(result as ApiRecord).submittedCode ? (
                          <div className="mt-3 rounded-xl border border-slate-800 p-3">
                            <p className="text-xs uppercase tracking-wide text-cyan-300">Submitted code</p>
                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-slate-200">{String((result as ApiRecord).submittedCode ?? '')}</pre>
                          </div>
                        ) : null}
                        {result.strengths.length ? <p className="mt-2 text-xs text-emerald-200">Strong points: {result.strengths.slice(0, 3).join(', ')}</p> : null}
                        {result.weakPoints.length ? <p className="mt-1 text-xs text-amber-200">Weak points: {result.weakPoints.slice(0, 3).join(', ')}</p> : null}
                      </div>
                    )
                  })
                ) : <p className="text-sm text-slate-400">No assigned rounds to review yet.</p>}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Recruiter notes and decision</p>
              <p className="mt-1 text-sm text-slate-200">Decision: {String(detailApplication.recruiterReviewStatus ?? detailApplication.status ?? 'new')}</p>
              <p className="mt-2 text-xs text-slate-400">{String(detailApplication.recruiterNotes ?? 'No recruiter notes yet.') || 'No recruiter notes yet.'}</p>
            </div>
          </div>
        ) : null}
      </AppModal>
      <AppModal open={assignmentModalOpen} onClose={() => { setAssignmentModalOpen(false); setAssignmentTarget(null) }} title={assignmentCategory === 'interview' ? 'Assign interview round' : 'Assign coding round'} panelClassName="recruiter-modal-panel" headerClassName="recruiter-modal-header" bodyClassName="p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {assignmentCategory === 'coding' ? (
            <div className={`md:col-span-2 rounded-2xl border px-4 py-3 ${codingAssignmentAllowed ? 'border-cyan-500/25 bg-cyan-500/5' : 'border-amber-500/25 bg-amber-500/8'}`}>
              <p className={`text-sm font-semibold ${codingAssignmentAllowed ? 'text-cyan-200' : 'text-amber-200'}`}>
                {codingAssignmentAllowed ? 'Coding round can be assigned for this application.' : 'Coding round is blocked for this application.'}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {codingAssignmentAllowed
                  ? `This job looks coding-related based on ${String(selectedJobForAssignment?.domain ?? 'the selected domain')} and role ${String(selectedJobForAssignment?.roleLabel ?? selectedJobForAssignment?.title ?? '')}.`
                  : 'This job is not currently treated as coding-related, so the platform keeps coding-round assignment disabled here.'}
              </p>
            </div>
          ) : null}
          <div>
            <FieldLabel>Question source</FieldLabel>
            <AppSelect
              value={assignmentForm.questionSource}
              onChange={(value) => setAssignmentForm((current) => ({ ...current, questionSource: value }))}
              options={[
                { value: 'platform', label: 'Platform default question bank' },
                { value: 'recruiter_custom', label: 'Recruiter custom questions' },
              ]}
              className={recruiterSelectClassName}
            />
          </div>
          <div>
            <FieldLabel>{assignmentCategory === 'interview' ? 'Round type' : 'Round label'}</FieldLabel>
            <AppSelect
              value={assignmentForm.roundType}
              onChange={(value) => setAssignmentForm((current) => ({ ...current, roundType: value }))}
              options={assignmentCategory === 'interview'
                ? [
                  { value: 'hr', label: 'HR interview' },
                  { value: 'technical', label: 'Technical interview' },
                  { value: 'role_based', label: 'Role-based interview' },
                  { value: 'resume_based', label: 'Resume-based interview' },
                  { value: 'mixed', label: 'Mixed interview' },
                ]
                : [
                  { value: 'coding_round', label: 'Coding round' },
                  { value: 'debugging_round', label: 'Debugging round' },
                ]}
              className={recruiterSelectClassName}
            />
          </div>
          <div>
            <FieldLabel>Difficulty</FieldLabel>
            <AppSelect
              value={assignmentForm.difficulty}
              onChange={(value) => setAssignmentForm((current) => ({ ...current, difficulty: value }))}
              options={[{ value: 'Beginner', label: 'Beginner' }, { value: 'Intermediate', label: 'Intermediate' }, { value: 'Advanced', label: 'Advanced' }]}
              className={recruiterSelectClassName}
            />
          </div>
          <div>
            <FieldLabel>{assignmentCategory === 'coding' ? 'Number of coding questions' : 'Number of questions'}</FieldLabel>
            <input value={assignmentForm.questionCount} onChange={(event) => setAssignmentForm((current) => ({ ...current, questionCount: event.target.value }))} className={textInputClassName} />
          </div>
          <div>
            <FieldLabel>Deadline</FieldLabel>
            <input type="datetime-local" value={assignmentForm.deadline} onChange={(event) => setAssignmentForm((current) => ({ ...current, deadline: event.target.value }))} className={textInputClassName} />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Topics</FieldLabel>
            <input value={assignmentForm.topics} onChange={(event) => setAssignmentForm((current) => ({ ...current, topics: event.target.value }))} className={textInputClassName} placeholder="Communication, React, SQL, DSA" />
          </div>
          <div className="md:col-span-2">
            <FieldLabel>Time limit in seconds (optional)</FieldLabel>
            <input value={assignmentForm.timeLimitSec} onChange={(event) => setAssignmentForm((current) => ({ ...current, timeLimitSec: event.target.value }))} className={textInputClassName} />
          </div>
          {assignmentForm.questionSource === 'recruiter_custom' ? (
            <div className="md:col-span-2 rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-4">
              <p className="text-sm font-semibold text-white">{assignmentCategory === 'interview' ? 'Select recruiter interview questions' : 'Select recruiter coding questions'}</p>
              <div className="mt-3 space-y-2">
                {(assignmentCategory === 'interview' ? interviewQuestions : codingQuestions).map((question) => {
                  const id = String(question._id ?? question.id ?? '')
                  const checked = assignmentCategory === 'interview'
                    ? assignmentForm.selectedInterviewQuestionIds.includes(id)
                    : assignmentForm.selectedCodingQuestionIds.includes(id)
                  return (
                    <label key={id} className="flex items-start gap-3 rounded-xl border border-slate-800 px-3 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => setAssignmentForm((current) => ({
                          ...current,
                          ...(assignmentCategory === 'interview'
                            ? { selectedInterviewQuestionIds: event.target.checked ? [...current.selectedInterviewQuestionIds, id] : current.selectedInterviewQuestionIds.filter((item) => item !== id) }
                            : { selectedCodingQuestionIds: event.target.checked ? [...current.selectedCodingQuestionIds, id] : current.selectedCodingQuestionIds.filter((item) => item !== id) }),
                        }))}
                      />
                      <span>
                        <span className="block font-medium text-white">{String(question.questionText ?? question.title ?? '')}</span>
                        <span className="mt-1 block text-xs text-slate-400">{String(question.role ?? '')} | {String(question.topic ?? '')} | {String(question.difficulty ?? '')}</span>
                      </span>
                    </label>
                  )
                })}
                {!(assignmentCategory === 'interview' ? interviewQuestions : codingQuestions).length ? <p className="text-xs text-slate-500">Create recruiter questions first to use this source.</p> : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => { void submitAssignment() }} disabled={assignmentCategory === 'coding' && !codingAssignmentAllowed} className={recruiterPrimaryButtonClassName}>Assign round</button>
          <button type="button" onClick={() => { setAssignmentModalOpen(false); setAssignmentTarget(null) }} className={recruiterSecondaryButtonClassName}>Cancel</button>
        </div>
      </AppModal>
    </div>
  )
}

export const RecruiterCompanyPage = () => {
  const session = authApi.getSession()
  const [form, setForm] = useState<CompanyForm>(defaultCompanyForm)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    void recruiterApi.getProfile().then((profile) => setForm(normalizeCompanyForm(profile)))
  }, [])

  const saveCompany = async () => {
    try {
      setSaving(true)
      setStatus('')
      await recruiterApi.updateProfile(buildCompanyPayload(form))
      setStatus('Company profile updated.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update company profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="recruiter-theme space-y-5">
      <PageHeader title="Company" subtitle="Manage recruiter and company details in one clear workspace." />
      <Card className="grid gap-4 md:grid-cols-2">
        <div><FieldLabel>Recruiter name</FieldLabel><input value={String(session?.user.name ?? '')} readOnly className={`${textInputClassName} opacity-70`} /></div>
        <div><FieldLabel>Work email</FieldLabel><input value={String(session?.user.email ?? '')} readOnly className={`${textInputClassName} opacity-70`} /></div>
        <div><FieldLabel>Phone number</FieldLabel><input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className={textInputClassName} /></div>
        <div><FieldLabel>Designation</FieldLabel><input value={form.designation} onChange={(event) => setForm((current) => ({ ...current, designation: event.target.value }))} className={textInputClassName} /></div>
        <div><FieldLabel>Company name</FieldLabel><input value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} className={textInputClassName} /></div>
        <div><FieldLabel>Company website</FieldLabel><input value={form.companyWebsite} onChange={(event) => setForm((current) => ({ ...current, companyWebsite: event.target.value }))} className={textInputClassName} /></div>
        <div><FieldLabel>Company location</FieldLabel><input value={form.companyLocation} onChange={(event) => setForm((current) => ({ ...current, companyLocation: event.target.value }))} className={textInputClassName} /></div>
        <div><FieldLabel>Company size</FieldLabel><input value={form.companySize} onChange={(event) => setForm((current) => ({ ...current, companySize: event.target.value }))} className={textInputClassName} placeholder="11-50, 51-200, 200+" /></div>
        <div className="md:col-span-2"><FieldLabel>Hiring domains / fields</FieldLabel><input value={form.hiringDomains} onChange={(event) => setForm((current) => ({ ...current, hiringDomains: event.target.value }))} className={textInputClassName} placeholder="Software, Data, Marketing" /></div>
        <div className="md:col-span-2"><FieldLabel>Hiring roles</FieldLabel><input value={form.hiringFor} onChange={(event) => setForm((current) => ({ ...current, hiringFor: event.target.value }))} className={textInputClassName} placeholder="Frontend Developer, Data Analyst" /></div>
        <div className="md:col-span-2"><FieldLabel>Company logo URL</FieldLabel><input value={form.companyLogo} onChange={(event) => setForm((current) => ({ ...current, companyLogo: event.target.value }))} className={textInputClassName} placeholder="https://company.com/logo.png" /></div>
        <div className="md:col-span-2"><FieldLabel>Company description</FieldLabel><textarea value={form.companyDescription} onChange={(event) => setForm((current) => ({ ...current, companyDescription: event.target.value }))} className={textAreaClassName} /></div>
      </Card>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { void saveCompany() }} disabled={saving} className={recruiterPrimaryButtonClassName}>{saving ? 'Saving...' : 'Save company profile'}</button>
        {status ? <p className="text-sm text-cyan-300">{status}</p> : null}
      </div>
    </div>
  )
}

export const RecruiterSettingsPage = () => {
  const session = authApi.getSession()
  const storageKey = recruiterPreferenceKey(String(session?.user.id ?? 'guest'))
  const [preferences, setPreferences] = useState<RecruiterPreferences>(() => {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaultPreferences
    try {
      return { ...defaultPreferences, ...(JSON.parse(raw) as Partial<RecruiterPreferences>) }
    } catch {
      return defaultPreferences
    }
  })
  const [status, setStatus] = useState('')

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(preferences))
    setStatus('Settings saved locally for this recruiter account.')
  }, [preferences, storageKey])

  return (
    <div className="recruiter-theme space-y-5">
      <PageHeader title="Settings" subtitle="Keep account preferences simple and separate from company information." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="space-y-4">
          <SectionTitle title="Account access" subtitle="Password and account-level actions." />
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4">
            <p className="text-sm font-semibold text-white">Password management</p>
            <p className="mt-1 text-xs text-slate-400">Use the secure reset flow if you need to change your password.</p>
            <Link to="/forgot-password" className={`mt-4 inline-flex ${recruiterPrimaryButtonClassName}`}>Open password reset</Link>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-4">
            <p className="text-sm font-semibold text-white">Default candidate view</p>
            <div className="mt-3">
              <AppSelect
                value={preferences.defaultCandidateView}
                onChange={(value) => setPreferences((current) => ({ ...current, defaultCandidateView: value as RecruiterPreferences['defaultCandidateView'] }))}
                options={[
                  { value: 'matches', label: 'Matched candidates' },
                  { value: 'saved', label: 'Saved candidates' },
                ]}
                className={recruiterSelectClassName}
              />
            </div>
          </div>
        </Card>
        <Card className="space-y-4">
          <SectionTitle title="Preferences" subtitle="Notification, contact, and reminder behavior." />
          <RecruiterToggle label="Email notifications" helper="Receive hiring updates and platform alerts by email." checked={preferences.emailNotifications} onChange={(checked) => setPreferences((current) => ({ ...current, emailNotifications: checked }))} />
          <RecruiterToggle label="Candidate alerts" helper="Notify me when new high-fit candidates become available." checked={preferences.candidateAlerts} onChange={(checked) => setPreferences((current) => ({ ...current, candidateAlerts: checked }))} />
          <RecruiterToggle label="Weekly summary" helper="Send a compact weekly overview of jobs and candidate activity." checked={preferences.weeklySummary} onChange={(checked) => setPreferences((current) => ({ ...current, weeklySummary: checked }))} />
          <RecruiterToggle label="Contact by email" helper="Allow CareerCompass to use email for recruiter communications." checked={preferences.contactByEmail} onChange={(checked) => setPreferences((current) => ({ ...current, contactByEmail: checked }))} />
          <RecruiterToggle label="Contact by phone" helper="Allow important recruiter communication by phone when needed." checked={preferences.contactByPhone} onChange={(checked) => setPreferences((current) => ({ ...current, contactByPhone: checked }))} />
          <div>
            <FieldLabel>Reminder frequency</FieldLabel>
            <AppSelect
              value={preferences.reminderFrequency}
              onChange={(value) => setPreferences((current) => ({ ...current, reminderFrequency: value as RecruiterPreferences['reminderFrequency'] }))}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'off', label: 'Off' },
              ]}
              className={recruiterSelectClassName}
            />
          </div>
        </Card>
      </div>
      {status ? <p className="text-sm text-cyan-300">{status}</p> : null}
    </div>
  )
}
