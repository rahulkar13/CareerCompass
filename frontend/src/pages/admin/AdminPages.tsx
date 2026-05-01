import { ChevronDown } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppModal, AppSelect, Card, CompactPagination, DataTable, PageHeader, ProgressBar, StatCards, TrendChart, estimateContentWeight, paginateAdaptiveItems } from '../../components/ui'
import { adminApi } from '../../services/api'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminRecord = Record<string, any>

const textInputClassName = 'admin-input w-full rounded-xl px-3 py-2.5 text-sm outline-none'
const textareaClassName = `${textInputClassName} min-h-28 resize-y`
const subtleButtonClassName = 'admin-subtle-button rounded-xl px-3 py-2 text-sm font-medium'
const primaryButtonClassName = 'admin-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const dangerButtonClassName = 'app-danger-button rounded-xl border px-3 py-2 text-sm font-medium'
const smallSelectClassName = 'admin-input rounded-lg px-2 py-1 text-xs'
const softPanelClassName = 'admin-soft-panel rounded-2xl border px-4 py-3'
const asSelectOptions = (items: Array<string | { value: string; label: string }>) =>
  items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))

const formatDate = (value: unknown) => {
  const date = new Date(String(value ?? ''))
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const toListText = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value ?? ''))
const toArray = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const toRecord = (value: unknown): AdminRecord => (value && typeof value === 'object' && !Array.isArray(value) ? value as AdminRecord : {})
const toStringList = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [])

const extractRecommendationSummary = (payloadValue: unknown) => {
  const payload = toRecord(payloadValue)
  const skillGapAnalysis = toRecord(payload.skillGapAnalysis)
  const targetRole = String(
    payload.targetRole
      ?? payload.role
      ?? payload.recommendedRole
      ?? payload.bestFitRole
      ?? '',
  ).trim()
  const fitScore = Number(
    payload.fitScore
      ?? payload.score
      ?? payload.finalScore
      ?? payload.readinessScore
      ?? payload.matchScore
      ?? 0,
  )
  const matchedSkills = [
    ...toStringList(payload.matchedSkills),
    ...toStringList(payload.strengths),
    ...toStringList(skillGapAnalysis.matchedSkills),
  ]
  const missingSkills = [
    ...toStringList(payload.missingSkills),
    ...toStringList(payload.weakSkills),
    ...toStringList(payload.gaps),
    ...toStringList(skillGapAnalysis.weakRequiredSkills),
  ]
  const recommendationReason = String(
    payload.recommendationReason
      ?? payload.whyRecommended
      ?? payload.summary
      ?? payload.overview
      ?? '',
  ).trim()
  const nextSteps = [
    ...toStringList(payload.recommendedNextSteps),
    ...toStringList(payload.nextSteps),
    ...toStringList(payload.actionPlan),
  ]

  return {
    targetRole: targetRole || '-',
    fitScore: Number.isFinite(fitScore) && fitScore > 0 ? `${Math.round(fitScore)}%` : '-',
    matchedSkills: matchedSkills.slice(0, 8),
    missingSkills: missingSkills.slice(0, 8),
    recommendationReason: recommendationReason || 'No written recommendation summary is available for this snapshot.',
    nextSteps: nextSteps.slice(0, 5),
  }
}

const estimateResumeCardWeight = (resume: AdminRecord) =>
  estimateContentWeight([
    String(resume.fileName || ''),
    String(resume.fileType || ''),
    formatDate(resume.uploadedAt),
    toListText(resume.extractedSkills),
    String(resume.validationStatus || ''),
  ])

const estimateRecommendationCardWeight = (item: AdminRecord) => {
  const recommendation = extractRecommendationSummary(item.payload)
  return estimateContentWeight([
    recommendation.targetRole,
    recommendation.fitScore,
    recommendation.matchedSkills.join(', '),
    recommendation.missingSkills.join(', '),
    recommendation.recommendationReason,
    recommendation.nextSteps.join(', '),
    formatDate(item.createdAt),
    String(item.language || 'both'),
  ])
}

const estimateReportCardWeight = (report: AdminRecord) =>
  estimateContentWeight([
    String(report.title || report.reportType || ''),
    String(report.summary || ''),
    String(report.reportType || ''),
    formatDate(report.createdAt),
  ])

const estimateSimpleSummaryCardWeight = (item: AdminRecord) =>
  estimateContentWeight([
    String(item.title || item.subject || item.role || item.targetRole || ''),
    String(item.summary || item.message || item.status || ''),
    toListText(item.weakAreas || item.weakTopics || item.extractedSkills || []),
    formatDate(item.createdAt || item.uploadedAt),
    String(item.domain || ''),
    String(item.difficulty || ''),
    String(item.selectedLanguage || ''),
  ])

const estimateRecruiterJobWeight = (job: AdminRecord) =>
  estimateContentWeight([
    String(job.title || ''),
    String(job.company || ''),
    String(job.location || ''),
    String(job.description || ''),
    String(job.status || ''),
    formatDate(job.createdAt),
  ])

const estimateActivityWeight = (activity: AdminRecord) =>
  estimateContentWeight([
    String(activity.title || ''),
    String(activity.description || activity.message || ''),
    String(activity.actionType || activity.type || ''),
    formatDate(activity.createdAt),
  ])

const statusBadgeClass = (value: string) => {
  const normalized = String(value).toLowerCase()
  if (normalized.includes('active') || normalized.includes('success') || normalized.includes('read')) return 'app-notification-tag-success'
  if (normalized.includes('warning') || normalized.includes('pending') || normalized.includes('partial') || normalized.includes('unread')) return 'app-notification-tag-warning'
  if (normalized.includes('blocked') || normalized.includes('inactive') || normalized.includes('deactivated') || normalized.includes('failed')) return 'admin-badge-danger'
  return 'app-notification-tag-info'
}

const Badge = ({ children, tone }: { children: string; tone?: string }) => (
  <span className={`admin-badge inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClass(tone ?? children)}`}>{children}</span>
)

const SectionTitle = ({ title, description }: { title: string; description: string }) => (
  <div className="mb-4">
    <h2 className="admin-section-title text-lg font-semibold">{title}</h2>
    <p className="admin-section-copy mt-1 text-sm">{description}</p>
  </div>
)

const CardGrid = ({ children }: { children: ReactNode }) => <div className="grid gap-4 xl:grid-cols-2">{children}</div>

const EmptyState = ({ message }: { message: string }) => <p className="admin-empty-state rounded-2xl border border-dashed px-4 py-6 text-sm">{message}</p>
const DetailValue = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className={softPanelClassName}>
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    <div className="admin-detail-value mt-2 text-sm">{value}</div>
  </div>
)

const AdminSwitchRow = ({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string
  helper?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => (
  <label className="student-settings-toggle-row flex cursor-pointer items-start justify-between gap-4 rounded-2xl border px-4 py-3.5">
    <span className="min-w-0 flex-1">
      <span className="student-settings-toggle-label block text-sm font-medium">{label}</span>
      {helper ? <span className="student-settings-helper mt-1 block text-xs">{helper}</span> : null}
    </span>
    <span className="relative mt-0.5 inline-flex flex-shrink-0">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="student-settings-switch-track h-7 w-12 rounded-full border transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-400/20 peer-checked:bg-[var(--accent-primary)]" />
      <span className="student-settings-switch-thumb pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full transition peer-checked:translate-x-5" />
    </span>
  </label>
)

const downloadJsonFile = (fileName: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

const extendItemsForBalance = <T,>(
  source: T[],
  start: number,
  items: T[],
  currentWeight: number,
  targetWeight: number,
  maxVisibleWeight: number,
  getItemWeight: (item: T) => number,
  allowExtraFill = true,
) => {
  if (!allowExtraFill) {
    return { items: [...items], weight: currentWeight }
  }

  let nextItems = [...items]
  let nextWeight = currentWeight
  let cursor = start + items.length

  while (cursor < source.length && nextWeight < Math.min(targetWeight, maxVisibleWeight) * 0.94) {
    const nextItem = source[cursor]
    const nextItemWeight = getItemWeight(nextItem)
    if (nextItems.length > items.length && nextWeight + nextItemWeight > maxVisibleWeight) break
    if (nextWeight + nextItemWeight > maxVisibleWeight * 1.04) break
    nextItems.push(nextItem)
    nextWeight += nextItemWeight
    cursor += 1
  }

  return { items: nextItems, weight: nextWeight }
}

const buildBalancedPairPages = <T, U>(
  itemsA: T[],
  itemsB: U[],
  configA: { preferredPageSize: number; minPageSize: number; maxVisibleWeight: number; getItemWeight: (item: T) => number; allowExtraFill?: boolean },
  configB: { preferredPageSize: number; minPageSize: number; maxVisibleWeight: number; getItemWeight: (item: U) => number; allowExtraFill?: boolean },
) => {
  const pagesA: T[][] = []
  const pagesB: U[][] = []
  let startA = 0
  let startB = 0

  while (startA < itemsA.length || startB < itemsB.length) {
    const baseA = paginateAdaptiveItems(itemsA.slice(startA), 1, configA.preferredPageSize, {
      minPageSize: configA.minPageSize,
      maxVisibleWeight: configA.maxVisibleWeight,
    }).items
    const baseB = paginateAdaptiveItems(itemsB.slice(startB), 1, configB.preferredPageSize, {
      minPageSize: configB.minPageSize,
      maxVisibleWeight: configB.maxVisibleWeight,
    }).items

    const baseWeightA = baseA.reduce<number>((sum, item) => sum + configA.getItemWeight(item), 0)
    const baseWeightB = baseB.reduce<number>((sum, item) => sum + configB.getItemWeight(item), 0)
    const targetWeight = Math.max(baseWeightA, baseWeightB)

    const balancedA = extendItemsForBalance(itemsA, startA, baseA, baseWeightA, targetWeight, configA.maxVisibleWeight, configA.getItemWeight, configA.allowExtraFill)
    const balancedB = extendItemsForBalance(itemsB, startB, baseB, baseWeightB, targetWeight, configB.maxVisibleWeight, configB.getItemWeight, configB.allowExtraFill)

    if (!balancedA.items.length && !balancedB.items.length) break

    pagesA.push(balancedA.items)
    pagesB.push(balancedB.items)
    startA += balancedA.items.length
    startB += balancedB.items.length
  }

  return { pagesA, pagesB }
}

const getBalancedSectionPage = <T,>(
  page: number,
  pages: T[][],
  fallback: ReturnType<typeof paginateAdaptiveItems<T>>,
) => {
  const totalPages = pages.length || fallback.totalPages
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const balancedItems = pages[safePage - 1]
  if (!balancedItems) return fallback
  return {
    items: balancedItems,
    totalPages,
    safePage,
    pageSize: balancedItems.length,
    start: pages.slice(0, safePage - 1).reduce<number>((sum, current) => sum + current.length, 0),
  }
}

export const AdminDashboardPage = () => {
  const [overview, setOverview] = useState<AdminRecord | null>(null)

  useEffect(() => {
    void adminApi.getOverview().then(setOverview)
  }, [])

  const stats = useMemo(() => {
    const values = (overview?.stats ?? {}) as AdminRecord
    return [
      { label: 'Total Users', value: String(values.totalUsers ?? 0) },
      { label: 'Active Users', value: String(values.activeUsers ?? 0) },
      { label: 'New Registrations', value: String(values.newRegistrations ?? 0) },
      { label: 'Resumes Uploaded', value: String(values.resumesUploaded ?? 0) },
      { label: 'Reports Generated', value: String(values.totalReportsGenerated ?? 0) },
      { label: 'Mock Interviews', value: String(values.totalMockInterviews ?? 0) },
      { label: 'Coding Tests', value: String(values.codingTestUsage ?? 0) },
      { label: 'Unread Contacts', value: String(values.unreadContactMessages ?? 0) },
    ]
  }, [overview])

  const trend = useMemo(() => {
    const values = (overview?.trend ?? {}) as AdminRecord
    return [
      { name: 'Reports', value: Number(values.reports ?? 0), secondary: Number(values.readinessScore ?? 0) },
      { name: 'Mock Interviews', value: Number(values.mockInterviews ?? 0), secondary: Number(values.codingTests ?? 0) },
    ]
  }, [overview])

  const topFields = Array.isArray(overview?.topActiveFields) ? overview?.topActiveFields as AdminRecord[] : []
  const topGaps = Array.isArray(overview?.topCommonSkillGaps) ? overview?.topCommonSkillGaps as AdminRecord[] : []
  const repeatedWeakAreas = Array.isArray(overview?.repeatedWeakAreas) ? overview?.repeatedWeakAreas as AdminRecord[] : []
  const interviewCategories = Array.isArray(overview?.mostAttemptedInterviewCategories) ? overview?.mostAttemptedInterviewCategories as AdminRecord[] : []
  const recentActivity = Array.isArray(overview?.recentActivity) ? overview?.recentActivity as AdminRecord[] : []
  const userHighlights = Array.isArray(overview?.userHighlights) ? overview?.userHighlights as AdminRecord[] : []
  const pendingRecruiters = Array.isArray(overview?.pendingRecruiters) ? overview?.pendingRecruiters as AdminRecord[] : []
  const activityLogs = Array.isArray(overview?.adminActivityLogs) ? overview?.adminActivityLogs as AdminRecord[] : []
  const reportTrend = Array.isArray(overview?.reportGenerationTrend) ? overview?.reportGenerationTrend as AdminRecord[] : []
  const values = (overview?.stats ?? {}) as AdminRecord

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Dashboard" subtitle="Monitor approvals, inbox load, flagged content, and platform operations across CareerCompass." />
      <StatCards stats={stats} />
      <CardGrid>
        <Card>
          <SectionTitle title="Admin Priority Queue" description="The tasks that need direct admin attention first." />
          <div className="grid gap-3 md:grid-cols-2">
            <div className={softPanelClassName}>
              <p className="text-sm text-slate-500">Pending recruiter approvals</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{String(values.pendingRecruiterApprovals ?? 0)}</p>
              <p className="mt-2 text-xs text-slate-500">Review recruiter registration requests before recruiter access is enabled.</p>
            </div>
            <div className={softPanelClassName}>
              <p className="text-sm text-slate-500">Unread contact messages</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{String(values.unreadContactMessages ?? 0)}</p>
              <p className="mt-2 text-xs text-slate-500">Public support and feedback messages still waiting for review.</p>
            </div>
            <div className={softPanelClassName}>
              <p className="text-sm text-slate-500">Flagged uploads</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{String(values.flaggedUploads ?? 0)}</p>
              <p className="mt-2 text-xs text-slate-500">Uploads that may be invalid, empty, or misclassified as non-resume files.</p>
            </div>
            <div className={softPanelClassName}>
              <p className="text-sm text-slate-500">Active jobs</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{String(values.totalJobListings ?? 0)}</p>
              <p className="mt-2 text-xs text-slate-500">Current listings and career opportunities visible in the platform.</p>
            </div>
          </div>
        </Card>
        <Card>
          <SectionTitle title="Recruiter Approval Snapshot" description="Newest recruiter requests and company details that need a decision." />
          <div className="space-y-3">
            {pendingRecruiters.length ? pendingRecruiters.slice(0, 5).map((recruiter) => (
              <div key={String(recruiter.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(recruiter.name)}</p>
                    <p className="text-sm text-slate-500">{String(recruiter.email)}</p>
                    <p className="mt-2 text-sm text-slate-600">{String(recruiter.company)} | {String(recruiter.designation)}</p>
                    <p className="text-xs text-slate-400">{String(recruiter.phone || '-')} {recruiter.companyWebsite ? `| ${String(recruiter.companyWebsite)}` : ''}</p>
                  </div>
                  <Badge tone="warning">pending</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{formatDate(recruiter.createdAt)}</p>
              </div>
            )) : <EmptyState message="No recruiter approvals are waiting right now." />}
          </div>
        </Card>
      </CardGrid>
      <CardGrid>
        <TrendChart data={trend} />
        <Card>
          <SectionTitle title="Report Generation Trend" description="Recent reporting activity to spot usage and quality swings quickly." />
          <div className="space-y-3">
            {reportTrend.length ? reportTrend.map((item) => (
              <ProgressBar key={String(item.label)} label={String(item.label)} value={Math.min(100, Number(item.count ?? 0) * 10)} />
            )) : <EmptyState message="Report volume trend data will appear here after more reports are generated." />}
          </div>
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Top Active Fields" description="The most active fields and domains across current users." />
          <div className="space-y-3">
            {topFields.length ? topFields.map((field) => (
              <ProgressBar key={String(field.field)} label={String(field.field)} value={Math.min(100, Number(field.count ?? 0) * 10)} />
            )) : <EmptyState message="Field activity data will appear here after more users complete their profiles." />}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Common Skill Gaps" description="The repeated weak areas showing up in user reports." />
          <div className="space-y-3">
            {topGaps.length ? topGaps.map((gap) => (
              <div key={String(gap.skill)} className={softPanelClassName}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-800">{String(gap.skill)}</p>
                  <Badge tone="warning">{`${String(gap.count)} mentions`}</Badge>
                </div>
              </div>
            )) : <EmptyState message="Skill gap trend data will appear once more reports are generated." />}
          </div>
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Repeated Weak Areas" description="Cross-report weaknesses that keep appearing in user preparation and readiness data." />
          <div className="space-y-3">
            {repeatedWeakAreas.length ? repeatedWeakAreas.map((item) => (
              <div key={String(item.label)} className={softPanelClassName}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-800">{String(item.label)}</p>
                  <Badge tone="warning">{`${String(item.count)} repeats`}</Badge>
                </div>
              </div>
            )) : <EmptyState message="Repeated weak areas will appear after more reports and sessions are generated." />}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Most Attempted Interview Categories" description="The interview categories students are practicing most often." />
          <div className="space-y-3">
            {interviewCategories.length ? interviewCategories.map((item) => (
              <div key={String(item.category)} className={softPanelClassName}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-800">{String(item.category)}</p>
                  <Badge>{`${String(item.count)} attempts`}</Badge>
                </div>
              </div>
            )) : <EmptyState message="Interview category trends will appear after mock interview activity grows." />}
          </div>
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Recent Activity" description="A quick feed of registrations, uploads, reports, and contact requests." />
          <div className="space-y-3">
            {recentActivity.length ? recentActivity.map((item) => (
              <div key={String(item.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(item.title)}</p>
                    <p className="mt-1 text-sm text-slate-500">{String(item.description)}</p>
                  </div>
                  <Badge>{String(item.type ?? 'activity')}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
              </div>
            )) : <EmptyState message="Recent activity will appear here as the platform is used." />}
          </div>
        </Card>
        <Card>
          <SectionTitle title="Admin Activity Log" description="Recent approval, delete, notification, and content-management actions taken by admins." />
          <div className="space-y-3">
            {activityLogs.length ? activityLogs.slice(0, 8).map((item) => (
              <div key={String(item._id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(item.title)}</p>
                    <p className="text-sm text-slate-500">{String(item.description)}</p>
                    <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                  </div>
                  <Badge>{String(item.actionType ?? 'activity')}</Badge>
                </div>
              </div>
            )) : <EmptyState message="Admin activity log entries will appear here after operational actions are taken." />}
          </div>
        </Card>
      </CardGrid>
      <Card>
        <SectionTitle title="Newest Users Snapshot" description="Quick view of recent users, their fields, and current readiness direction." />
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {userHighlights.length ? userHighlights.slice(0, 8).map((user) => (
            <div key={String(user.id)} className={softPanelClassName}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-800">{String(user.name)}</p>
                  <p className="text-sm text-slate-500">{String(user.email)}</p>
                  <p className="mt-2 text-sm text-slate-600">{String(user.field)} {user.targetRole ? `| ${String(user.targetRole)}` : ''}</p>
                </div>
                <Badge>{String(user.role)}</Badge>
              </div>
            </div>
          )) : <EmptyState message="New user highlights will appear here." />}
        </div>
      </Card>
    </div>
  )
}

export const AdminStudentsManagementPage = () => {
  const navigate = useNavigate()
  const [students, setStudents] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [fieldFilter, setFieldFilter] = useState('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    void adminApi.listStudents().then(setStudents)
  }, [])

  const filtered = useMemo(() => students.filter((student) => {
    const matchesQuery = !query.trim() || `${student.name} ${student.email} ${student.field} ${student.targetRole}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || String(student.accountStatus ?? 'active') === statusFilter
    const matchesField = fieldFilter === 'all' || String(student.field ?? '') === fieldFilter
    return matchesQuery && matchesStatus && matchesField
  }), [students, query, statusFilter, fieldFilter])
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => { setPage(1) }, [query, statusFilter, fieldFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Students" subtitle="Manage student accounts and open each student’s full journey in one detail view." />
      <Card className="grid gap-3 md:grid-cols-4">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, field, or target role" />
        <AppSelect
          className={textInputClassName}
          value={statusFilter}
          onChange={setStatusFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'blocked', label: 'Blocked' },
            { value: 'deactivated', label: 'Deactivated' },
          ])}
        />
        <input className={textInputClassName} value={fieldFilter === 'all' ? '' : fieldFilter} onChange={(event) => setFieldFilter(event.target.value.trim() || 'all')} placeholder="Field filter" />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} students shown</div>
      </Card>
      <DataTable
        columns={['Student', 'Field / Role', 'Progress', 'Activity', 'Status', 'Actions']}
        rows={paginated.items.map((student) => ({
          Student: <div><p className="font-semibold">{String(student.name)}</p><p className="text-xs text-slate-500">{String(student.email)}</p></div>,
          'Field / Role': <div><p>{String(student.field || '-')}</p><p className="text-xs text-slate-500">{String(student.targetRole || '-')}</p></div>,
          Progress: <div><p>Profile: {String(student.completion ?? 0)}%</p><p className="text-xs text-slate-500">Readiness: {String(student.latestReadinessScore ?? 0)}</p></div>,
          Activity: <div><p>Resumes: {String(student.resumeCount ?? 0)}</p><p className="text-xs text-slate-500">Reports: {String(student.reportCount ?? 0)}</p></div>,
          Status: <Badge>{String(student.accountStatus ?? 'active')}</Badge>,
          Actions: <button className={primaryButtonClassName} onClick={() => navigate(`/admin/students/${String(student.id)}`)}>Open Student</button>,
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
    </div>
  )
}

export const AdminStudentDetailPage = () => {
  const navigate = useNavigate()
  const { studentId = '' } = useParams()
  const [detail, setDetail] = useState<AdminRecord | null>(null)
  const [resumePage, setResumePage] = useState(1)
  const [recommendationPage, setRecommendationPage] = useState(1)
  const [skillGapPage, setSkillGapPage] = useState(1)
  const [interviewPrepPage, setInterviewPrepPage] = useState(1)
  const [mockPage, setMockPage] = useState(1)
  const [codingPage, setCodingPage] = useState(1)
  const [reportsPage, setReportsPage] = useState(1)
  const [notificationsPage, setNotificationsPage] = useState(1)

  useEffect(() => {
    if (!studentId) return
    void adminApi.getStudentDetail(studentId).then(setDetail)
  }, [studentId])

  const student = (detail?.student ?? {}) as AdminRecord
  const profile = (detail?.profile ?? {}) as AdminRecord
  const resumes = Array.isArray(detail?.resumes) ? detail?.resumes as AdminRecord[] : []
  const skillGapReports = Array.isArray(detail?.skillGapReports) ? detail?.skillGapReports as AdminRecord[] : []
  const interviewPreparationProgress = Array.isArray(detail?.interviewPreparationProgress) ? detail?.interviewPreparationProgress as AdminRecord[] : []
  const mockInterviewHistory = Array.isArray(detail?.mockInterviewHistory) ? detail?.mockInterviewHistory as AdminRecord[] : []
  const codingTestHistory = Array.isArray(detail?.codingTestHistory) ? detail?.codingTestHistory as AdminRecord[] : []
  const reportsHistory = Array.isArray(detail?.reportsHistory) ? detail?.reportsHistory as AdminRecord[] : []
  const notifications = Array.isArray(detail?.notifications) ? detail?.notifications as AdminRecord[] : []
  const jobRecommendations = Array.isArray(detail?.jobRecommendations) ? detail?.jobRecommendations as AdminRecord[] : []
  const suggestedRoles = Array.isArray(detail?.suggestedRoles) ? detail?.suggestedRoles as string[] : []
  const summary = (detail?.summary ?? {}) as AdminRecord
  const resumeConfig = { preferredPageSize: 10, minPageSize: 5, maxVisibleWeight: 1700, getItemWeight: estimateResumeCardWeight }
  const recommendationConfig = { preferredPageSize: 2, minPageSize: 2, maxVisibleWeight: 1450, getItemWeight: estimateRecommendationCardWeight, allowExtraFill: false }
  const skillGapConfig = { preferredPageSize: 4, minPageSize: 4, maxVisibleWeight: 1600, getItemWeight: estimateReportCardWeight, allowExtraFill: false }
  const interviewPrepConfig = { preferredPageSize: 4, minPageSize: 4, maxVisibleWeight: 1550, getItemWeight: estimateReportCardWeight, allowExtraFill: false }
  const mockConfig = { preferredPageSize: 8, minPageSize: 4, maxVisibleWeight: 1600, getItemWeight: estimateSimpleSummaryCardWeight }
  const codingConfig = { preferredPageSize: 8, minPageSize: 4, maxVisibleWeight: 1600, getItemWeight: estimateSimpleSummaryCardWeight }
  const reportConfig = { preferredPageSize: 8, minPageSize: 4, maxVisibleWeight: 1600, getItemWeight: estimateReportCardWeight }
  const notificationConfig = { preferredPageSize: 5, minPageSize: 3, maxVisibleWeight: 920, getItemWeight: estimateSimpleSummaryCardWeight }

  const resumeFallback = useMemo(() => paginateAdaptiveItems(resumes, resumePage, resumeConfig.preferredPageSize, { minPageSize: resumeConfig.minPageSize, maxVisibleWeight: resumeConfig.maxVisibleWeight }), [resumes, resumePage])
  const recommendationFallback = useMemo(() => paginateAdaptiveItems(jobRecommendations, recommendationPage, recommendationConfig.preferredPageSize, { minPageSize: recommendationConfig.minPageSize, maxVisibleWeight: recommendationConfig.maxVisibleWeight }), [jobRecommendations, recommendationPage])
  const skillGapFallback = useMemo(() => paginateAdaptiveItems(skillGapReports, skillGapPage, skillGapConfig.preferredPageSize, { minPageSize: skillGapConfig.minPageSize, maxVisibleWeight: skillGapConfig.maxVisibleWeight }), [skillGapReports, skillGapPage])
  const interviewPrepFallback = useMemo(() => paginateAdaptiveItems(interviewPreparationProgress, interviewPrepPage, interviewPrepConfig.preferredPageSize, { minPageSize: interviewPrepConfig.minPageSize, maxVisibleWeight: interviewPrepConfig.maxVisibleWeight }), [interviewPreparationProgress, interviewPrepPage])
  const mockFallback = useMemo(() => paginateAdaptiveItems(mockInterviewHistory, mockPage, mockConfig.preferredPageSize, { minPageSize: mockConfig.minPageSize, maxVisibleWeight: mockConfig.maxVisibleWeight }), [mockInterviewHistory, mockPage])
  const codingFallback = useMemo(() => paginateAdaptiveItems(codingTestHistory, codingPage, codingConfig.preferredPageSize, { minPageSize: codingConfig.minPageSize, maxVisibleWeight: codingConfig.maxVisibleWeight }), [codingTestHistory, codingPage])
  const reportFallback = useMemo(() => paginateAdaptiveItems(reportsHistory, reportsPage, reportConfig.preferredPageSize, { minPageSize: reportConfig.minPageSize, maxVisibleWeight: reportConfig.maxVisibleWeight }), [reportsHistory, reportsPage])
  const notificationFallback = useMemo(() => paginateAdaptiveItems(notifications, notificationsPage, notificationConfig.preferredPageSize, { minPageSize: notificationConfig.minPageSize, maxVisibleWeight: notificationConfig.maxVisibleWeight }), [notifications, notificationsPage])

  const pairOnePages = useMemo(() => buildBalancedPairPages(resumes, jobRecommendations, resumeConfig, recommendationConfig), [resumes, jobRecommendations])
  const pairTwoPages = useMemo(() => buildBalancedPairPages(skillGapReports, interviewPreparationProgress, skillGapConfig, interviewPrepConfig), [skillGapReports, interviewPreparationProgress])
  const pairThreePages = useMemo(() => buildBalancedPairPages(mockInterviewHistory, codingTestHistory, mockConfig, codingConfig), [mockInterviewHistory, codingTestHistory])
  const pairFourPages = useMemo(() => buildBalancedPairPages(reportsHistory, notifications, reportConfig, notificationConfig), [reportsHistory, notifications])

  const paginatedResumes = useMemo(() => getBalancedSectionPage(resumePage, pairOnePages.pagesA, resumeFallback), [pairOnePages.pagesA, resumeFallback, resumePage])
  const paginatedRecommendations = useMemo(() => getBalancedSectionPage(recommendationPage, pairOnePages.pagesB, recommendationFallback), [pairOnePages.pagesB, recommendationFallback, recommendationPage])
  const paginatedSkillGaps = useMemo(() => getBalancedSectionPage(skillGapPage, pairTwoPages.pagesA, skillGapFallback), [pairTwoPages.pagesA, skillGapFallback, skillGapPage])
  const paginatedInterviewPrep = useMemo(() => getBalancedSectionPage(interviewPrepPage, pairTwoPages.pagesB, interviewPrepFallback), [interviewPrepFallback, interviewPrepPage, pairTwoPages.pagesB])
  const paginatedMocks = useMemo(() => getBalancedSectionPage(mockPage, pairThreePages.pagesA, mockFallback), [mockFallback, mockPage, pairThreePages.pagesA])
  const paginatedCoding = useMemo(() => getBalancedSectionPage(codingPage, pairThreePages.pagesB, codingFallback), [codingFallback, codingPage, pairThreePages.pagesB])
  const paginatedReports = useMemo(() => getBalancedSectionPage(reportsPage, pairFourPages.pagesA, reportFallback), [pairFourPages.pagesA, reportFallback, reportsPage])
  const paginatedNotifications = useMemo(() => getBalancedSectionPage(notificationsPage, pairFourPages.pagesB, notificationFallback), [notificationFallback, notificationsPage, pairFourPages.pagesB])

  useEffect(() => {
    setResumePage(1)
    setRecommendationPage(1)
    setSkillGapPage(1)
    setInterviewPrepPage(1)
    setMockPage(1)
    setCodingPage(1)
    setReportsPage(1)
    setNotificationsPage(1)
  }, [studentId, resumes.length, jobRecommendations.length, skillGapReports.length, interviewPreparationProgress.length, mockInterviewHistory.length, codingTestHistory.length, reportsHistory.length, notifications.length])

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.name ? `${String(student.name)} | Student Detail` : 'Student Detail'}
        subtitle="Review this student’s full profile, reports, interview progress, and readiness journey in one place."
        action={<button className={subtleButtonClassName} onClick={() => navigate('/admin/students')}>Back to Students</button>}
      />
      <CardGrid>
        <Card>
          <SectionTitle title="Student Summary" description="Basic account status and readiness snapshot." />
          <div className="grid gap-3 md:grid-cols-2">
            <DetailValue label="Email" value={String(student.email || '-')} />
            <DetailValue label="Account Status" value={<Badge>{String(student.accountStatus || 'active')}</Badge>} />
            <DetailValue label="Detected Field" value={String(detail?.detectedField || '-')} />
            <DetailValue label="Suggested Roles" value={suggestedRoles.length ? suggestedRoles.join(', ') : '-'} />
            <DetailValue label="Latest Readiness Score" value={String(summary.latestReadinessScore ?? 0)} />
            <DetailValue label="Last Active" value={formatDate(student.lastActiveAt)} />
          </div>
        </Card>
        <Card>
          <SectionTitle title="Profile" description="Student profile, contact details, education, and stated direction." />
          <div className="grid gap-3 md:grid-cols-2">
            <DetailValue label="Phone" value={String(profile.phone || '-')} />
            <DetailValue label="Location" value={String(profile.currentLocation || profile.location || '-')} />
            <DetailValue label="College / Degree" value={`${String(profile.collegeName || '-')} ${profile.degree ? `| ${String(profile.degree)}` : ''}`} />
            <DetailValue label="Preferred Role" value={String(profile.preferredJobRole || '-')} />
            <DetailValue label="Skills" value={toListText(profile.skills)} />
            <DetailValue label="Technical Skills" value={toListText(profile.technicalSkills)} />
          </div>
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Resume Uploads" description="Uploaded resume files, extracted content, and validation state." />
          <div className="space-y-3">
            {paginatedResumes.items.length ? paginatedResumes.items.map((resume) => (
              <div key={String(resume.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(resume.fileName)}</p>
                    <p className="text-sm text-slate-500">{String(resume.fileType)} | {formatDate(resume.uploadedAt)}</p>
                    <p className="mt-2 text-xs text-slate-500">Skills: {toListText(resume.extractedSkills)}</p>
                  </div>
                  <Badge>{String(resume.validationStatus || 'resume')}</Badge>
                </div>
              </div>
            )) : <EmptyState message="No resume uploads found for this student." />}
          </div>
          {paginatedResumes.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedResumes.safePage} totalPages={paginatedResumes.totalPages} onChange={setResumePage} /></div> : null}
        </Card>
        <Card>
          <SectionTitle title="Job Recommendations" description="Recommendation snapshots and role-direction outputs generated for this student." />
          <div className="space-y-3">
            {paginatedRecommendations.items.length ? paginatedRecommendations.items.map((item) => (
              <div key={String(item.id)} className={softPanelClassName}>
                {(() => {
                  const recommendation = extractRecommendationSummary(item.payload)
                  return (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="admin-detail-heading font-medium">Recommendation snapshot</p>
                          <p className="admin-detail-meta mt-1 text-sm">{formatDate(item.createdAt)} | {String(item.language || 'both')}</p>
                        </div>
                        <Badge>{recommendation.fitScore}</Badge>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <DetailValue label="Recommended Role" value={recommendation.targetRole} />
                        <DetailValue label="Fit Score" value={recommendation.fitScore} />
                        <DetailValue label="Matched Skills" value={recommendation.matchedSkills.length ? recommendation.matchedSkills.join(', ') : '-'} />
                        <DetailValue label="Missing Skills" value={recommendation.missingSkills.length ? recommendation.missingSkills.join(', ') : '-'} />
                      </div>
                      <div className="admin-detail-snapshot-block mt-3 rounded-xl border px-3 py-3">
                        <p className="admin-detail-label text-xs font-semibold uppercase tracking-wide">Recommendation Reason</p>
                        <p className="admin-detail-copy mt-2 text-sm leading-6 whitespace-normal break-words">{recommendation.recommendationReason}</p>
                      </div>
                      <div className="admin-detail-snapshot-block mt-3 rounded-xl border px-3 py-3">
                        <p className="admin-detail-label text-xs font-semibold uppercase tracking-wide">Suggested Next Steps</p>
                        {recommendation.nextSteps.length ? (
                          <ul className="admin-detail-copy mt-2 space-y-2 text-sm leading-6">
                            {recommendation.nextSteps.map((step) => (
                              <li key={step} className="whitespace-normal break-words">- {step}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="admin-detail-copy mt-2 text-sm leading-6">No suggested next steps were saved for this recommendation.</p>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            )) : <EmptyState message="No job recommendation snapshots are available yet." />}
          </div>
          {paginatedRecommendations.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedRecommendations.safePage} totalPages={paginatedRecommendations.totalPages} onChange={setRecommendationPage} /></div> : null}
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Skill Gap Reports" description="Priority missing skills and guidance reports generated for this student." />
          <div className="space-y-3">
            {paginatedSkillGaps.items.length ? paginatedSkillGaps.items.map((report) => (
              <div key={String(report.id)} className={softPanelClassName}>
                <p className="font-medium text-slate-800">{String(report.title)}</p>
                <p className="mt-1 text-sm text-slate-500">{String(report.summary || '-')}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(report.createdAt)}</p>
              </div>
            )) : <EmptyState message="No skill gap reports generated yet." />}
          </div>
          {paginatedSkillGaps.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedSkillGaps.safePage} totalPages={paginatedSkillGaps.totalPages} onChange={setSkillGapPage} /></div> : null}
        </Card>
        <Card>
          <SectionTitle title="Interview Preparation Progress" description="Interview preparation reports and progress plans for this student." />
          <div className="space-y-3">
            {paginatedInterviewPrep.items.length ? paginatedInterviewPrep.items.map((item) => (
              <div key={String(item.id)} className={softPanelClassName}>
                <p className="font-medium text-slate-800">{String(item.title)}</p>
                <p className="mt-1 text-sm text-slate-500">{String(item.summary || '-')}</p>
                <p className="mt-2 text-xs text-slate-400">{formatDate(item.createdAt)}</p>
              </div>
            )) : <EmptyState message="No interview preparation progress reports are available yet." />}
          </div>
          {paginatedInterviewPrep.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedInterviewPrep.safePage} totalPages={paginatedInterviewPrep.totalPages} onChange={setInterviewPrepPage} /></div> : null}
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Mock Interview History" description="Mock interview attempts, weak areas, and recent scores." />
          <div className="space-y-3">
            {paginatedMocks.items.length ? paginatedMocks.items.map((item) => (
              <div key={String(item.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(item.targetRole || '-')} | {String(item.interviewType || '-')}</p>
                    <p className="text-sm text-slate-500">{String(item.domain || '-')} | {String(item.difficulty || '-')}</p>
                    <p className="mt-2 text-xs text-slate-500">Weak areas: {toListText(item.weakAreas)}</p>
                  </div>
                  <Badge>{`${String(item.score ?? 0)}%`}</Badge>
                </div>
              </div>
            )) : <EmptyState message="No mock interview history found for this student." />}
          </div>
          {paginatedMocks.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedMocks.safePage} totalPages={paginatedMocks.totalPages} onChange={setMockPage} /></div> : null}
        </Card>
        <Card>
          <SectionTitle title="Coding Test History" description="Coding round attempts, performance, and weak topics for coding-relevant roles." />
          <div className="space-y-3">
            {paginatedCoding.items.length ? paginatedCoding.items.map((item) => (
              <div key={String(item.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(item.role || '-')} | {String(item.selectedLanguage || '-')}</p>
                    <p className="text-sm text-slate-500">{String(item.domain || '-')} | {String(item.status || '-')}</p>
                    <p className="mt-2 text-xs text-slate-500">Weak topics: {toListText(item.weakTopics)}</p>
                  </div>
                  <Badge>{`${String(item.finalScore ?? 0)}%`}</Badge>
                </div>
              </div>
            )) : <EmptyState message="No coding test history exists for this student yet." />}
          </div>
          {paginatedCoding.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedCoding.safePage} totalPages={paginatedCoding.totalPages} onChange={setCodingPage} /></div> : null}
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Reports History" description="All reports created for this student across resume, recommendations, interview, mock, and coding workflows." />
          <div className="space-y-3">
            {paginatedReports.items.length ? paginatedReports.items.map((report) => (
              <div key={String(report.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(report.title || report.reportType)}</p>
                    <p className="text-sm text-slate-500">{String(report.reportType || '-')}</p>
                    <p className="mt-2 text-xs text-slate-500">{String(report.summary || '-')}</p>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(report.createdAt)}</p>
                </div>
              </div>
            )) : <EmptyState message="No report history exists for this student yet." />}
          </div>
          {paginatedReports.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedReports.safePage} totalPages={paginatedReports.totalPages} onChange={setReportsPage} /></div> : null}
        </Card>
        <Card>
          <SectionTitle title="Notifications Related to Student" description="Recent reminder emails and platform notifications relevant to this student account." />
          <div className="space-y-3">
            {paginatedNotifications.items.length ? paginatedNotifications.items.map((item) => (
              <div key={String(item.id)} className={softPanelClassName}>
                <p className="font-medium text-slate-800">{String(item.title || '-')}</p>
                <p className="mt-1 text-sm text-slate-500 whitespace-normal break-words">{String(item.message || '-')}</p>
                <p className="mt-2 text-xs text-slate-400">{String(item.type || '-')} | {formatDate(item.createdAt)}</p>
              </div>
            )) : <EmptyState message="No related notifications are available for this student." />}
          </div>
          {paginatedNotifications.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedNotifications.safePage} totalPages={paginatedNotifications.totalPages} onChange={setNotificationsPage} /></div> : null}
        </Card>
      </CardGrid>
    </div>
  )
}

export const AdminRecruitersManagementPage = () => {
  const navigate = useNavigate()
  const [recruiters, setRecruiters] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const loadRecruiters = async () => setRecruiters(await adminApi.listRecruiters())
  useEffect(() => { void loadRecruiters() }, [])

  const filtered = useMemo(() => recruiters.filter((recruiter) => {
    const matchesQuery = !query.trim() || `${recruiter.name} ${recruiter.email} ${recruiter.companyName} ${recruiter.designation}`.toLowerCase().includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || String(recruiter.accountStatus ?? 'active') === statusFilter
    return matchesQuery && matchesStatus
  }), [recruiters, query, statusFilter])
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => { setPage(1) }, [query, statusFilter])

  const updateRecruiterStatus = async (recruiterId: string, status: 'active' | 'rejected') => {
    await adminApi.updateUser(recruiterId, { accountStatus: status })
    await loadRecruiters()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Recruiters" subtitle="Manage recruiter accounts, review pending approvals, and open each recruiter’s company and activity view." />
      <Card className="grid gap-3 md:grid-cols-4">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recruiter, email, company, or designation" />
        <AppSelect
          className={textInputClassName}
          value={statusFilter}
          onChange={setStatusFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All statuses' },
            { value: 'pending', label: 'Pending' },
            { value: 'active', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'blocked', label: 'Blocked' },
          ])}
        />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{recruiters.filter((item) => String(item.accountStatus) === 'pending').length} pending approvals</div>
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} recruiters shown</div>
      </Card>
      <DataTable
        columns={['Recruiter', 'Company', 'Contact', 'Jobs', 'Status', 'Actions']}
        rows={paginated.items.map((recruiter) => ({
          Recruiter: <div><p className="font-semibold">{String(recruiter.name)}</p><p className="text-xs text-slate-500">{String(recruiter.designation || '-')}</p></div>,
          Company: <div><p>{String(recruiter.companyName || '-')}</p><p className="text-xs text-slate-500">{String(recruiter.companyWebsite || '-')}</p></div>,
          Contact: <div><p>{String(recruiter.email)}</p><p className="text-xs text-slate-500">{String(recruiter.phone || '-')}</p></div>,
          Jobs: <div><p>Posted jobs: {String(recruiter.postedJobsCount ?? 0)}</p><p className="text-xs text-slate-500">Created: {formatDate(recruiter.createdAt)}</p></div>,
          Status: <Badge>{String(recruiter.accountStatus || 'active')}</Badge>,
          Actions: (
            <div className="flex flex-wrap gap-2">
              <button className={primaryButtonClassName} onClick={() => navigate(`/admin/recruiters/${String(recruiter.id)}`)}>Open Recruiter</button>
              <button className={subtleButtonClassName} disabled={String(recruiter.accountStatus) === 'active'} onClick={() => { void updateRecruiterStatus(String(recruiter.id), 'active') }}>Approve</button>
              <button className={dangerButtonClassName} disabled={String(recruiter.accountStatus) === 'rejected'} onClick={() => { void updateRecruiterStatus(String(recruiter.id), 'rejected') }}>Reject</button>
            </div>
          ),
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
    </div>
  )
}

export const AdminRecruiterDetailPage = () => {
  const navigate = useNavigate()
  const { recruiterId = '' } = useParams()
  const [detail, setDetail] = useState<AdminRecord | null>(null)
  const [jobsPage, setJobsPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)

  useEffect(() => {
    if (!recruiterId) return
    void adminApi.getRecruiterDetail(recruiterId).then(setDetail)
  }, [recruiterId])

  const recruiter = (detail?.recruiter ?? {}) as AdminRecord
  const profile = (detail?.profile ?? {}) as AdminRecord
  const postedJobs = Array.isArray(detail?.postedJobs) ? detail?.postedJobs as AdminRecord[] : []
  const activityLogs = Array.isArray(detail?.activityLogs) ? detail?.activityLogs as AdminRecord[] : []
  const summary = (detail?.summary ?? {}) as AdminRecord
  const recruiterJobsConfig = { preferredPageSize: 10, minPageSize: 5, maxVisibleWeight: 1750, getItemWeight: estimateRecruiterJobWeight }
  const recruiterActivityConfig = { preferredPageSize: 10, minPageSize: 5, maxVisibleWeight: 1450, getItemWeight: estimateActivityWeight }
  const recruiterJobsFallback = useMemo(() => paginateAdaptiveItems(postedJobs, jobsPage, recruiterJobsConfig.preferredPageSize, { minPageSize: recruiterJobsConfig.minPageSize, maxVisibleWeight: recruiterJobsConfig.maxVisibleWeight }), [jobsPage, postedJobs])
  const recruiterActivityFallback = useMemo(() => paginateAdaptiveItems(activityLogs, activityPage, recruiterActivityConfig.preferredPageSize, { minPageSize: recruiterActivityConfig.minPageSize, maxVisibleWeight: recruiterActivityConfig.maxVisibleWeight }), [activityLogs, activityPage])
  const recruiterPairPages = useMemo(() => buildBalancedPairPages(postedJobs, activityLogs, recruiterJobsConfig, recruiterActivityConfig), [activityLogs, postedJobs])
  const paginatedJobs = useMemo(() => getBalancedSectionPage(jobsPage, recruiterPairPages.pagesA, recruiterJobsFallback), [jobsPage, recruiterJobsFallback, recruiterPairPages.pagesA])
  const paginatedActivity = useMemo(() => getBalancedSectionPage(activityPage, recruiterPairPages.pagesB, recruiterActivityFallback), [activityPage, recruiterActivityFallback, recruiterPairPages.pagesB])

  useEffect(() => {
    setJobsPage(1)
    setActivityPage(1)
  }, [recruiterId, postedJobs.length, activityLogs.length])

  return (
    <div className="space-y-6">
      <PageHeader
        title={recruiter.name ? `${String(recruiter.name)} | Recruiter Detail` : 'Recruiter Detail'}
        subtitle="Review recruiter profile, approval status, company details, and posted jobs in one structured view."
        action={<button className={subtleButtonClassName} onClick={() => navigate('/admin/recruiters')}>Back to Recruiters</button>}
      />
      <CardGrid>
        <Card>
          <SectionTitle title="Recruiter Summary" description="Account and approval overview for this recruiter." />
          <div className="grid gap-3 md:grid-cols-2">
            <DetailValue label="Work Email" value={String(recruiter.email || '-')} />
            <DetailValue label="Account Status" value={<Badge>{String(recruiter.accountStatus || 'active')}</Badge>} />
            <DetailValue label="Company Name" value={String(profile.companyName || '-')} />
            <DetailValue label="Designation" value={String(profile.designation || '-')} />
            <DetailValue label="Phone" value={String(profile.phone || '-')} />
            <DetailValue label="Company Website" value={String(profile.companyWebsite || '-')} />
          </div>
        </Card>
        <Card>
          <SectionTitle title="Recruiter Activity" description="Basic recruiter activity and job posting summary." />
          <div className="grid gap-3 md:grid-cols-2">
            <DetailValue label="Posted Jobs" value={String(summary.postedJobs ?? 0)} />
            <DetailValue label="Active Jobs" value={String(summary.activeJobs ?? 0)} />
            <DetailValue label="Created At" value={formatDate(recruiter.createdAt)} />
            <DetailValue label="Last Active" value={formatDate(recruiter.lastActiveAt)} />
          </div>
        </Card>
      </CardGrid>
      <CardGrid>
        <Card>
          <SectionTitle title="Posted Jobs" description="Job listings created by this recruiter account." />
          <div className="space-y-3">
            {paginatedJobs.items.length ? paginatedJobs.items.map((job) => (
              <div key={String(job.id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{String(job.title)}</p>
                    <p className="text-sm text-slate-500">{String(job.company || '-')} | {String(job.field || '-')} | {String(job.targetRole || '-')}</p>
                    <p className="mt-2 text-xs text-slate-500">{String(job.location || '-')} | {String(job.employmentType || '-')}</p>
                  </div>
                  <Badge>{String(job.status || 'active')}</Badge>
                </div>
                <p className="mt-2 text-xs text-slate-400">{formatDate(job.createdAt)}</p>
              </div>
            )) : <EmptyState message="This recruiter has not posted any jobs yet." />}
          </div>
          {paginatedJobs.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedJobs.safePage} totalPages={paginatedJobs.totalPages} onChange={setJobsPage} /></div> : null}
        </Card>
        <Card>
          <SectionTitle title="Activity Log" description="Recent approval and recruiter-related management activity." />
          <div className="space-y-3">
            {paginatedActivity.items.length ? paginatedActivity.items.map((item) => (
              <div key={String(item._id)} className={softPanelClassName}>
                <p className="font-medium text-slate-800">{String(item.title || '-')}</p>
                <p className="mt-1 text-sm text-slate-500 whitespace-normal break-words">{String(item.description || '-')}</p>
                <p className="mt-2 text-xs text-slate-400">{String(item.actionType || '-')} | {formatDate(item.createdAt)}</p>
              </div>
            )) : <EmptyState message="No recruiter-specific admin activity has been logged yet." />}
          </div>
          {paginatedActivity.totalPages > 1 ? <div className="mt-4"><CompactPagination page={paginatedActivity.safePage} totalPages={paginatedActivity.totalPages} onChange={setActivityPage} /></div> : null}
        </Card>
      </CardGrid>
    </div>
  )
}

export const AdminUserManagementPage = () => {
  const [users, setUsers] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const defaultCreateForm = {
    role: 'student',
    name: '',
    email: '',
    phone: '',
    password: '',
    company: '',
    designation: '',
    companyWebsite: '',
    forcePasswordReset: false,
  }
  const [createForm, setCreateForm] = useState(defaultCreateForm)

  const loadUsers = async () => setUsers(await adminApi.listUsers())
  useEffect(() => { void loadUsers() }, [])

  const filtered = useMemo(
    () => users.filter((user) => {
      const matchesQuery = !query.trim() || `${user.name} ${user.email} ${user.field} ${user.targetRole}`.toLowerCase().includes(query.trim().toLowerCase())
      const matchesRole = roleFilter === 'all' || String(user.role) === roleFilter
      const matchesStatus = statusFilter === 'all' || String(user.accountStatus ?? 'active') === statusFilter
      return matchesQuery && matchesRole && matchesStatus
    }),
    [users, query, roleFilter, statusFilter],
  )
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [query, roleFilter, statusFilter])

  const setCreateField = (field: string, value: string | boolean) => {
    setCreateForm((current) => ({ ...current, [field]: value }))
  }

  const resetCreateForm = () => {
    setCreateForm(defaultCreateForm)
    setCreateError('')
    setCreateSuccess('')
    setRoleMenuOpen(false)
  }

  const submitCreateUser = async () => {
    try {
      setCreateLoading(true)
      setCreateError('')
      setCreateSuccess('')
      const payload: Record<string, unknown> = {
        role: createForm.role,
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        forcePasswordReset: createForm.forcePasswordReset,
      }
      if (createForm.role === 'student' || createForm.role === 'admin') {
        payload.phone = createForm.phone
      }
      if (createForm.role === 'recruiter') {
        payload.phone = createForm.phone
        payload.company = createForm.company
        payload.designation = createForm.designation
        payload.companyWebsite = createForm.companyWebsite
      }
      const created = await adminApi.createUser(payload)
      await loadUsers()
      setCreateSuccess(`${String(created.name)} was created as an active ${String(created.role)} account.`)
      setCreateForm(defaultCreateForm)
      setCreateOpen(false)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create account.')
    } finally {
      setCreateLoading(false)
    }
  }

  const roleOptions = [
    { value: 'student', label: 'Student account', helper: 'Standard learner access' },
    { value: 'recruiter', label: 'Recruiter account', helper: 'Hiring workspace access' },
    { value: 'admin', label: 'Admin account', helper: 'Privileged platform control' },
  ] as const
  const selectedRoleOption = roleOptions.find((option) => option.value === createForm.role) ?? roleOptions[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Search, review, approve recruiter requests, and control student, recruiter, and admin accounts."
        action={<button className={primaryButtonClassName} onClick={() => { resetCreateForm(); setCreateOpen(true) }}>Create Account</button>}
      />
      <Card className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, field, or role" />
          <AppSelect
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: 'all', label: 'All roles' },
              { value: 'student', label: 'Student' },
              { value: 'recruiter', label: 'Recruiter' },
              { value: 'admin', label: 'Admin' },
            ]}
            className="admin-input"
          />
          <AppSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'active', label: 'Active' },
              { value: 'pending', label: 'Pending' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'deactivated', label: 'Deactivated' },
            ]}
            className="admin-input"
          />
          <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} users shown</div>
        </div>
      </Card>
      <DataTable
        columns={['User', 'Field / Role', 'Contact', 'Activity', 'Status', 'Actions']}
        rows={paginated.items.map((user) => ({
          User: <div><p className="font-semibold">{String(user.name)}</p><p className="text-xs text-slate-500">{String(user.role)}{user.createdManuallyByAdmin ? ' | Admin created' : ''}</p></div>,
          'Field / Role': <div><p>{String(user.field || user.company || '-')}</p><p className="text-xs text-slate-500">{String(user.targetRole || user.designation || '-')}</p></div>,
          Contact: <div><p>{String(user.email)}</p><p className="text-xs text-slate-500">{String(user.recruiterPhone || user.phone || '-')}</p><p className="text-xs text-slate-500">{String(user.companyWebsite || '')}</p></div>,
          Activity: <div><p>Reports: {String(user.reportCount ?? 0)}</p><p className="text-xs text-slate-500">Last active: {formatDate(user.lastActiveAt)}</p></div>,
          Status: <Badge>{String(user.accountStatus ?? 'active')}</Badge>,
          Actions: (
            <div className="flex flex-wrap gap-2">
                <AppSelect
                  value={String(user.role)}
                  onChange={(nextValue) => {
                    void adminApi.updateUser(String(user.id), { role: nextValue }).then(loadUsers)
                  }}
                  options={[
                    { value: 'student', label: 'Student' },
                    { value: 'recruiter', label: 'Recruiter' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                  className={`${smallSelectClassName} min-w-[9rem]`}
                />
                <AppSelect
                  value={String(user.accountStatus ?? 'active')}
                  onChange={(nextValue) => {
                    void adminApi.updateUser(String(user.id), { accountStatus: nextValue }).then(loadUsers)
                  }}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'pending', label: 'Pending' },
                    { value: 'rejected', label: 'Rejected' },
                    { value: 'blocked', label: 'Blocked' },
                    { value: 'deactivated', label: 'Deactivated' },
                  ]}
                  className={`${smallSelectClassName} min-w-[9rem]`}
                />
              <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteUser(String(user.id)).then(loadUsers) }}>Delete</button>
            </div>
          ),
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
      <AppModal
        open={createOpen}
        title="Create Account"
        onClose={() => setCreateOpen(false)}
        panelClassName="app-card max-w-2xl"
        titleClassName="text-white"
        bodyClassName="p-5"
      >
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Account type</label>
              <div className="relative">
                <button
                  type="button"
                  className={`${textInputClassName} admin-account-type-select flex items-center justify-between gap-3 text-left`}
                  onClick={() => setRoleMenuOpen((current) => !current)}
                >
                  <span>
                    <span className="block text-sm font-medium text-slate-700 dark:text-slate-100">{selectedRoleOption.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{selectedRoleOption.helper}</span>
                  </span>
                  <ChevronDown className={`admin-account-type-caret transition ${roleMenuOpen ? 'rotate-180' : ''}`} size={18} />
                </button>
                {roleMenuOpen ? (
                  <div className="admin-account-type-menu absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-2xl border p-2 shadow-xl">
                    {roleOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`admin-account-type-option flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left ${
                          createForm.role === option.value ? 'admin-account-type-option-active' : ''
                        }`}
                        onClick={() => {
                          setCreateField('role', option.value)
                          setRoleMenuOpen(false)
                        }}
                      >
                        <span>
                          <span className="block text-sm font-medium">{option.label}</span>
                          <span className="mt-1 block text-xs">{option.helper}</span>
                        </span>
                        {createForm.role === option.value ? <span className="text-sm font-semibold">✓</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`admin-account-type-chip rounded-full border px-3 py-1 text-xs font-medium ${createForm.role === 'student' ? 'admin-account-type-chip-active' : ''}`}>Student: active after creation</span>
                <span className={`admin-account-type-chip rounded-full border px-3 py-1 text-xs font-medium ${createForm.role === 'recruiter' ? 'admin-account-type-chip-active' : ''}`}>Recruiter: active by admin</span>
                <span className={`admin-account-type-chip rounded-full border px-3 py-1 text-xs font-medium ${createForm.role === 'admin' ? 'admin-account-type-chip-active' : ''}`}>Admin: privileged access</span>
              </div>
            </div>
            <div className="md:mt-7">
              <AdminSwitchRow
                label="Force password reset on first login"
                helper="Useful for manually created privileged accounts."
                checked={Boolean(createForm.forcePasswordReset)}
                onChange={(checked) => setCreateField('forcePasswordReset', checked)}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Full name</label>
              <input className={textInputClassName} value={createForm.name} onChange={(event) => setCreateField('name', event.target.value)} placeholder="Enter full name" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{createForm.role === 'recruiter' ? 'Work email' : 'Email'}</label>
              <input className={textInputClassName} value={createForm.email} onChange={(event) => setCreateField('email', event.target.value)} placeholder="name@example.com" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">{createForm.role === 'recruiter' ? 'Phone number' : 'Phone number (optional)'}</label>
              <input className={textInputClassName} value={createForm.phone} onChange={(event) => setCreateField('phone', event.target.value)} placeholder="Enter phone number" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Initial password</label>
              <input type="password" className={textInputClassName} value={createForm.password} onChange={(event) => setCreateField('password', event.target.value)} placeholder="Minimum 6 characters" />
            </div>
          </div>
          {createForm.role === 'recruiter' ? (
            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
              <div>
                <h4 className="font-semibold text-white">Recruiter company details</h4>
                <p className="mt-1 text-sm text-slate-400">Recruiters created here become active immediately and do not enter pending approval.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Company name</label>
                  <input className={textInputClassName} value={createForm.company} onChange={(event) => setCreateField('company', event.target.value)} placeholder="Company name" />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Designation</label>
                  <input className={textInputClassName} value={createForm.designation} onChange={(event) => setCreateField('designation', event.target.value)} placeholder="Talent Acquisition Lead" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">Company website</label>
                  <input className={textInputClassName} value={createForm.companyWebsite} onChange={(event) => setCreateField('companyWebsite', event.target.value)} placeholder="https://company.com" />
                </div>
              </div>
            </div>
          ) : null}
          {createSuccess ? <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{createSuccess}</p> : null}
          {createError ? <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{createError}</p> : null}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button className={subtleButtonClassName} onClick={() => setCreateOpen(false)} disabled={createLoading}>Cancel</button>
            <button className={primaryButtonClassName} onClick={() => void submitCreateUser()} disabled={createLoading}>
              {createLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

export const AdminRecruiterApprovalsPage = () => {
  const [requests, setRequests] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [page, setPage] = useState(1)

  const loadRequests = async () => setRequests(await adminApi.listRecruiterRequests())
  useEffect(() => { void loadRequests() }, [])

  const filtered = useMemo(
    () => requests.filter((request) => {
      const matchesQuery =
        !query.trim() ||
        `${request.fullName} ${request.email} ${request.companyName} ${request.designation} ${request.companyWebsite}`.toLowerCase().includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'all' || String(request.status ?? 'pending') === statusFilter
      return matchesQuery && matchesStatus
    }),
    [requests, query, statusFilter],
  )
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter])

  const updateRecruiterStatus = async (userId: string, nextStatus: 'active' | 'rejected') => {
    await adminApi.updateUser(userId, { accountStatus: nextStatus })
    await loadRequests()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Recruiter Approvals" subtitle="Review recruiter signups, verify company details, and approve or reject access requests." />
      <Card className="grid gap-3 md:grid-cols-4">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recruiter, company, email, or designation" />
        <AppSelect
          className={textInputClassName}
          value={statusFilter}
          onChange={setStatusFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All requests' },
            { value: 'pending', label: 'Pending' },
            { value: 'active', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ])}
        />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} requests shown</div>
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{requests.filter((item) => String(item.status) === 'pending').length} still pending</div>
      </Card>
      <DataTable
        columns={['Recruiter', 'Company', 'Contact', 'Request Date', 'Status', 'Actions']}
        rows={paginated.items.map((request) => ({
          Recruiter: <div><p className="font-semibold">{String(request.fullName)}</p><p className="text-xs text-slate-500">{String(request.designation || '-')}</p></div>,
          Company: <div><p>{String(request.companyName || '-')}</p><p className="text-xs text-slate-500">{String(request.companyWebsite || '-')}</p></div>,
          Contact: <div><p>{String(request.email)}</p><p className="text-xs text-slate-500">{String(request.phone || '-')}</p></div>,
          'Request Date': <div><p>{formatDate(request.createdAt)}</p><p className="text-xs text-slate-400">{request.decisionDate ? `Decision: ${formatDate(request.decisionDate)}` : 'Awaiting review'}</p></div>,
          Status: <Badge tone={String(request.status)}>{String(request.status || 'pending')}</Badge>,
          Actions: (
            <div className="flex flex-wrap gap-2">
              <button className={primaryButtonClassName} disabled={String(request.status) === 'active'} onClick={() => { void updateRecruiterStatus(String(request.id), 'active') }}>
                Approve
              </button>
              <button className={dangerButtonClassName} disabled={String(request.status) === 'rejected'} onClick={() => { void updateRecruiterStatus(String(request.id), 'rejected') }}>
                Reject
              </button>
            </div>
          ),
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
    </div>
  )
}

export const AdminResumeManagementPage = () => {
  const [resumes, setResumes] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadResumes = async () => setResumes(await adminApi.listResumes())
  useEffect(() => { void loadResumes() }, [])

  const filtered = useMemo(
    () => resumes.filter((resume) => {
      const matchesQuery = !query.trim() || `${resume.userName} ${resume.userEmail} ${resume.fileName}`.toLowerCase().includes(query.trim().toLowerCase())
      const matchesStatus = statusFilter === 'all' || String(resume.validationStatus) === statusFilter
      return matchesQuery && matchesStatus
    }),
    [resumes, query, statusFilter],
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Resume Management" subtitle="Monitor uploads, review extracted content, and remove invalid or problematic files." />
      <Card className="grid gap-3 md:grid-cols-3">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user or file" />
        <AppSelect
          className={textInputClassName}
          value={statusFilter}
          onChange={setStatusFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All validation states' },
            { value: 'resume', label: 'Resume' },
            { value: 'job_description', label: 'Job description' },
            { value: 'other', label: 'Other' },
          ])}
        />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} resumes shown</div>
      </Card>
      <DataTable
        columns={['Resume', 'Owner', 'Analysis', 'Extracted Content', 'Status', 'Actions']}
        rows={filtered.map((resume) => ({
          Resume: <div><p className="font-semibold">{String(resume.fileName)}</p><p className="text-xs text-slate-500">{String(resume.fileType)} | {formatDate(resume.uploadDate)}</p></div>,
          Owner: <div><p>{String(resume.userName)}</p><p className="text-xs text-slate-500">{String(resume.userEmail)}</p></div>,
          Analysis: <div><p>{resume.analysisCompleted ? 'Completed' : 'Pending'}</p><p className="text-xs text-slate-500">Skills: {toListText(resume.extractedSkills).slice(0, 50) || '-'}</p></div>,
          'Extracted Content': <p className="max-w-md text-xs text-slate-500">{String(resume.contentPreview || '-')}</p>,
          Status: <Badge>{String(resume.validationStatus || 'resume')}</Badge>,
          Actions: <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteResume(String(resume.id)).then(loadResumes) }}>Remove</button>,
        }))}
      />
    </div>
  )
}

export const AdminFieldRoleManagementPage = () => {
  const [fields, setFields] = useState<AdminRecord[]>([])
  const [newField, setNewField] = useState({ key: '', label: '', description: '', roles: '' })

  const loadFields = async () => setFields(await adminApi.listFields())
  useEffect(() => { void loadFields() }, [])

  const updateRoleState = async (fieldKey: string, roleLabel: string, active: boolean) => {
    const field = fields.find((item) => String(item.key) === fieldKey)
    if (!field) return
    const roles = Array.isArray(field.roles) ? field.roles.map((role: AdminRecord) => (
      String(role.label) === roleLabel ? { ...role, active } : role
    )) : []
    await adminApi.updateField(fieldKey, { roles })
    await loadFields()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Field and Role Management" subtitle="Maintain supported fields, role labels, and activation state without editing code." />
      <Card className="space-y-4">
        <SectionTitle title="Add Supported Field" description="Create a new domain and role group for future platform guidance." />
        <div className="grid gap-3 lg:grid-cols-4">
          <input className={textInputClassName} value={newField.key} onChange={(event) => setNewField((current) => ({ ...current, key: event.target.value }))} placeholder="field_key" />
          <input className={textInputClassName} value={newField.label} onChange={(event) => setNewField((current) => ({ ...current, label: event.target.value }))} placeholder="Field label" />
          <input className={textInputClassName} value={newField.description} onChange={(event) => setNewField((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
          <input className={textInputClassName} value={newField.roles} onChange={(event) => setNewField((current) => ({ ...current, roles: event.target.value }))} placeholder="Roles comma separated" />
        </div>
        <button
          className={primaryButtonClassName}
          onClick={() => {
            void adminApi.createField({
              key: newField.key,
              label: newField.label,
              description: newField.description,
              active: true,
              roles: toArray(newField.roles).map((label) => ({ label, active: true })),
            }).then(() => {
              setNewField({ key: '', label: '', description: '', roles: '' })
              return loadFields()
            })
          }}
        >
          Add Field
        </button>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {fields.map((field) => (
          <Card key={String(field.key)} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{String(field.label)}</p>
                <p className="text-xs text-slate-500">{String(field.key)}</p>
              </div>
              <Badge>{field.active ? 'active' : 'inactive'}</Badge>
            </div>
            <input className={textInputClassName} defaultValue={String(field.label)} onBlur={(event) => { void adminApi.updateField(String(field.key), { label: event.target.value }).then(loadFields) }} />
            <textarea className={textareaClassName} defaultValue={String(field.description ?? '')} onBlur={(event) => { void adminApi.updateField(String(field.key), { description: event.target.value }).then(loadFields) }} />
            <input className={textInputClassName} defaultValue={Array.isArray(field.roles) ? field.roles.map((role: AdminRecord) => role.label).join(', ') : ''} onBlur={(event) => {
              void adminApi.updateField(String(field.key), { roles: toArray(event.target.value).map((label) => ({ label, active: true })) }).then(loadFields)
            }} />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Roles in this domain</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(field.roles) && field.roles.length ? field.roles.map((role: AdminRecord) => (
                  <button
                    key={String(role.label)}
                    className={`${String(role.active ?? true) === 'true' || role.active ? subtleButtonClassName : dangerButtonClassName} px-3 py-1.5 text-xs`}
                    onClick={() => { void updateRoleState(String(field.key), String(role.label), !Boolean(role.active)) }}
                  >
                    {String(role.label)} | {role.active ? 'Active' : 'Inactive'}
                  </button>
                )) : <p className="text-xs text-slate-400">No roles added yet.</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button className={subtleButtonClassName} onClick={() => { void adminApi.updateField(String(field.key), { active: !field.active }).then(loadFields) }}>
                {field.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export const AdminQuestionBankManagementPage = () => {
  const [tab, setTab] = useState<'interview' | 'coding'>('interview')
  const [interviewQuestions, setInterviewQuestions] = useState<AdminRecord[]>([])
  const [codingQuestions, setCodingQuestions] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [fieldFilter, setFieldFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [jsonImport, setJsonImport] = useState('')
  const [editingInterviewId, setEditingInterviewId] = useState('')
  const [editingCodingId, setEditingCodingId] = useState('')
  const [questionForm, setQuestionForm] = useState<AdminRecord>({ field: 'it_software', role: '', category: '', topic: '', difficulty: 'Intermediate', companyType: 'general', experienceLevel: 'fresher', questionText: '', answerHint: '', keyPoints: '', commonMistakes: '', tags: '' })
  const [codingForm, setCodingForm] = useState<AdminRecord>({ domain: 'it_software', role: '', topic: '', difficulty: 'Intermediate', title: '', problemStatement: '', inputFormat: '', outputFormat: '', constraints: '', sampleInput: '', sampleOutput: '', explanation: '', supportedLanguages: 'python,javascript', timeLimit: 2, memoryLimit: 256, visibleTestCases: '[]', hiddenTestCases: '[]', tags: '' })

  const loadInterview = async () => setInterviewQuestions(await adminApi.listInterviewQuestions())
  const loadCoding = async () => setCodingQuestions(await adminApi.listCodingQuestions())
  useEffect(() => { void loadInterview(); void loadCoding() }, [])

  const filteredInterview = useMemo(
    () => interviewQuestions.filter((item) => {
      const matchesQuery = !query.trim() || `${item.field} ${item.role} ${item.topic} ${item.questionText} ${item.category}`.toLowerCase().includes(query.toLowerCase())
      const matchesField = fieldFilter === 'all' || String(item.field) === fieldFilter
      const matchesDifficulty = difficultyFilter === 'all' || String(item.difficulty) === difficultyFilter
      return matchesQuery && matchesField && matchesDifficulty
    }),
    [interviewQuestions, query, fieldFilter, difficultyFilter],
  )
  const filteredCoding = useMemo(
    () => codingQuestions.filter((item) => {
      const matchesQuery = !query.trim() || `${item.domain} ${item.role} ${item.topic} ${item.title}`.toLowerCase().includes(query.toLowerCase())
      const matchesField = fieldFilter === 'all' || String(item.domain) === fieldFilter
      const matchesDifficulty = difficultyFilter === 'all' || String(item.difficulty) === difficultyFilter
      return matchesQuery && matchesField && matchesDifficulty
    }),
    [codingQuestions, query, fieldFilter, difficultyFilter],
  )
  const paginatedInterview = useMemo(() => paginateAdaptiveItems(filteredInterview, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filteredInterview, page])
  const paginatedCoding = useMemo(() => paginateAdaptiveItems(filteredCoding, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filteredCoding, page])

  useEffect(() => {
    setPage(1)
  }, [tab, query, fieldFilter, difficultyFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Question Bank Management" subtitle="Maintain multi-field interview and coding question banks directly from the admin panel." />
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className={tab === 'interview' ? primaryButtonClassName : subtleButtonClassName} onClick={() => setTab('interview')}>Interview Questions</button>
          <button className={tab === 'coding' ? primaryButtonClassName : subtleButtonClassName} onClick={() => setTab('coding')}>Coding Questions</button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by field, role, topic, question, or title" />
          <input className={textInputClassName} value={fieldFilter === 'all' ? '' : fieldFilter} onChange={(event) => setFieldFilter(event.target.value.trim() || 'all')} placeholder="Field or domain filter" />
          <AppSelect
            className={textInputClassName}
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            options={asSelectOptions([
              { value: 'all', label: 'All difficulties' },
              'Beginner',
              'Intermediate',
              'Advanced',
            ])}
          />
          <button
            className={subtleButtonClassName}
            onClick={() => downloadJsonFile(
              tab === 'interview' ? 'careercompass-interview-bank.json' : 'careercompass-coding-bank.json',
              tab === 'interview' ? filteredInterview : filteredCoding,
            )}
          >
            Export {tab === 'interview' ? 'Interview' : 'Coding'} JSON
          </button>
        </div>
      </Card>

      {tab === 'interview' ? (
        <>
          <Card className="space-y-4">
            <SectionTitle title="Add Interview Question" description="Store custom multi-domain interview questions that become available to the platform." />
            <div className="grid gap-3 lg:grid-cols-3">
              <input className={textInputClassName} value={questionForm.field} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, field: event.target.value }))} placeholder="Field" />
              <input className={textInputClassName} value={questionForm.role} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, role: event.target.value }))} placeholder="Role" />
              <input className={textInputClassName} value={questionForm.category} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, category: event.target.value }))} placeholder="Category" />
              <input className={textInputClassName} value={questionForm.topic} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, topic: event.target.value }))} placeholder="Topic" />
              <AppSelect
                className={textInputClassName}
                value={String(questionForm.difficulty ?? 'Beginner')}
                onChange={(value) => setQuestionForm((current: AdminRecord) => ({ ...current, difficulty: value }))}
                options={asSelectOptions(['Beginner', 'Intermediate', 'Advanced'])}
              />
              <input className={textInputClassName} value={questionForm.companyType} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, companyType: event.target.value }))} placeholder="Company type" />
            </div>
            <textarea className={textareaClassName} value={questionForm.questionText} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, questionText: event.target.value }))} placeholder="Question text" />
            <textarea className={textareaClassName} value={questionForm.answerHint} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, answerHint: event.target.value }))} placeholder="Answer hint" />
            <div className="grid gap-3 lg:grid-cols-3">
              <input className={textInputClassName} value={questionForm.keyPoints} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, keyPoints: event.target.value }))} placeholder="Key points comma separated" />
              <input className={textInputClassName} value={questionForm.commonMistakes} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, commonMistakes: event.target.value }))} placeholder="Common mistakes comma separated" />
              <input className={textInputClassName} value={questionForm.tags} onChange={(event) => setQuestionForm((current: AdminRecord) => ({ ...current, tags: event.target.value }))} placeholder="Tags comma separated" />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={primaryButtonClassName}
                onClick={() => {
                  const payload = {
                    ...questionForm,
                    keyPoints: toArray(String(questionForm.keyPoints ?? '')),
                    commonMistakes: toArray(String(questionForm.commonMistakes ?? '')),
                    tags: toArray(String(questionForm.tags ?? '')),
                  }
                  const action = editingInterviewId
                    ? adminApi.updateInterviewQuestion(editingInterviewId, payload)
                    : adminApi.createInterviewQuestion(payload)
                  void action.then(() => {
                    setEditingInterviewId('')
                    setQuestionForm({ field: 'it_software', role: '', category: '', topic: '', difficulty: 'Intermediate', companyType: 'general', experienceLevel: 'fresher', questionText: '', answerHint: '', keyPoints: '', commonMistakes: '', tags: '' })
                    return loadInterview()
                  })
                }}
              >
                {editingInterviewId ? 'Update Interview Question' : 'Save Interview Question'}
              </button>
              {editingInterviewId ? <button className={subtleButtonClassName} onClick={() => { setEditingInterviewId(''); setQuestionForm({ field: 'it_software', role: '', category: '', topic: '', difficulty: 'Intermediate', companyType: 'general', experienceLevel: 'fresher', questionText: '', answerHint: '', keyPoints: '', commonMistakes: '', tags: '' }) }}>Cancel Edit</button> : null}
            </div>
          </Card>
          <Card className="space-y-4">
            <SectionTitle title="Bulk Import from JSON" description="Paste an array of interview question objects to import them at once." />
            <textarea className={textareaClassName} value={jsonImport} onChange={(event) => setJsonImport(event.target.value)} placeholder='[{"field":"it_software","role":"Backend Developer","category":"Technical","topic":"Node.js","difficulty":"Intermediate","companyType":"service company","experienceLevel":"fresher","questionText":"Explain event loop","answerHint":"...","keyPoints":["..."],"commonMistakes":["..."],"tags":["node"]}]' />
            <button
              className={primaryButtonClassName}
              onClick={() => {
                try {
                  const parsed = JSON.parse(jsonImport) as Array<Record<string, unknown>>
                  void adminApi.importInterviewQuestions(parsed).then(() => {
                    setJsonImport('')
                    return loadInterview()
                  })
                } catch {
                  alert('Invalid JSON format.')
                }
              }}
            >
              Import JSON
            </button>
          </Card>
          <DataTable
            columns={['Question', 'Field / Role', 'Difficulty', 'Tags', 'Source', 'Actions']}
            rows={paginatedInterview.items.map((item) => ({
              Question: <div><p className="font-semibold">{String(item.questionText)}</p><p className="text-xs text-slate-500">{String(item.category)} | {String(item.topic)}</p></div>,
              'Field / Role': <div><p>{String(item.field)}</p><p className="text-xs text-slate-500">{String(item.role)}</p></div>,
              Difficulty: <Badge>{String(item.difficulty)}</Badge>,
              Tags: <p className="max-w-xs text-xs text-slate-500">{toListText(item.tags)}</p>,
              Source: <Badge>{String(item.source ?? 'admin')}</Badge>,
              Actions: item.source === 'bundled' ? <span className="text-xs text-slate-400">Bundled</span> : (
                <div className="flex flex-wrap gap-2">
                  <button className={subtleButtonClassName} onClick={() => {
                    setEditingInterviewId(String(item.id))
                    setQuestionForm({
                      field: String(item.field ?? 'it_software'),
                      role: String(item.role ?? ''),
                      category: String(item.category ?? ''),
                      topic: String(item.topic ?? ''),
                      difficulty: String(item.difficulty ?? 'Intermediate'),
                      companyType: String(item.companyType ?? 'general'),
                      experienceLevel: String(item.experienceLevel ?? 'fresher'),
                      questionText: String(item.questionText ?? ''),
                      answerHint: String(item.answerHint ?? ''),
                      keyPoints: toListText(item.keyPoints),
                      commonMistakes: toListText(item.commonMistakes),
                      tags: toListText(item.tags),
                    })
                  }}>Edit</button>
                  <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteInterviewQuestion(String(item.id)).then(loadInterview) }}>Delete</button>
                </div>
              ),
            }))}
          />
          <CompactPagination page={paginatedInterview.safePage} totalPages={paginatedInterview.totalPages} onChange={setPage} />
        </>
      ) : (
        <>
          <Card className="space-y-4">
            <SectionTitle title="Add Coding Question" description="Maintain coding round content for coding-related roles and domains." />
            <div className="grid gap-3 lg:grid-cols-3">
              <input className={textInputClassName} value={codingForm.domain} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, domain: event.target.value }))} placeholder="Domain" />
              <input className={textInputClassName} value={codingForm.role} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, role: event.target.value }))} placeholder="Role" />
              <input className={textInputClassName} value={codingForm.topic} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, topic: event.target.value }))} placeholder="Topic" />
              <input className={textInputClassName} value={codingForm.title} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, title: event.target.value }))} placeholder="Problem title" />
              <AppSelect
                className={textInputClassName}
                value={String(codingForm.difficulty ?? 'Beginner')}
                onChange={(value) => setCodingForm((current: AdminRecord) => ({ ...current, difficulty: value }))}
                options={asSelectOptions(['Beginner', 'Intermediate', 'Advanced'])}
              />
              <input className={textInputClassName} value={codingForm.supportedLanguages} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, supportedLanguages: event.target.value }))} placeholder="Languages comma separated" />
            </div>
            <textarea className={textareaClassName} value={codingForm.problemStatement} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, problemStatement: event.target.value }))} placeholder="Problem statement" />
            <div className="grid gap-3 lg:grid-cols-2">
              <textarea className={textareaClassName} value={codingForm.inputFormat} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, inputFormat: event.target.value }))} placeholder="Input format" />
              <textarea className={textareaClassName} value={codingForm.outputFormat} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, outputFormat: event.target.value }))} placeholder="Output format" />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <textarea className={textareaClassName} value={codingForm.visibleTestCases} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, visibleTestCases: event.target.value }))} placeholder='Visible test cases JSON [{"input":"1 2","output":"3"}]' />
              <textarea className={textareaClassName} value={codingForm.hiddenTestCases} onChange={(event) => setCodingForm((current: AdminRecord) => ({ ...current, hiddenTestCases: event.target.value }))} placeholder='Hidden test cases JSON [{"input":"2 3","output":"5"}]' />
            </div>
            <button
              className={primaryButtonClassName}
              onClick={() => {
                try {
                  const payload = {
                    ...codingForm,
                    constraints: toArray(String(codingForm.constraints ?? '')),
                    supportedLanguages: toArray(String(codingForm.supportedLanguages ?? '')),
                    visibleTestCases: JSON.parse(String(codingForm.visibleTestCases || '[]')),
                    hiddenTestCases: JSON.parse(String(codingForm.hiddenTestCases || '[]')),
                    tags: toArray(String(codingForm.tags ?? '')),
                  }
                  const action = editingCodingId
                    ? adminApi.updateCodingQuestion(editingCodingId, payload)
                    : adminApi.createCodingQuestion(payload)
                  void action.then(() => {
                    setEditingCodingId('')
                    setCodingForm({ domain: 'it_software', role: '', topic: '', difficulty: 'Intermediate', title: '', problemStatement: '', inputFormat: '', outputFormat: '', constraints: '', sampleInput: '', sampleOutput: '', explanation: '', supportedLanguages: 'python,javascript', timeLimit: 2, memoryLimit: 256, visibleTestCases: '[]', hiddenTestCases: '[]', tags: '' })
                    return loadCoding()
                  })
                } catch {
                  alert('Visible/hidden test cases must be valid JSON arrays.')
                }
              }}
            >
              {editingCodingId ? 'Update Coding Question' : 'Save Coding Question'}
            </button>
            {editingCodingId ? <button className={subtleButtonClassName} onClick={() => { setEditingCodingId(''); setCodingForm({ domain: 'it_software', role: '', topic: '', difficulty: 'Intermediate', title: '', problemStatement: '', inputFormat: '', outputFormat: '', constraints: '', sampleInput: '', sampleOutput: '', explanation: '', supportedLanguages: 'python,javascript', timeLimit: 2, memoryLimit: 256, visibleTestCases: '[]', hiddenTestCases: '[]', tags: '' }) }}>Cancel Edit</button> : null}
          </Card>
          <DataTable
            columns={['Problem', 'Domain / Role', 'Difficulty', 'Languages', 'Source', 'Actions']}
            rows={paginatedCoding.items.map((item) => ({
              Problem: <div><p className="font-semibold">{String(item.title)}</p><p className="text-xs text-slate-500">{String(item.topic)}</p></div>,
              'Domain / Role': <div><p>{String(item.domain)}</p><p className="text-xs text-slate-500">{String(item.role)}</p></div>,
              Difficulty: <Badge>{String(item.difficulty)}</Badge>,
              Languages: <p className="text-xs text-slate-500">{toListText(item.supportedLanguages)}</p>,
              Source: <Badge>{String(item.source ?? 'admin')}</Badge>,
              Actions: item.source === 'bundled' ? <span className="text-xs text-slate-400">Bundled</span> : (
                <div className="flex flex-wrap gap-2">
                  <button className={subtleButtonClassName} onClick={() => {
                    setEditingCodingId(String(item.id))
                    setCodingForm({
                      domain: String(item.domain ?? 'it_software'),
                      role: String(item.role ?? ''),
                      topic: String(item.topic ?? ''),
                      difficulty: String(item.difficulty ?? 'Intermediate'),
                      title: String(item.title ?? ''),
                      problemStatement: String(item.problemStatement ?? ''),
                      inputFormat: String(item.inputFormat ?? ''),
                      outputFormat: String(item.outputFormat ?? ''),
                      constraints: toListText(item.constraints),
                      sampleInput: String(item.sampleInput ?? ''),
                      sampleOutput: String(item.sampleOutput ?? ''),
                      explanation: String(item.explanation ?? ''),
                      supportedLanguages: toListText(item.supportedLanguages),
                      timeLimit: Number(item.timeLimit ?? 2),
                      memoryLimit: Number(item.memoryLimit ?? 256),
                      visibleTestCases: JSON.stringify(item.visibleTestCases ?? [], null, 2),
                      hiddenTestCases: JSON.stringify(item.hiddenTestCases ?? [], null, 2),
                      tags: toListText(item.tags),
                    })
                  }}>Edit</button>
                  <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteCodingQuestion(String(item.id)).then(loadCoding) }}>Delete</button>
                </div>
              ),
            }))}
          />
          <CompactPagination page={paginatedCoding.safePage} totalPages={paginatedCoding.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}

export const AdminJobManagementPage = () => {
  const [jobs, setJobs] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [fieldFilter, setFieldFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [jobForm, setJobForm] = useState<AdminRecord>({ title: '', company: '', field: '', targetRole: '', location: '', applyLink: '', employmentType: 'full-time', requiredSkills: '', description: '', status: 'active' })

  const loadJobs = async () => setJobs(await adminApi.listJobs())
  useEffect(() => { void loadJobs() }, [])

  const filtered = useMemo(() => jobs.filter((job) => {
    const matchesQuery = `${job.title} ${job.company} ${job.field} ${job.targetRole} ${job.location}`.toLowerCase().includes(query.toLowerCase())
    const matchesField = fieldFilter === 'all' || String(job.field) === fieldFilter
    const matchesStatus = statusFilter === 'all' || String(job.status) === statusFilter
    return matchesQuery && matchesField && matchesStatus
  }), [jobs, query, fieldFilter, statusFilter])
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => { setPage(1) }, [query, fieldFilter, statusFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Job Management" subtitle="Manage multi-field job listings, recommendation source content, and activation state." />
      <Card className="space-y-4">
        <SectionTitle title="Add Job Listing" description="Create a job or internship listing available for matching and recommendations." />
        <div className="grid gap-3 lg:grid-cols-3">
          <input className={textInputClassName} value={jobForm.title} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, title: event.target.value }))} placeholder="Job title" />
          <input className={textInputClassName} value={jobForm.company} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, company: event.target.value }))} placeholder="Company" />
          <input className={textInputClassName} value={jobForm.field} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, field: event.target.value }))} placeholder="Field / domain" />
          <input className={textInputClassName} value={jobForm.targetRole} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, targetRole: event.target.value }))} placeholder="Target role" />
          <input className={textInputClassName} value={jobForm.location} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, location: event.target.value }))} placeholder="Location" />
          <input className={textInputClassName} value={jobForm.applyLink} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, applyLink: event.target.value }))} placeholder="Apply link" />
          <input className={textInputClassName} value={jobForm.employmentType} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, employmentType: event.target.value }))} placeholder="Employment type" />
          <AppSelect
            className={textInputClassName}
            value={String(jobForm.status ?? 'active')}
            onChange={(value) => setJobForm((current: AdminRecord) => ({ ...current, status: value }))}
            options={asSelectOptions([
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ])}
          />
          <input className={textInputClassName} value={jobForm.requiredSkills} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, requiredSkills: event.target.value }))} placeholder="Required skills comma separated" />
        </div>
        <textarea className={textareaClassName} value={jobForm.description} onChange={(event) => setJobForm((current: AdminRecord) => ({ ...current, description: event.target.value }))} placeholder="Job description" />
        <button className={primaryButtonClassName} onClick={() => {
          void adminApi.createJob({ ...jobForm, requiredSkills: toArray(String(jobForm.requiredSkills ?? '')) }).then(() => {
            setJobForm({ title: '', company: '', field: '', targetRole: '', location: '', applyLink: '', employmentType: 'full-time', requiredSkills: '', description: '', status: 'active' })
            return loadJobs()
          })
        }}>Create Job</button>
      </Card>
      <Card className="grid gap-3 md:grid-cols-4">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title, company, field, role, or location" />
        <input className={textInputClassName} value={fieldFilter === 'all' ? '' : fieldFilter} onChange={(event) => setFieldFilter(event.target.value.trim() || 'all')} placeholder="Field filter" />
        <AppSelect
          className={textInputClassName}
          value={statusFilter}
          onChange={setStatusFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ])}
        />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} jobs shown</div>
      </Card>
      <DataTable
        columns={['Job', 'Field / Role', 'Company / Location', 'Skills', 'Status', 'Actions']}
        rows={paginated.items.map((job) => ({
          Job: <div><p className="font-semibold">{String(job.title)}</p><p className="text-xs text-slate-500">{String(job.employmentType || 'full-time')}</p></div>,
          'Field / Role': <div><p>{String(job.field || '-')}</p><p className="text-xs text-slate-500">{String(job.targetRole || '-')}</p></div>,
          'Company / Location': <div><p>{String(job.company)}</p><p className="text-xs text-slate-500">{String(job.location || '-')}</p></div>,
          Skills: <p className="max-w-xs text-xs text-slate-500">{toListText(job.requiredSkills)}</p>,
          Status: (
            <AppSelect
              className={smallSelectClassName}
              value={String(job.status ?? 'active')}
              onChange={(value) => {
                void adminApi.updateJob(String(job.id), { status: value }).then(loadJobs)
              }}
              options={asSelectOptions([
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ])}
            />
          ),
          Actions: <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteJob(String(job.id)).then(loadJobs) }}>Delete</button>,
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
    </div>
  )
}

export const AdminReportsManagementPage = () => {
  const [reports, setReports] = useState<AdminRecord[]>([])
  const [query, setQuery] = useState('')
  const [fieldFilter, setFieldFilter] = useState('all')
  const [reportTypeFilter, setReportTypeFilter] = useState('all')
  const [page, setPage] = useState(1)

  const loadReports = async () => setReports(await adminApi.listReports())
  useEffect(() => { void loadReports() }, [])

  const filtered = useMemo(() => reports.filter((report) => {
    const matchesQuery = `${report.userName} ${report.reportType} ${report.field} ${report.targetRole} ${report.title}`.toLowerCase().includes(query.toLowerCase())
    const matchesField = fieldFilter === 'all' || String(report.field) === fieldFilter
    const matchesType = reportTypeFilter === 'all' || String(report.reportType) === reportTypeFilter
    return matchesQuery && matchesField && matchesType
  }), [reports, query, fieldFilter, reportTypeFilter])
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => { setPage(1) }, [query, fieldFilter, reportTypeFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Reports Management" subtitle="Inspect generated reports, monitor output quality, and remove invalid records when needed." />
      <Card className="grid gap-3 md:grid-cols-4">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by user, type, field, role, or title" />
        <input className={textInputClassName} value={fieldFilter === 'all' ? '' : fieldFilter} onChange={(event) => setFieldFilter(event.target.value.trim() || 'all')} placeholder="Field filter" />
        <input className={textInputClassName} value={reportTypeFilter === 'all' ? '' : reportTypeFilter} onChange={(event) => setReportTypeFilter(event.target.value.trim() || 'all')} placeholder="Report type filter" />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} reports shown</div>
      </Card>
      <DataTable
        columns={['Report', 'User', 'Field / Role', 'Score', 'Date', 'Actions']}
        rows={paginated.items.map((report) => ({
          Report: <div><p className="font-semibold">{String(report.title)}</p><p className="text-xs text-slate-500">{String(report.reportType)}</p></div>,
          User: <div><p>{String(report.userName)}</p><p className="text-xs text-slate-500">{String(report.userEmail)}</p></div>,
          'Field / Role': <div><p>{String(report.field || '-')}</p><p className="text-xs text-slate-500">{String(report.targetRole || '-')}</p></div>,
          Score: <Badge>{String(report.score ?? 0)}</Badge>,
          Date: formatDate(report.createdAt),
          Actions: <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteReport(String(report.id)).then(loadReports) }}>Delete</button>,
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
    </div>
  )
}

export const AdminMockInterviewManagementPage = () => {
  const [sessions, setSessions] = useState<AdminRecord[]>([])
  useEffect(() => { void adminApi.listMockInterviews().then(setSessions) }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Mock Interview Management" subtitle="Track usage, field-wise trends, weak topics, and evaluation quality across mock interview sessions." />
      <StatCards
        stats={[
          { label: 'Total Attempts', value: String(sessions.length) },
          { label: 'Completed Sessions', value: String(sessions.filter((item) => item.status === 'completed').length) },
          { label: 'Top Domain', value: String(Object.entries(sessions.reduce<Record<string, number>>((acc, item) => ({ ...acc, [String(item.domain || 'general')]: (acc[String(item.domain || 'general')] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-') },
          { label: 'Avg Score', value: sessions.length ? `${Math.round(sessions.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / sessions.length)}%` : '0%' },
        ]}
      />
      <DataTable
        columns={['User', 'Interview', 'Difficulty', 'Score', 'Weak Topics', 'Date']}
        rows={sessions.map((item) => ({
          User: <div><p className="font-semibold">{String(item.userName)}</p><p className="text-xs text-slate-500">{String(item.userEmail)}</p></div>,
          Interview: <div><p>{String(item.targetRole || '-')}</p><p className="text-xs text-slate-500">{String(item.domain || '-')} | {String(item.interviewType || '-')}</p></div>,
          Difficulty: <Badge>{String(item.difficulty || '-')}</Badge>,
          Score: <Badge>{`${String(item.score ?? 0)}%`}</Badge>,
          'Weak Topics': <p className="max-w-xs text-xs text-slate-500">{toListText(item.weakAreas)}</p>,
          Date: formatDate(item.createdAt),
        }))}
      />
    </div>
  )
}

export const AdminCodingTestManagementPage = () => {
  const [sessions, setSessions] = useState<AdminRecord[]>([])
  useEffect(() => { void adminApi.listCodingTests().then(setSessions) }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="Coding Test Management" subtitle="Monitor coding round performance, role relevance, and submission quality for coding-related domains." />
      <StatCards
        stats={[
          { label: 'Total Sessions', value: String(sessions.length) },
          { label: 'Passed', value: String(sessions.filter((item) => Number(item.passPercentage ?? 0) === 100).length) },
          { label: 'Partial', value: String(sessions.filter((item) => Number(item.passPercentage ?? 0) > 0 && Number(item.passPercentage ?? 0) < 100).length) },
          { label: 'Average Pass %', value: sessions.length ? `${Math.round(sessions.reduce((sum, item) => sum + Number(item.passPercentage ?? 0), 0) / sessions.length)}%` : '0%' },
        ]}
      />
      <DataTable
        columns={['User', 'Role / Domain', 'Language', 'Status', 'Weak Topics', 'Date']}
        rows={sessions.map((item) => ({
          User: <div><p className="font-semibold">{String(item.userName)}</p><p className="text-xs text-slate-500">{String(item.userEmail)}</p></div>,
          'Role / Domain': <div><p>{String(item.role || '-')}</p><p className="text-xs text-slate-500">{String(item.domain || '-')}</p></div>,
          Language: String(item.selectedLanguage || '-'),
          Status: <Badge>{`${String(item.status || '-')} ${String(item.passPercentage ?? 0)}%`}</Badge>,
          'Weak Topics': <p className="max-w-xs text-xs text-slate-500">{toListText(item.weakTopics)}</p>,
          Date: formatDate(item.createdAt),
        }))}
      />
    </div>
  )
}

export const AdminNotificationsManagementPage = () => {
  const [notificationData, setNotificationData] = useState<AdminRecord>({ notifications: [], reminderHistory: [] })
  const [form, setForm] = useState<AdminRecord>({ title: '', message: '', tone: 'info', audience: 'all', actionLink: '' })
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [notificationQuery, setNotificationQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [notificationPage, setNotificationPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)

  const loadNotifications = async () => setNotificationData(await adminApi.listNotifications())
  useEffect(() => { void loadNotifications() }, [])

  const notifications = Array.isArray(notificationData.notifications) ? notificationData.notifications as AdminRecord[] : []
  const reminderHistory = Array.isArray(notificationData.reminderHistory) ? notificationData.reminderHistory as AdminRecord[] : []
  const filteredNotifications = useMemo(() => notifications.filter((item) => {
    const matchesQuery = !notificationQuery.trim() || `${item.title} ${item.message} ${item.audience}`.toLowerCase().includes(notificationQuery.toLowerCase())
    const matchesTone = notificationFilter === 'all' || String(item.tone) === notificationFilter
    return matchesQuery && matchesTone
  }), [notifications, notificationQuery, notificationFilter])
  const filteredHistory = useMemo(() => reminderHistory.filter((item) => historyFilter === 'all' || String(item.reminderType) === historyFilter), [reminderHistory, historyFilter])
  const paginatedNotifications = useMemo(() => paginateAdaptiveItems(filteredNotifications, notificationPage, 8, { minPageSize: 4, maxVisibleWeight: 1500 }), [filteredNotifications, notificationPage])
  const paginatedHistory = useMemo(() => paginateAdaptiveItems(filteredHistory, historyPage, 8, { minPageSize: 4, maxVisibleWeight: 1450 }), [filteredHistory, historyPage])

  useEffect(() => { setNotificationPage(1) }, [notificationFilter, notificationQuery])
  useEffect(() => { setHistoryPage(1) }, [historyFilter])

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications Management" subtitle="Create platform notices, review reminder history, and manage notification content." />
      <Card className="space-y-4">
        <SectionTitle title="Create Notification" description="Send a lightweight platform-wide or role-targeted notice." />
        <div className="grid gap-3 lg:grid-cols-4">
          <input className={textInputClassName} value={form.title} onChange={(event) => setForm((current: AdminRecord) => ({ ...current, title: event.target.value }))} placeholder="Title" />
          <AppSelect
            className={textInputClassName}
            value={String(form.tone ?? 'info')}
            onChange={(value) => setForm((current: AdminRecord) => ({ ...current, tone: value }))}
            options={asSelectOptions([
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'success', label: 'Success' },
            ])}
          />
          <AppSelect
            className={textInputClassName}
            value={String(form.audience ?? 'all')}
            onChange={(value) => setForm((current: AdminRecord) => ({ ...current, audience: value }))}
            options={asSelectOptions([
              { value: 'all', label: 'All users' },
              { value: 'students', label: 'Students' },
              { value: 'admins', label: 'Admins' },
              { value: 'recruiters', label: 'Recruiters' },
            ])}
          />
          <input className={textInputClassName} value={form.actionLink} onChange={(event) => setForm((current: AdminRecord) => ({ ...current, actionLink: event.target.value }))} placeholder="Optional action link" />
        </div>
        <textarea className={textareaClassName} value={form.message} onChange={(event) => setForm((current: AdminRecord) => ({ ...current, message: event.target.value }))} placeholder="Notification message" />
        <button className={primaryButtonClassName} onClick={() => { void adminApi.createNotification(form).then(() => { setForm({ title: '', message: '', tone: 'info', audience: 'all', actionLink: '' }); return loadNotifications() }) }}>Create Notification</button>
      </Card>
      <CardGrid>
        <Card>
          <SectionTitle title="Saved Notifications" description="Custom platform notices currently stored in the system." />
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input className={textInputClassName} value={notificationQuery} onChange={(event) => setNotificationQuery(event.target.value)} placeholder="Search title, message, or audience" />
            <AppSelect
              className={textInputClassName}
              value={notificationFilter}
              onChange={setNotificationFilter}
              options={asSelectOptions([
                { value: 'all', label: 'All tones' },
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'success', label: 'Success' },
              ])}
            />
            <div className={`${softPanelClassName} text-sm text-slate-500`}>{filteredNotifications.length} notifications shown</div>
          </div>
          <div className="space-y-3">
            {paginatedNotifications.items.length ? paginatedNotifications.items.map((notification) => (
              <div key={String(notification._id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{String(notification.title)}</p>
                    <p className="mt-1 text-sm text-slate-500">{String(notification.message)}</p>
                    <p className="mt-2 text-xs text-slate-400">{String(notification.audience)} | {formatDate(notification.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Badge>{String(notification.tone)}</Badge>
                    <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteNotification(String(notification._id)).then(loadNotifications) }}>Delete</button>
                  </div>
                </div>
              </div>
              )) : <EmptyState message="No custom notifications created yet." />}
            </div>
          <div className="mt-4">
            <CompactPagination page={paginatedNotifications.safePage} totalPages={paginatedNotifications.totalPages} onChange={setNotificationPage} />
          </div>
        </Card>
        <Card>
          <SectionTitle title="Reminder History" description="Recent reminder and notification emails already sent to users." />
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <input className={textInputClassName} value={historyFilter === 'all' ? '' : historyFilter} onChange={(event) => setHistoryFilter(event.target.value.trim() || 'all')} placeholder="Reminder type filter" />
            <div className={`${softPanelClassName} text-sm text-slate-500 md:col-span-2`}>{filteredHistory.length} reminder logs shown</div>
          </div>
          <div className="space-y-3">
            {paginatedHistory.items.length ? paginatedHistory.items.map((item) => (
              <div key={String(item._id)} className={softPanelClassName}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800">{String(item.subject)}</p>
                    <p className="mt-1 text-sm text-slate-500">{String(item.email)}</p>
                    <p className="mt-1 text-xs text-slate-400">{String(item.reminderType)} | {formatDate(item.sentAt)}</p>
                  </div>
                  <Badge>{String(item.reminderType)}</Badge>
                </div>
              </div>
              )) : <EmptyState message="Reminder history will appear here after email reminders are sent." />}
            </div>
          <div className="mt-4">
            <CompactPagination page={paginatedHistory.safePage} totalPages={paginatedHistory.totalPages} onChange={setHistoryPage} />
          </div>
        </Card>
      </CardGrid>
    </div>
  )
}

export const AdminContactMessagesPage = () => {
  const [contacts, setContacts] = useState<AdminRecord[]>([])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const loadContacts = async () => setContacts(await adminApi.listContacts())
  useEffect(() => { void loadContacts() }, [])

  const filtered = useMemo(() => contacts.filter((contact) => {
    const matchesStatus = filter === 'all' || String(contact.status) === filter
    const matchesQuery = !query.trim() || `${contact.fullName} ${contact.email} ${contact.subject} ${contact.message}`.toLowerCase().includes(query.toLowerCase())
    return matchesStatus && matchesQuery
  }), [contacts, filter, query])
  const paginated = useMemo(() => paginateAdaptiveItems(filtered, page, 8, { minPageSize: 5, maxVisibleWeight: 1500 }), [filtered, page])

  useEffect(() => { setPage(1) }, [filter, query])

  return (
    <div className="space-y-6">
      <PageHeader title="Contact Messages" subtitle="Review support and feedback messages submitted from the public Contact Us flow." />
      <Card className="grid gap-3 md:grid-cols-4">
        <input className={textInputClassName} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sender, email, subject, or message" />
        <AppSelect
          className={textInputClassName}
          value={filter}
          onChange={setFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All messages' },
            { value: 'unread', label: 'Unread' },
            { value: 'read', label: 'Read' },
          ])}
        />
        <div className={`${softPanelClassName} text-sm text-slate-500`}>{filtered.length} messages shown</div>
      </Card>
      <DataTable
        columns={['Sender', 'Subject', 'Message', 'Date', 'Status', 'Actions']}
        rows={paginated.items.map((contact) => ({
          Sender: <div><p className="font-semibold">{String(contact.fullName)}</p><p className="text-xs text-slate-500">{String(contact.email)}</p></div>,
          Subject: String(contact.subject),
          Message: <p className="max-w-md text-xs text-slate-500">{String(contact.message)}</p>,
          Date: formatDate(contact.createdAt),
          Status: <Badge>{String(contact.status ?? 'unread')}</Badge>,
          Actions: (
            <div className="flex flex-wrap gap-2">
              <button className={subtleButtonClassName} onClick={() => { void adminApi.updateContact(String(contact._id), { status: contact.status === 'read' ? 'unread' : 'read' }).then(loadContacts) }}>
                Mark {contact.status === 'read' ? 'Unread' : 'Read'}
              </button>
              <button className={dangerButtonClassName} onClick={() => { void adminApi.deleteContact(String(contact._id)).then(loadContacts) }}>Delete</button>
            </div>
          ),
        }))}
      />
      <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
    </div>
  )
}

export const AdminSettingsPage = () => {
  const [settings, setSettings] = useState<AdminRecord>({
    emailSettings: { notificationsEmail: '', smtpConfigured: false, senderName: '', senderEmail: '' },
    notificationPreferences: { unreadContactAlerts: true, reportFailureAlerts: true, weeklyAdminSummary: true, recruiterApprovalAlerts: true, flaggedUploadAlerts: true },
    branding: { applicationName: 'CareerCompass', supportEmail: '' },
    systemPreferences: { defaultTheme: 'light', reminderSweepEnabled: true, fieldConfirmationRequired: true, reminderFrequency: 'weekly' },
    reminderTemplates: { profileCompletion: '', recruiterApproval: '', reportReady: '' },
    featureToggles: { codingRoundEnabled: true, mockInterviewEnabled: true, contactPageEnabled: true },
  })

  useEffect(() => {
    void adminApi.getSettings().then((data) => setSettings(data))
  }, [])

  const updateNested = (section: string, key: string, value: unknown) => {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...(current[section] ?? {}),
        [key]: value,
      },
    }))
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Settings" subtitle="Manage platform-level preferences, branding, alerts, and operational defaults." action={<button className={primaryButtonClassName} onClick={() => { void adminApi.updateSettings(settings) }}>Save Settings</button>} />
      <CardGrid>
        <Card className="space-y-4">
          <SectionTitle title="Mail and Reminder Settings" description="Control sender identity, alerts, and reminder behavior used across the platform." />
          <input className={textInputClassName} value={String(settings.emailSettings?.notificationsEmail ?? '')} onChange={(event) => updateNested('emailSettings', 'notificationsEmail', event.target.value)} placeholder="Notification email" />
          <input className={textInputClassName} value={String(settings.emailSettings?.senderName ?? '')} onChange={(event) => updateNested('emailSettings', 'senderName', event.target.value)} placeholder="Mail sender name" />
          <input className={textInputClassName} value={String(settings.emailSettings?.senderEmail ?? '')} onChange={(event) => updateNested('emailSettings', 'senderEmail', event.target.value)} placeholder="Mail sender email" />
          <div className="space-y-3">
            <AdminSwitchRow label="SMTP configured" helper="Marks whether outbound email delivery is ready." checked={Boolean(settings.emailSettings?.smtpConfigured)} onChange={(checked) => updateNested('emailSettings', 'smtpConfigured', checked)} />
            <AdminSwitchRow label="Unread contact alerts" helper="Notify admins when new contact inbox items arrive." checked={Boolean(settings.notificationPreferences?.unreadContactAlerts)} onChange={(checked) => updateNested('notificationPreferences', 'unreadContactAlerts', checked)} />
            <AdminSwitchRow label="Report failure alerts" helper="Flag report-generation failures for admin review." checked={Boolean(settings.notificationPreferences?.reportFailureAlerts)} onChange={(checked) => updateNested('notificationPreferences', 'reportFailureAlerts', checked)} />
            <AdminSwitchRow label="Weekly admin summary" helper="Enable the weekly summary digest for admin operations." checked={Boolean(settings.notificationPreferences?.weeklyAdminSummary)} onChange={(checked) => updateNested('notificationPreferences', 'weeklyAdminSummary', checked)} />
            <AdminSwitchRow label="Recruiter approval alerts" helper="Alert admins when recruiter approvals need attention." checked={Boolean(settings.notificationPreferences?.recruiterApprovalAlerts)} onChange={(checked) => updateNested('notificationPreferences', 'recruiterApprovalAlerts', checked)} />
            <AdminSwitchRow label="Flagged upload alerts" helper="Highlight resumes and documents that may need manual review." checked={Boolean(settings.notificationPreferences?.flaggedUploadAlerts)} onChange={(checked) => updateNested('notificationPreferences', 'flaggedUploadAlerts', checked)} />
          </div>
        </Card>
        <Card className="space-y-4">
          <SectionTitle title="Branding and System Preferences" description="General application identity and operating defaults." />
          <input className={textInputClassName} value={String(settings.branding?.applicationName ?? '')} onChange={(event) => updateNested('branding', 'applicationName', event.target.value)} placeholder="Application name" />
          <input className={textInputClassName} value={String(settings.branding?.supportEmail ?? '')} onChange={(event) => updateNested('branding', 'supportEmail', event.target.value)} placeholder="Support email" />
          <AppSelect
            className={textInputClassName}
            value={String(settings.systemPreferences?.defaultTheme ?? 'light')}
            onChange={(value) => updateNested('systemPreferences', 'defaultTheme', value)}
            options={asSelectOptions([
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ])}
          />
          <AppSelect
            className={textInputClassName}
            value={String(settings.systemPreferences?.reminderFrequency ?? 'weekly')}
            onChange={(value) => updateNested('systemPreferences', 'reminderFrequency', value)}
            options={asSelectOptions([
              { value: 'daily', label: 'Daily' },
              { value: 'every_3_days', label: 'Every 3 days' },
              { value: 'weekly', label: 'Weekly' },
            ])}
          />
          <div className="space-y-3">
            <AdminSwitchRow label="Reminder sweep enabled" helper="Allow automated reminder processing to keep running." checked={Boolean(settings.systemPreferences?.reminderSweepEnabled)} onChange={(checked) => updateNested('systemPreferences', 'reminderSweepEnabled', checked)} />
            <AdminSwitchRow label="Require field confirmation" helper="Keep field recommendations gated behind explicit confirmation." checked={Boolean(settings.systemPreferences?.fieldConfirmationRequired)} onChange={(checked) => updateNested('systemPreferences', 'fieldConfirmationRequired', checked)} />
          </div>
        </Card>
      </CardGrid>
      <Card className="space-y-4">
        <SectionTitle title="Reminder Templates" description="Edit the default copy used for common reminder categories and approval-related communication." />
        <textarea className={textareaClassName} value={String(settings.reminderTemplates?.profileCompletion ?? '')} onChange={(event) => updateNested('reminderTemplates', 'profileCompletion', event.target.value)} placeholder="Profile completion reminder template" />
        <textarea className={textareaClassName} value={String(settings.reminderTemplates?.recruiterApproval ?? '')} onChange={(event) => updateNested('reminderTemplates', 'recruiterApproval', event.target.value)} placeholder="Recruiter approval template" />
        <textarea className={textareaClassName} value={String(settings.reminderTemplates?.reportReady ?? '')} onChange={(event) => updateNested('reminderTemplates', 'reportReady', event.target.value)} placeholder="Report ready template" />
      </Card>
      <Card>
        <SectionTitle title="Feature Toggles" description="Control platform-wide admin-visible feature availability." />
        <div className="grid gap-3 md:grid-cols-3">
          <AdminSwitchRow label="Coding round enabled" helper="Turn coding test features on or off." checked={Boolean(settings.featureToggles?.codingRoundEnabled)} onChange={(checked) => updateNested('featureToggles', 'codingRoundEnabled', checked)} />
          <AdminSwitchRow label="Mock interview enabled" helper="Allow guided mock interview practice site-wide." checked={Boolean(settings.featureToggles?.mockInterviewEnabled)} onChange={(checked) => updateNested('featureToggles', 'mockInterviewEnabled', checked)} />
          <AdminSwitchRow label="Contact page enabled" helper="Show or hide the public contact workflow." checked={Boolean(settings.featureToggles?.contactPageEnabled)} onChange={(checked) => updateNested('featureToggles', 'contactPageEnabled', checked)} />
        </div>
      </Card>
    </div>
  )
}
