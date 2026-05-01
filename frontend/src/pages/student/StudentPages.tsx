import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { ExternalLink, Minus, Plus, RotateCcw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AppModal, AppSelect, Card, CircularScore, DataTable, FileDrop, PageHeader, ProgressBar, StatCards, TrendChart } from '../../components/ui'
import { useResumeSession } from '../../context/ResumeSessionContext'
import { authApi, studentApi } from '../../services/api'
import type { ChartPoint, DomainKey, StudentProfile } from '../../types'
import { toTitleCase } from '../../utils/helpers'

// Report payloads are AI-generated JSON, so the UI treats them as flexible records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiRecord = Record<string, any>
type SpeechRecognitionResultEventLike = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type SpeechRecognitionLike = {
  lang: string
  continuous?: boolean
  interimResults?: boolean
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null
  onend: (() => void) | null
  onerror?: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike
  webkitSpeechRecognition?: new () => SpeechRecognitionLike
}
type MonacoEditorLike = {
  getDomNode: () => HTMLElement | null
  getScrollTop: () => number
  getScrollHeight: () => number
  getLayoutInfo: () => { height: number }
}

const getId = (item: ApiRecord) => String(item._id ?? item.id ?? '')
const contentOf = (report?: ApiRecord | null): ApiRecord => (report?.content ?? report?.payload ?? report ?? {}) as ApiRecord
const latest = <T,>(items: T[]): T | undefined => items[0]
const asRows = (items: string[] = []) => items.map((item) => <li key={item}>{item}</li>)
const monthKey = (value?: string) => (value ? new Date(value).toLocaleDateString(undefined, { month: 'short' }) : 'Unknown')

const InlineSwitch = ({
  label,
  checked,
  onChange,
  helper,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  helper?: string
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
      <span className="student-settings-switch-track h-7 w-12 rounded-full border transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-400/20 peer-checked:bg-[var(--accent-primary)]" />
      <span className="student-settings-switch-thumb pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full transition peer-checked:translate-x-5" />
    </span>
  </label>
)
const textList = (items: string[] = []) => items.filter(Boolean).join(', ') || '-'
const commaSeparated = (items: string[] = []) => items.join(', ')
const parseCommaSeparated = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)
const unique = (items: string[]): string[] => [...new Set(items)]
const uniqueBy = <T,>(items: T[], getKey: (item: T) => string): T[] => {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
const asSelectOptions = (items: Array<string | { value: string; label: string }>) =>
  items.map((item) => (typeof item === 'string' ? { value: item, label: item } : item))
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => String(item ?? '').trim())
        .filter(Boolean)
    : []
const atsImprovementTips: Record<string, string[]> = {
  'Keyword Match': [
    'Add missing role keywords from the JD or target role in your summary, skills, projects, and experience.',
    'Include tools and technologies exactly as recruiters write them, for example React, Node.js, SQL, Docker, or AWS.',
  ],
  'Skills Relevance': [
    'Move important skills from a plain list into project and experience bullets.',
    'Show each major skill with proof: what you built, where you used it, and what result it created.',
  ],
  'Experience Quality': [
    'Start bullets with action verbs like Built, Developed, Led, Improved, Optimized, or Implemented.',
    'Add measurable outcomes such as users served, percentage improvement, time saved, or performance gain.',
  ],
  'Resume Structure & Formatting': [
    'Use clear ATS headings: Education, Skills, Projects, Experience, Certifications.',
    'Avoid tables, image-only sections, complex columns, and decorative formatting that parsers may miss.',
  ],
  'Grammar & Readability': [
    'Keep bullets short, direct, and consistent.',
    'Remove unclear phrases, repeated punctuation, all-caps text, and grammar mistakes.',
  ],
  'Job Role Alignment': [
    'Tune the resume headline, summary, and top projects for the target role.',
    'Show role proof using the tools, projects, coursework, internship tasks, or achievements that actually match your target field.',
  ],
  'Projects Quality': [
    'Add 2-3 real projects with technologies, problem solved, your role, and measurable outcome.',
    'Include GitHub, portfolio, live demo, or deployment links where available.',
  ],
}
const collegeSuggestions = [
  // 🔥 IITs
  "IIT Delhi",
  "IIT Bombay",
  "IIT Madras",
  "IIT Kanpur",
  "IIT Kharagpur",
  "IIT Roorkee",
  "IIT Guwahati",
  "IIT Hyderabad",
  "IIT Indore",
  "IIT BHU",

  // 🔥 NITs
  "NIT Trichy",
  "NIT Surathkal",
  "NIT Warangal",
  "NIT Calicut",
  "NIT Rourkela",
  "NIT Durgapur",
  "NIT Silchar",

  // 🔥 IIITs
  "IIIT Hyderabad",
  "IIIT Bangalore",
  "IIIT Delhi",
  "IIIT Allahabad",

  // 🔥 Top Private Universities
  "BITS Pilani",
  "VIT Vellore",
  "SRM Institute of Science and Technology",
  "Manipal Institute of Technology",
  "Amity University",
  "Lovely Professional University",
  "Shiv Nadar University",

  // 🔥 Central Universities
  "University of Delhi",
  "Jawaharlal Nehru University",
  "Jamia Millia Islamia",
  "University of Hyderabad",
  "Aligarh Muslim University",
  "Banaras Hindu University",

  // 🔥 State Universities (India)
  "Jadavpur University",
  "Anna University",
  "Osmania University",
  "Calcutta University",
  "Mumbai University",
  "Pune University",

  // 🔥 Top Colleges (India)
  "Delhi Technological University",
  "NSUT Delhi",
  "College of Engineering Pune",
  "PSG College of Technology",
  "Pune Institute of Computer Technology",
  "RV College of Engineering",
  "BMS College of Engineering",
  "MS Ramaiah Institute of Technology",
  "Christ University",
  "Bangalore Institute of Technology",

  // 🔥 WEST BENGAL UNIVERSITIES
  "University of Calcutta",
  "Visva-Bharati University",
  "Aliah University",
  "University of Burdwan",
  "University of Kalyani",
  "University of North Bengal",
  "Sidho-Kanho-Birsha University",
  "Raiganj University",
  "Cooch Behar Panchanan Barma University",
  "Diamond Harbour Women’s University",
  "Bankura University",

  // 🔥 Institutes of National Importance (WB)
  "Indian Statistical Institute Kolkata",
  "IISER Kolkata",

  // 🔥 WB State & Private Universities
  "Maulana Abul Kalam Azad University of Technology",
  "West Bengal State University",
  "West Bengal University of Health Sciences",
  "West Bengal University of Animal and Fishery Sciences",
  "Adamas University",
  "Techno India University",
  "Amity University Kolkata",
  "Brainware University",
  "UEM Kolkata",
  "Sister Nivedita University",
  "Seacom Skills University",
  "The Neotia University",
  "JIS University",

  // 🔥 WB Engineering Colleges
  "Heritage Institute of Technology",
  "Institute of Engineering and Management",
  "Techno Main Salt Lake",
  "Narula Institute of Technology",
  "Meghnad Saha Institute of Technology",
  "Future Institute of Engineering and Management",
  "Netaji Subhash Engineering College",
  "Academy of Technology",
  "Government College of Engineering and Ceramic Technology",
  "Jalpaiguri Government Engineering College",
  "Kalyani Government Engineering College",

  // 🔥 WB General Colleges
  "Presidency University Kolkata",
  "Scottish Church College",
  "St. Xavier’s College Kolkata",
  "Bethune College",
  "Lady Brabourne College",
  "Asutosh College",
  "Surendranath College",
  "City College Kolkata",
  "Ramakrishna Mission Vidyamandira",
  "Maulana Azad College",

  // 🔥 WB Medical Colleges
  "Medical College Kolkata",
  "RG Kar Medical College",
  "Nil Ratan Sircar Medical College",
  "Calcutta National Medical College",
  "IPGMER Kolkata",
  "North Bengal Medical College",

  // 🔥 Other Important WB Institutions
  "Indian Institute of Management Calcutta",
  "National Institute of Fashion Technology Kolkata",
  "Rabindra Bharati University",
]
const degreeSuggestions = [
  'BTech',
  'BE',
  'BSc Computer Science',
  'BSc Information Technology',
  'BCA',
  'BCom',
  'BA',
  'MCA',
  'MTech',
  'MSc Computer Science',
  'MBA',
  'MSc Information Technology',
  'Diploma in Engineering',
  'PhD',
]
const branchSuggestions = [
  'Computer Science',
  'Computer Science and Engineering',
  'Information Technology',
  'Software Engineering',
  'Artificial Intelligence',
  'Artificial Intelligence and Data Science',
  'Data Science',
  'Electronics and Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Cyber Security',
  'Cloud Computing',
  'Business Administration',
  'Finance',
  'Marketing',
  'Human Resources',
]
const domainOptions: Array<{ key: DomainKey; label: string }> = [
  { key: 'it_software', label: 'IT / Software' },
  { key: 'data_analytics', label: 'Data / Analytics' },
  { key: 'commerce_finance', label: 'Commerce / Finance' },
  { key: 'mechanical', label: 'Mechanical' },
  { key: 'civil', label: 'Civil' },
  { key: 'electrical', label: 'Electrical' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'hr', label: 'HR' },
  { key: 'design', label: 'Design' },
  { key: 'healthcare', label: 'Healthcare' },
  { key: 'general_fresher', label: 'General Fresher' },
]
const codingRelevantDomainKeys: DomainKey[] = ['it_software', 'data_analytics']
const codingRoleKeywords = ['developer', 'engineer', 'software', 'frontend', 'backend', 'full stack', 'fullstack', 'qa automation', 'automation', 'sdet', 'python', 'sql', 'analyst']
const codingLanguageOptions = [
  { key: 'python', label: 'Python' },
  { key: 'javascript', label: 'JavaScript' },
  { key: 'java', label: 'Java' },
  { key: 'cpp', label: 'C++' },
]
const codingStarterTemplates: Record<string, string> = {
  python: `def solve():\n    # Write your logic here\n    pass\n\n\nif __name__ == "__main__":\n    solve()\n`,
  javascript: `function solve(input) {\n  // Write your logic here\n}\n\nconst fs = require("fs")\nconst input = fs.readFileSync(0, "utf8").trim()\nconst result = solve(input)\nif (result !== undefined) {\n  process.stdout.write(String(result))\n}\n`,
  java: `import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        // Write your logic here\n    }\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n\n    // Write your logic here\n    return 0;\n}\n`,
}
const emptyStudentProfile: StudentProfile = {
  name: '',
  email: '',
  userId: '',
  phone: '',
  profilePhoto: '',
  currentLocation: '',
  professionalHeadline: '',
  summary: '',
  collegeName: '',
  degree: '',
  branch: '',
  graduationYear: null,
  cgpaOrPercentage: '',
  education: '',
  skills: [],
  technicalSkills: [],
  softSkills: [],
  certifications: [],
  internshipExperience: '',
  workExperience: '',
  experience: '',
  preferredJobRole: '',
  preferredIndustry: '',
  languagesKnown: [],
  linkedInProfile: '',
  githubProfile: '',
  portfolioLink: '',
  achievements: [],
  areasOfInterest: [],
  strengths: [],
  location: '',
  projects: [],
  completion: 0,
  missingFields: [],
  detectedDomains: [],
  recommendedDomain: undefined,
  confirmedDomain: '',
  confirmedDomainLabel: '',
  activeDomain: 'general_fresher',
  activeDomainLabel: 'General Fresher',
  needsDomainConfirmation: true,
  notificationPreferences: {
    emailRemindersEnabled: true,
    profileCompletionReminder: true,
    resumeUploadReminder: true,
    skillImprovementReminder: true,
    interviewPreparationReminder: true,
    mockInterviewReminder: true,
    reportReadyNotification: true,
    jobRecommendationReminder: true,
    inactiveUserReminder: true,
    frequency: 'every_3_days',
  },
}

const normalizeStudentProfile = (profile?: Partial<StudentProfile> | null): StudentProfile => ({
  ...emptyStudentProfile,
  ...profile,
  name: String(profile?.name ?? ''),
  email: String(profile?.email ?? ''),
  userId: String(profile?.userId ?? ''),
  phone: String(profile?.phone ?? ''),
  profilePhoto: String(profile?.profilePhoto ?? ''),
  currentLocation: String(profile?.currentLocation ?? profile?.location ?? ''),
  professionalHeadline: String(profile?.professionalHeadline ?? ''),
  summary: String(profile?.summary ?? ''),
  collegeName: String(profile?.collegeName ?? ''),
  degree: String(profile?.degree ?? ''),
  branch: String(profile?.branch ?? ''),
  graduationYear: typeof profile?.graduationYear === 'number' ? profile.graduationYear : null,
  cgpaOrPercentage: String(profile?.cgpaOrPercentage ?? ''),
  education: String(profile?.education ?? ''),
  skills: Array.isArray(profile?.skills) ? profile.skills : [],
  technicalSkills: Array.isArray(profile?.technicalSkills) ? profile.technicalSkills : [],
  softSkills: Array.isArray(profile?.softSkills) ? profile.softSkills : [],
  certifications: Array.isArray(profile?.certifications) ? profile.certifications : [],
  internshipExperience: String(profile?.internshipExperience ?? ''),
  workExperience: String(profile?.workExperience ?? ''),
  experience: String(profile?.experience ?? ''),
  preferredJobRole: String(profile?.preferredJobRole ?? ''),
  preferredIndustry: String(profile?.preferredIndustry ?? ''),
  languagesKnown: Array.isArray(profile?.languagesKnown) ? profile.languagesKnown : [],
  linkedInProfile: String(profile?.linkedInProfile ?? ''),
  githubProfile: String(profile?.githubProfile ?? ''),
  portfolioLink: String(profile?.portfolioLink ?? ''),
  achievements: Array.isArray(profile?.achievements) ? profile.achievements : [],
  areasOfInterest: Array.isArray(profile?.areasOfInterest) ? profile.areasOfInterest : [],
  strengths: Array.isArray(profile?.strengths) ? profile.strengths : [],
  location: String(profile?.location ?? profile?.currentLocation ?? ''),
  projects: Array.isArray(profile?.projects) ? profile.projects : [],
  completion: Number(profile?.completion ?? 0),
  missingFields: Array.isArray(profile?.missingFields) ? profile.missingFields : [],
  detectedDomains: Array.isArray(profile?.detectedDomains) ? profile.detectedDomains : [],
  recommendedDomain: (profile?.recommendedDomain as StudentProfile['recommendedDomain']) ?? undefined,
  confirmedDomain: (String(profile?.confirmedDomain ?? '') as StudentProfile['confirmedDomain']),
  confirmedDomainLabel: String(profile?.confirmedDomainLabel ?? ''),
  activeDomain: (String(profile?.activeDomain ?? 'general_fresher') as StudentProfile['activeDomain']),
  activeDomainLabel: String(profile?.activeDomainLabel ?? 'General Fresher'),
  needsDomainConfirmation: Boolean(profile?.needsDomainConfirmation ?? !profile?.confirmedDomain),
  notificationPreferences: {
    emailRemindersEnabled: Boolean(profile?.notificationPreferences?.emailRemindersEnabled ?? emptyStudentProfile.notificationPreferences?.emailRemindersEnabled),
    profileCompletionReminder: Boolean(profile?.notificationPreferences?.profileCompletionReminder ?? emptyStudentProfile.notificationPreferences?.profileCompletionReminder),
    resumeUploadReminder: Boolean(profile?.notificationPreferences?.resumeUploadReminder ?? emptyStudentProfile.notificationPreferences?.resumeUploadReminder),
    skillImprovementReminder: Boolean(profile?.notificationPreferences?.skillImprovementReminder ?? emptyStudentProfile.notificationPreferences?.skillImprovementReminder),
    interviewPreparationReminder: Boolean(profile?.notificationPreferences?.interviewPreparationReminder ?? emptyStudentProfile.notificationPreferences?.interviewPreparationReminder),
    mockInterviewReminder: Boolean(profile?.notificationPreferences?.mockInterviewReminder ?? emptyStudentProfile.notificationPreferences?.mockInterviewReminder),
    reportReadyNotification: Boolean(profile?.notificationPreferences?.reportReadyNotification ?? emptyStudentProfile.notificationPreferences?.reportReadyNotification),
    jobRecommendationReminder: Boolean(profile?.notificationPreferences?.jobRecommendationReminder ?? emptyStudentProfile.notificationPreferences?.jobRecommendationReminder),
    inactiveUserReminder: Boolean(profile?.notificationPreferences?.inactiveUserReminder ?? emptyStudentProfile.notificationPreferences?.inactiveUserReminder),
    frequency: (profile?.notificationPreferences?.frequency ?? emptyStudentProfile.notificationPreferences?.frequency ?? 'every_3_days') as 'daily' | 'every_3_days' | 'weekly',
  },
})

const roleNeedsCoding = (domain: DomainKey, role: string): boolean => {
  const normalizedRole = role.trim().toLowerCase()
  if (codingRelevantDomainKeys.includes(domain)) {
    if (domain === 'data_analytics') {
      return /sql|python|analyst|analytics|bi/.test(normalizedRole)
    }
    return true
  }
  return codingRoleKeywords.some((keyword) => normalizedRole.includes(keyword))
}

const ConsoleBlock = ({
  title,
  content,
  tone = 'default',
}: {
  title: string
  content: string
  tone?: 'default' | 'error'
}) => (
  <div className={`rounded-xl border p-4 ${tone === 'error' ? 'border-rose-400/30 bg-rose-500/5' : 'border-slate-800 bg-[#08101f]'}`}>
    <p className={`text-xs uppercase tracking-[0.2em] ${tone === 'error' ? 'text-rose-300' : 'text-cyan-300'}`}>{title}</p>
    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-[#020817] p-3 font-mono text-sm leading-6 text-slate-200">{content || 'No output yet.'}</pre>
  </div>
)

const toSet = (items: string[]) => new Set(items.map((item) => item.trim().toLowerCase()).filter(Boolean))

const SuggestionInput = ({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  suggestions: string[]
}) => {
  const [open, setOpen] = useState(false)
  const filtered = suggestions.filter((suggestion) => suggestion.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6)

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
        placeholder={placeholder}
      />
      {open && filtered.length ? (
        <div className="suggestion-menu absolute z-20 mt-2 w-full rounded-xl border border-indigo-400/35 bg-[#111a3a] p-1 shadow-[0_16px_30px_-18px_rgba(6,182,212,0.45)]">
          {filtered.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault()
                onChange(suggestion)
                setOpen(false)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-indigo-100 hover:bg-indigo-500/15"
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const stripHtml = (html: string): string =>
  html
    .replace(/<li>/gi, '\n- ')
    .replace(/<h[1-6][^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const makePdf = (title: string, text: string): string => {
  const escapePdf = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const lines = [title, '', ...text.split(/\n/)].flatMap((line) => line.match(/.{1,88}(\s|$)|\S+/g) ?? [''])
  const stream = `BT /F1 11 Tf 40 790 Td 14 TL ${lines.map((line) => `(${escapePdf(line.trim())}) Tj T*`).join(' ')} ET`
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object) => {
    offsets.push(pdf.length)
    pdf += `${object}\n`
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\n`
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return pdf
}

const downloadPdfReport = (title: string, html: string) => {
  const pdf = makePdf(title, stripHtml(html))
  const url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

const useResumes = () => {
  const { resume } = useResumeSession()
  return { resumes: resume ? [resume] : [], loading: false, refresh: async () => undefined }
}

const useReports = () => {
  const { reports, reportsLoaded, setReports } = useResumeSession()
  const refresh = async () => setReports(await studentApi.listReports())
  useEffect(() => {
    if (!reportsLoaded) queueMicrotask(() => void refresh())
  }, [reportsLoaded])
  return { reports, refresh }
}

export const StudentDashboardPage = () => {
  const navigate = useNavigate()
  const { analysis: currentAnalysis } = useResumeSession()
  const { reports } = useReports()
  const { resumes } = useResumes()
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    void studentApi
      .getProfile()
      .then((savedProfile) => setProfile(normalizeStudentProfile(savedProfile)))
      .catch(() => undefined)
      .finally(() => setProfileLoaded(true))
  }, [])

  const sortedReports = [...reports].sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime())
  const analysis = currentAnalysis ?? sortedReports.find((report) => report.type === 'Resume Analysis')
  const match = sortedReports.find((report) => report.type === 'JD Match')
  const skill = sortedReports.find((report) => report.type === 'Skill Gap')
  const prep = sortedReports.find((report) => report.type === 'Interview Preparation')
  const mock = sortedReports.find((report) => report.type === 'Mock Interview')
  const latestReport = sortedReports[0]
  const analysisContent = contentOf(analysis)
  const matchContent = contentOf(match)
  const skillContent = contentOf(skill)
  const prepContent = contentOf(prep)
  const mockContent = contentOf(mock)
  const score = Number(analysisContent.score ?? analysisContent.atsScore ?? 0)
  const gapList = ((skillContent.gaps ?? skillContent.skillGapAnalysis?.gaps ?? []) as ApiRecord[])
  const gapCount = Number(gapList.length ?? 0)
  const mockScore = Number(mockContent.overallScore ?? mockContent.score ?? 0)
  const prepQuestions = toStringArray(prepContent.questions).length || Number(prepContent.totalQuestions ?? prepContent.questionCount ?? 0)
  const practicedCount = Number(prepContent.practicedCount ?? prepContent.completedQuestions ?? prepContent.answeredQuestions ?? 0)
  const interviewReadiness = Number(prepContent.readiness?.score ?? prepContent.readinessScore ?? 0)
  const mockAttempts = sortedReports.filter((report) => report.type === 'Mock Interview').length
  const analytics = reports.reduce<Record<string, ChartPoint>>((acc, report) => {
    const key = monthKey(String(report.createdAt ?? ''))
    if (!acc[key]) acc[key] = { name: key, value: 0, secondary: 0 }
    acc[key].value += 1
    if (report.type === 'Resume Analysis' || report.type === 'JD Match') acc[key].secondary = (acc[key].secondary ?? 0) + 1
    return acc
  }, {})
  const analyticsSeries = Object.values(analytics)
  const profileCompletion = profile.completion || Math.round(
    (
      [
        profile.phone.trim(),
        profile.currentLocation.trim(),
        profile.professionalHeadline.trim(),
        profile.summary.trim(),
        profile.collegeName.trim(),
        profile.degree.trim(),
        profile.branch.trim(),
        profile.graduationYear,
        profile.cgpaOrPercentage.trim(),
        profile.skills.length,
        profile.technicalSkills.length,
        profile.softSkills.length,
        profile.projects.length,
        profile.preferredJobRole.trim(),
        profile.strengths.length,
      ].filter(Boolean).length / 15
    ) * 100,
  )
  const resumeUploaded = resumes.length > 0
  const hasAnalysis = Boolean(analysis)
  const activeFieldLabel = profile.confirmedDomainLabel || profile.activeDomainLabel || 'General Fresher'
  const fieldNeedsConfirmation = profile.needsDomainConfirmation
  const roleOptions: Record<DomainKey, string[]> = {
    it_software: ['Frontend Developer', 'Backend Developer', 'QA Engineer'],
    data_analytics: ['Data Analyst', 'Business Analyst', 'BI Analyst'],
    commerce_finance: ['Financial Analyst', 'Accounts Executive', 'Audit Associate'],
    mechanical: ['Graduate Engineer Trainee', 'Design Engineer', 'Production Engineer'],
    civil: ['Site Engineer', 'Planning Engineer', 'Quantity Surveyor'],
    electrical: ['Electrical Design Engineer', 'Maintenance Engineer', 'Power Systems Trainee'],
    electronics: ['Embedded Engineer', 'VLSI Trainee', 'Electronics Test Engineer'],
    marketing: ['Marketing Executive', 'Digital Marketing Associate', 'Brand Coordinator'],
    hr: ['HR Executive', 'Talent Acquisition Associate', 'HR Operations Coordinator'],
    design: ['UI Designer', 'Graphic Designer', 'Product Design Intern'],
    healthcare: ['Healthcare Analyst', 'Clinical Coordinator', 'Medical Operations Associate'],
    general_fresher: ['Management Trainee', 'Operations Associate', 'Business Support Executive'],
  }
  const reportRoles = unique([
    ...toStringArray(matchContent.topSuggestedRoles),
    ...toStringArray(matchContent.suggestedRoles),
    ...(((matchContent.jobRecommendations ?? []) as ApiRecord[]).map((job) => String(job.jobTitle ?? '').trim()).filter(Boolean)),
  ]).slice(0, 3)
  const topSuggestedRoles = reportRoles.length ? reportRoles : (roleOptions[profile.activeDomain] ?? roleOptions.general_fresher).slice(0, 3)
  const fitSummary = String(
    matchContent.summary ??
      matchContent.reasonForRecommendation ??
      analysisContent.summary ??
      (topSuggestedRoles.length ? `You currently fit best around ${topSuggestedRoles[0]} based on your profile and latest activity.` : 'Complete your setup to see your strongest career direction.'),
  )
  const strengths = unique([
    ...toStringArray(analysisContent.strengths),
    ...toStringArray(mockContent.strengths),
    ...profile.strengths,
    ...profile.technicalSkills.slice(0, 2),
  ]).slice(0, 3)
  const weakAreas = unique([
    ...gapList.map((gap) => String(gap.skill ?? gap.name ?? '').trim()).filter(Boolean),
    ...toStringArray(prepContent.weakTopics),
    ...toStringArray(mockContent.areasToImprove),
  ]).slice(0, 3)
  const topWeakArea = weakAreas[0] ?? String(prepContent.readiness?.topWeakTopic ?? skillContent.topMissingSkill ?? 'Complete your next analysis step')
  const nextImprovement = String(
    prepContent.readiness?.message ??
      mockContent.recommendedNextSteps?.[0] ??
      gapList[0]?.recommendation ??
      gapList[0]?.skill ??
      profile.missingFields[0] ??
      'Complete profile and upload your resume to unlock personalized guidance.',
  )
  const priorityGaps = gapList
    .map((gap) => ({
      skill: String(gap.skill ?? gap.name ?? '').trim(),
      priority: String(gap.priority ?? gap.level ?? 'Priority gap'),
    }))
    .filter((gap) => gap.skill)
    .slice(0, 3)
  const topWeakTopic = String(prepContent.readiness?.topWeakTopic ?? prepContent.topWeakTopic ?? topWeakArea)
  const recommendedJobs = (((matchContent.jobRecommendations ?? matchContent.jobs ?? []) as ApiRecord[])
    .map((job) => ({
      title: String(job.jobTitle ?? job.title ?? '').trim(),
      subtitle: String(job.companyName ?? job.fieldName ?? activeFieldLabel).trim(),
      score: Number(job.fitScore ?? job.score ?? 0),
      reason: String(job.reasonForRecommendation ?? job.summary ?? '').trim(),
    }))
    .filter((job) => job.title)
    .slice(0, 3))
  const fallbackJobs = topSuggestedRoles.slice(0, 3).map((role) => ({
    title: role,
    subtitle: activeFieldLabel,
    score: 0,
    reason: `Relevant to your current field direction in ${activeFieldLabel}.`,
  }))
  const bestFitItems = recommendedJobs.length ? recommendedJobs : fallbackJobs
  const latestReportDate = latestReport?.createdAt ? new Date(String(latestReport.createdAt)).toLocaleDateString() : 'No reports yet'
  const allScores = sortedReports
    .map((report) => Number(contentOf(report).score ?? contentOf(report).overallScore ?? contentOf(report).readinessScore ?? contentOf(report).atsScore ?? report.atsScore ?? 0))
    .filter((value) => value > 0)
  const scoreTrend = allScores.length >= 2 ? allScores[0] - allScores[1] : 0
  const isFirstTime = !resumeUploaded && profileCompletion < 30 && reports.length === 0
  const nextActions = unique([
    !profileCompletion || profileCompletion < 80 ? 'Complete your profile details' : '',
    !resumeUploaded ? 'Upload your resume' : '',
    !hasAnalysis ? 'Run your first resume analysis' : '',
    !match ? 'Check your job match for a target role' : '',
    gapCount > 0 ? `Improve ${priorityGaps[0]?.skill ?? 'your top skill gap'}` : '',
    prepQuestions === 0 ? 'Generate interview preparation questions' : '',
    mockAttempts === 0 ? 'Start your first mock interview' : '',
    latestReport ? 'Review your latest report insights' : '',
  ]).filter(Boolean).slice(0, 4)

  return (
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Track your career progress, setup status, and next best actions in CareerCompass." />
      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cyan-300">Welcome to CareerCompass</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{isFirstTime ? 'Start your career dashboard' : 'Your career journey at a glance'}</h2>
            <p className="mt-2 text-sm text-slate-400">
              CareerCompass helps you improve your profile, strengthen missing skills, prepare for interviews, and become more job-ready across different career fields.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/35 px-4 py-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Current field</p>
            <p className="mt-1 font-semibold text-slate-100">{activeFieldLabel}</p>
            <p className="mt-1 text-xs text-slate-500">{fieldNeedsConfirmation ? 'Confirm your field for stronger recommendations.' : 'Using your selected field for guidance.'}</p>
          </div>
        </div>
        {isFirstTime ? (
          <div className="grid gap-3 md:grid-cols-3">
            <button onClick={() => navigate('/student/profile')} className="rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-left">
              <p className="font-semibold">1. Complete profile</p>
              <p className="mt-1 text-sm text-slate-400">Add education, strengths, skills, and preferred role.</p>
            </button>
            <button onClick={() => navigate('/student/upload-resume')} className="rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-left">
              <p className="font-semibold">2. Upload resume</p>
              <p className="mt-1 text-sm text-slate-400">Use your latest resume to unlock better analysis and suggestions.</p>
            </button>
            <button onClick={() => navigate('/student/resume-analysis')} className="rounded-xl border border-slate-700 bg-slate-950/35 px-4 py-3 text-left">
              <p className="font-semibold">3. Run first analysis</p>
              <p className="mt-1 text-sm text-slate-400">Get job-readiness insights, strengths, and improvement steps.</p>
            </button>
          </div>
        ) : null}
      </Card>

      <StatCards
        stats={[
          { label: 'Profile Completion', value: `${profileCompletion}%` },
          { label: 'Resume Status', value: resumeUploaded ? 'Uploaded' : 'Missing' },
          { label: 'Job Readiness', value: score ? `${score}%` : interviewReadiness ? `${interviewReadiness}%` : 'Building' },
          { label: 'Latest Mock Score', value: mockScore ? `${mockScore}%` : 'Pending' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Profile and resume status</h3>
              <p className="mt-1 text-sm text-slate-400">Keep your setup complete so the platform can give stronger guidance.</p>
            </div>
            <button onClick={() => navigate('/student/profile')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Open Profile</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <ProgressBar label="Profile completion" value={profileCompletion} />
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm">
                <p className="font-semibold text-slate-100">Missing setup steps</p>
                <p className="mt-2 text-slate-400">
                  {profileLoaded && profile.missingFields.length
                    ? profile.missingFields.slice(0, 5).map(toTitleCase).join(', ')
                    : profileLoaded
                      ? 'Core profile details look available.'
                      : 'Loading profile details...'}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Resume</p>
                <p className="mt-1 font-semibold text-slate-100">{resumeUploaded ? latest(resumes)?.fileName ?? 'Resume uploaded' : 'No resume uploaded yet'}</p>
                <p className="mt-2 text-slate-400">{hasAnalysis ? 'Latest resume analysis is available.' : 'Upload and analyze your resume to unlock better recommendations.'}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Latest analysis</p>
                <p className="mt-1 font-semibold text-slate-100">{score ? `${score}% resume score` : 'Not analyzed yet'}</p>
                <p className="mt-2 text-slate-400">{hasAnalysis ? String(analysisContent.summary ?? 'Your latest analysis is ready for review.') : 'Run resume analysis after upload to see strengths and weak areas.'}</p>
              </div>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col justify-between">
          <div>
            <h3 className="font-semibold">Job readiness summary</h3>
            <p className="mt-1 text-sm text-slate-400">See where you stand and what to improve next.</p>
          </div>
          <div className="mt-4">
            <CircularScore score={score || interviewReadiness || mockScore || 0} />
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-slate-400">Top strengths:</span> <span className="text-slate-200">{strengths.length ? strengths.join(', ') : 'Build your profile and run analysis to surface strengths.'}</span></p>
            <p><span className="text-slate-400">Top weak area:</span> <span className="text-amber-300">{topWeakArea}</span></p>
            <p><span className="text-slate-400">Improve next:</span> <span className="text-slate-200">{nextImprovement}</span></p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Career direction</h3>
              <p className="mt-1 text-sm text-slate-400">Your current field fit and the roles you should focus on next.</p>
            </div>
            {fieldNeedsConfirmation ? <button onClick={() => navigate('/student/profile')} className="app-primary-button rounded-lg px-3 py-2 text-sm font-semibold">Confirm field</button> : null}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Best current fit</p>
              <p className="mt-2 text-lg font-semibold text-white">{activeFieldLabel}</p>
              <p className="mt-2 text-sm text-slate-400">{fitSummary}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Top suggested roles</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-200">{asRows(topSuggestedRoles)}</ul>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold">Recommended next actions</h3>
          <p className="mt-1 text-sm text-slate-400">Focus on the most useful step, not everything at once.</p>
          <div className="mt-4 space-y-3">
            {nextActions.map((action, index) => (
              <div key={action} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm">
                <p className="font-semibold text-slate-100">Step {index + 1}</p>
                <p className="mt-1 text-slate-400">{action}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Skill gap highlights</h3>
              <p className="mt-1 text-sm text-slate-400">The most important missing skills affecting your readiness.</p>
            </div>
            <button onClick={() => navigate('/student/skill-gap')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Full report</button>
          </div>
          <div className="mt-4 grid gap-3">
            {priorityGaps.length ? priorityGaps.map((gap) => (
              <div key={gap.skill} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
                <p className="font-semibold text-slate-100">{gap.skill}</p>
                <p className="mt-1 text-sm text-slate-400">{gap.priority}</p>
              </div>
            )) : (
              <p className="text-sm text-slate-500">Run a skill gap analysis to see your top three priority gaps.</p>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Interview preparation</h3>
              <p className="mt-1 text-sm text-slate-400">Track question readiness, weak topics, and practice momentum.</p>
            </div>
            <button onClick={() => navigate('/student/interview-prep')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Open prep</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Recommended questions</p>
              <p className="mt-2 text-2xl font-semibold text-white">{prepQuestions || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Practiced</p>
              <p className="mt-2 text-2xl font-semibold text-white">{practicedCount || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Top weak topic</p>
              <p className="mt-2 text-sm font-semibold text-amber-200">{topWeakTopic}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Mock interview summary</h3>
              <p className="mt-1 text-sm text-slate-400">Review your latest practice result and what to work on next.</p>
            </div>
            <button onClick={() => navigate('/student/mock-interview')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Open mock</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Latest score</p>
              <p className="mt-2 text-2xl font-semibold text-white">{mockScore ? `${mockScore}%` : 'Pending'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Attempts</p>
              <p className="mt-2 text-2xl font-semibold text-white">{mockAttempts}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Next recommendation</p>
              <p className="mt-2 text-sm font-semibold text-slate-200">{String(mockContent.recommendedNextTopics?.[0] ?? topWeakTopic)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Reports and progress</h3>
              <p className="mt-1 text-sm text-slate-400">See whether your recent activity is improving your readiness.</p>
            </div>
            <button onClick={() => navigate('/student/reports')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">My reports</button>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Latest report date</p>
              <p className="mt-2 text-sm font-semibold text-white">{latestReportDate}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Improvement trend</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {scoreTrend > 0 ? `Up by ${scoreTrend}%` : scoreTrend < 0 ? `Down by ${Math.abs(scoreTrend)}%` : 'No clear change yet'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reports available</p>
              <p className="mt-2 text-2xl font-semibold text-white">{reports.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Best-fit roles and jobs</h3>
            <p className="mt-1 text-sm text-slate-400">A short list of roles that match your current field and readiness direction.</p>
          </div>
          <button onClick={() => navigate('/student/job-match')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Open job match</button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {bestFitItems.map((item) => (
            <div key={`${item.title}-${item.subtitle}`} className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-100">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{item.subtitle}</p>
                </div>
                {item.score ? <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-200">{item.score}% fit</span> : null}
              </div>
              <p className="mt-3 text-sm text-slate-400">{item.reason || `Relevant to your current path in ${activeFieldLabel}.`}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><TrendChart data={analyticsSeries.length ? analyticsSeries : [{ name: 'Now', value: 0, secondary: 0 }]} /></div>
        <Card>
          <h3 className="mb-3 font-semibold">Learning and improvement focus</h3>
          <ul className="space-y-2 text-sm text-slate-600">
            {asRows(nextActions.length ? nextActions : ['Complete your profile and upload a resume to begin your personalized journey.'])}
          </ul>
        </Card>
      </div>
    </div>
  )
}

export const MyProfilePage = () => {
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [draftLists, setDraftLists] = useState({
    skills: '',
    technicalSkills: '',
    softSkills: '',
    certifications: '',
    projects: '',
    languagesKnown: '',
    achievements: '',
    areasOfInterest: '',
    strengths: '',
  })
  const [status, setStatus] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const nextProfile = normalizeStudentProfile(await studentApi.getProfile())
        setProfile(nextProfile)
        setDraftLists({
          skills: commaSeparated(nextProfile.skills),
          technicalSkills: commaSeparated(nextProfile.technicalSkills),
          softSkills: commaSeparated(nextProfile.softSkills),
          certifications: commaSeparated(nextProfile.certifications),
          projects: commaSeparated(nextProfile.projects),
          languagesKnown: commaSeparated(nextProfile.languagesKnown),
          achievements: commaSeparated(nextProfile.achievements),
          areasOfInterest: commaSeparated(nextProfile.areasOfInterest),
          strengths: commaSeparated(nextProfile.strengths),
        })
      } catch {
        setStatus('Could not load profile. You can still update and save manually.')
      }
    })
  }, [])

  const setField = <K extends keyof StudentProfile>(field: K, value: StudentProfile[K]) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!profile.phone.trim()) nextErrors.phone = 'Phone number is required.'
    if (!profile.currentLocation.trim()) nextErrors.currentLocation = 'Current location is required.'
    if (!profile.professionalHeadline.trim()) nextErrors.professionalHeadline = 'Professional headline is required.'
    if (!profile.summary.trim()) nextErrors.summary = 'Career objective or summary is required.'
    if (!profile.collegeName.trim()) nextErrors.collegeName = 'College or university name is required.'
    if (!profile.degree.trim()) nextErrors.degree = 'Degree is required.'
    if (!profile.branch.trim()) nextErrors.branch = 'Branch or specialization is required.'
    if (!profile.preferredJobRole.trim()) nextErrors.preferredJobRole = 'Preferred job role is required.'
    if (!draftLists.skills.trim()) nextErrors.skills = 'Add at least one core skill.'
    if (!draftLists.technicalSkills.trim()) nextErrors.technicalSkills = 'Add at least one technical skill.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const save = async () => {
    if (!validate()) {
      setStatus('Please fix the highlighted profile fields.')
      return
    }
    try {
      const payload = {
        phone: profile.phone,
        profilePhoto: profile.profilePhoto,
        currentLocation: profile.currentLocation,
        professionalHeadline: profile.professionalHeadline,
        summary: profile.summary,
        collegeName: profile.collegeName,
        degree: profile.degree,
        branch: profile.branch,
        graduationYear: profile.graduationYear,
        cgpaOrPercentage: profile.cgpaOrPercentage,
        technicalSkills: parseCommaSeparated(draftLists.technicalSkills),
        softSkills: parseCommaSeparated(draftLists.softSkills),
        skills: parseCommaSeparated(draftLists.skills),
        certifications: parseCommaSeparated(draftLists.certifications),
        projects: parseCommaSeparated(draftLists.projects),
        internshipExperience: profile.internshipExperience,
        workExperience: profile.workExperience,
        preferredJobRole: profile.preferredJobRole,
        preferredIndustry: profile.preferredIndustry,
        confirmedDomain: profile.confirmedDomain,
        languagesKnown: parseCommaSeparated(draftLists.languagesKnown),
        linkedInProfile: profile.linkedInProfile,
        githubProfile: profile.githubProfile,
        portfolioLink: profile.portfolioLink,
        achievements: parseCommaSeparated(draftLists.achievements),
        areasOfInterest: parseCommaSeparated(draftLists.areasOfInterest),
        strengths: parseCommaSeparated(draftLists.strengths),
      }
      const savedProfile = normalizeStudentProfile(await studentApi.updateProfile(payload))
      setProfile(savedProfile)
      setDraftLists({
        skills: commaSeparated(savedProfile.skills),
        technicalSkills: commaSeparated(savedProfile.technicalSkills),
        softSkills: commaSeparated(savedProfile.softSkills),
        certifications: commaSeparated(savedProfile.certifications),
        projects: commaSeparated(savedProfile.projects),
        languagesKnown: commaSeparated(savedProfile.languagesKnown),
        achievements: commaSeparated(savedProfile.achievements),
        areasOfInterest: commaSeparated(savedProfile.areasOfInterest),
        strengths: commaSeparated(savedProfile.strengths),
      })
      setErrors({})
      setStatus('Profile saved successfully.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save profile.')
    }
  }

  const inputClassName = 'rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2'
  const errorClassName = 'text-xs text-rose-300'
  const completionPreview = Math.round(
    (
      [
        profile.phone.trim(),
        profile.currentLocation.trim(),
        profile.professionalHeadline.trim(),
        profile.summary.trim(),
        profile.collegeName.trim(),
        profile.degree.trim(),
        profile.branch.trim(),
        profile.graduationYear,
        profile.cgpaOrPercentage.trim(),
        draftLists.skills.trim(),
        draftLists.technicalSkills.trim(),
        draftLists.softSkills.trim(),
        draftLists.projects.trim(),
        profile.preferredJobRole.trim(),
        draftLists.strengths.trim(),
      ].filter(Boolean).length / 15
    ) * 100,
  )

  return (
    <div className="space-y-5">
      <PageHeader title="My Profile" subtitle="Keep your profile updated for better recommendations." />
      <Card className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <ProgressBar label="Profile Completion" value={completionPreview} />
          </div>
          <div className="rounded-xl border border-slate-800 p-3 text-sm">
            <p className="font-semibold">Missing Essentials</p>
            <p className="mt-2 text-slate-400">{profile.missingFields.length ? profile.missingFields.map(toTitleCase).join(', ') : 'Profile looks strong.'}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Career field confirmation</p>
              <p className="mt-1 text-sm text-slate-400">We detect likely fields from your profile and resume, but you stay in control of the final field used for recommendations.</p>
            </div>
            <span className="rounded-full border border-cyan-400/40 px-3 py-1 text-xs font-semibold text-cyan-200">
              Active field: {profile.activeDomainLabel}
            </span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-500">Confirmed field</label>
              <AppSelect
                value={profile.confirmedDomain}
                onChange={(value) => setField('confirmedDomain', value as StudentProfile['confirmedDomain'])}
                options={[
                  { value: '', label: 'Use detected suggestion' },
                  ...domainOptions.map((option) => ({ value: option.key, label: option.label })),
                ]}
                className={inputClassName}
              />
              <p className="text-xs text-slate-500">
                {profile.needsDomainConfirmation ? 'No field confirmed yet. The system will stay flexible until you choose one.' : `Confirmed field: ${profile.confirmedDomainLabel || profile.activeDomainLabel}.`}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-500">Detected options</label>
              <div className="space-y-2">
                {profile.detectedDomains.length ? profile.detectedDomains.slice(0, 3).map((domain) => (
                  <div key={domain.key} className="rounded-xl border border-slate-800 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-200">{domain.label}</p>
                      <span className="text-xs text-slate-500">{domain.confidence}%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{textList(domain.reasons)}</p>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">Upload a resume or save more profile details to improve field detection.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <input value={profile.name} onChange={(event) => setField('name', event.target.value)} className={inputClassName} placeholder="Full name" />
          <input value={profile.email} onChange={(event) => setField('email', event.target.value)} className={inputClassName} placeholder="Email address" />
          <div className="space-y-1">
            <input value={profile.phone} onChange={(event) => setField('phone', event.target.value)} className={inputClassName} placeholder="Phone number" />
            {errors.phone ? <p className={errorClassName}>{errors.phone}</p> : null}
          </div>
          <input value={profile.profilePhoto} onChange={(event) => setField('profilePhoto', event.target.value)} className={inputClassName} placeholder="Profile photo URL" />
          <div className="space-y-1">
            <input value={profile.currentLocation} onChange={(event) => setField('currentLocation', event.target.value)} className={inputClassName} placeholder="Current location" />
            {errors.currentLocation ? <p className={errorClassName}>{errors.currentLocation}</p> : null}
          </div>
          <div className="space-y-1">
            <input value={profile.professionalHeadline} onChange={(event) => setField('professionalHeadline', event.target.value)} className={inputClassName} placeholder="Professional headline" />
            {errors.professionalHeadline ? <p className={errorClassName}>{errors.professionalHeadline}</p> : null}
          </div>
          <div className="md:col-span-2 space-y-1">
            <textarea value={profile.summary} onChange={(event) => setField('summary', event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Career objective or summary" />
            {errors.summary ? <p className={errorClassName}>{errors.summary}</p> : null}
          </div>
          <div className="space-y-1">
            <SuggestionInput value={profile.collegeName} onChange={(value) => setField('collegeName', value)} placeholder="College or university name" suggestions={collegeSuggestions} />
            {errors.collegeName ? <p className={errorClassName}>{errors.collegeName}</p> : null}
          </div>
          <div className="space-y-1">
            <SuggestionInput value={profile.degree} onChange={(value) => setField('degree', value)} placeholder="Degree" suggestions={degreeSuggestions} />
            {errors.degree ? <p className={errorClassName}>{errors.degree}</p> : null}
          </div>
          <div className="space-y-1">
            <SuggestionInput value={profile.branch} onChange={(value) => setField('branch', value)} placeholder="Branch or specialization" suggestions={branchSuggestions} />
            {errors.branch ? <p className={errorClassName}>{errors.branch}</p> : null}
          </div>
          <input
            value={profile.graduationYear ?? ''}
            onChange={(event) => setField('graduationYear', event.target.value ? Number(event.target.value) : null)}
            className={inputClassName}
            placeholder="Graduation year"
            type="number"
          />
          <input value={profile.cgpaOrPercentage} onChange={(event) => setField('cgpaOrPercentage', event.target.value)} className={inputClassName} placeholder="CGPA or percentage" />
          <div className="space-y-1">
            <input value={draftLists.skills} onChange={(event) => setDraftLists((current) => ({ ...current, skills: event.target.value }))} className={inputClassName} placeholder="Core skills, comma-separated" />
            {errors.skills ? <p className={errorClassName}>{errors.skills}</p> : null}
          </div>
          <div className="space-y-1">
            <input value={draftLists.technicalSkills} onChange={(event) => setDraftLists((current) => ({ ...current, technicalSkills: event.target.value }))} className={inputClassName} placeholder="Technical skills, comma-separated" />
            {errors.technicalSkills ? <p className={errorClassName}>{errors.technicalSkills}</p> : null}
          </div>
          <input value={draftLists.softSkills} onChange={(event) => setDraftLists((current) => ({ ...current, softSkills: event.target.value }))} className={inputClassName} placeholder="Soft skills, comma-separated" />
          <input value={draftLists.certifications} onChange={(event) => setDraftLists((current) => ({ ...current, certifications: event.target.value }))} className={inputClassName} placeholder="Certifications, comma-separated" />
          <input value={draftLists.projects} onChange={(event) => setDraftLists((current) => ({ ...current, projects: event.target.value }))} className={inputClassName} placeholder="Projects, comma-separated" />
          <textarea value={profile.internshipExperience} onChange={(event) => setField('internshipExperience', event.target.value)} className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 md:col-span-2" placeholder="Internship experience" />
          <textarea value={profile.workExperience} onChange={(event) => setField('workExperience', event.target.value)} className="min-h-20 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 md:col-span-2" placeholder="Work experience" />
          <div className="space-y-1">
            <input value={profile.preferredJobRole} onChange={(event) => setField('preferredJobRole', event.target.value)} className={inputClassName} placeholder="Preferred job role" />
            {errors.preferredJobRole ? <p className={errorClassName}>{errors.preferredJobRole}</p> : null}
          </div>
          <input value={profile.preferredIndustry} onChange={(event) => setField('preferredIndustry', event.target.value)} className={inputClassName} placeholder="Preferred industry" />
          <input value={draftLists.languagesKnown} onChange={(event) => setDraftLists((current) => ({ ...current, languagesKnown: event.target.value }))} className={inputClassName} placeholder="Languages known, comma-separated" />
          <input value={profile.linkedInProfile} onChange={(event) => setField('linkedInProfile', event.target.value)} className={inputClassName} placeholder="LinkedIn profile URL" />
          <input value={profile.githubProfile} onChange={(event) => setField('githubProfile', event.target.value)} className={inputClassName} placeholder="GitHub profile URL" />
          <input value={profile.portfolioLink} onChange={(event) => setField('portfolioLink', event.target.value)} className={inputClassName} placeholder="Portfolio link" />
          <input value={draftLists.achievements} onChange={(event) => setDraftLists((current) => ({ ...current, achievements: event.target.value }))} className={inputClassName} placeholder="Achievements, comma-separated" />
          <input value={draftLists.areasOfInterest} onChange={(event) => setDraftLists((current) => ({ ...current, areasOfInterest: event.target.value }))} className={inputClassName} placeholder="Areas of interest, comma-separated" />
          <input value={draftLists.strengths} onChange={(event) => setDraftLists((current) => ({ ...current, strengths: event.target.value }))} className={inputClassName} placeholder="Strengths, comma-separated" />
        </div>
        <button onClick={save} className="app-primary-button rounded-lg px-4 py-2 font-semibold">Save Profile</button>
        {status ? <p className={`text-sm ${Object.keys(errors).length ? 'text-amber-300' : 'text-cyan-300'}`}>{status}</p> : null}
      </Card>
    </div>
  )
}

export const UploadResumePage = () => {
  const { resume: sessionResume, analysis: sessionAnalysis, setSession, clearSession, clearPageState } = useResumeSession()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewZoom, setPreviewZoom] = useState(100)
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    let active = true
    void studentApi.getProfile()
      .then((savedProfile) => {
        if (active) {
          setProfile(normalizeStudentProfile(savedProfile))
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!file || !(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setPreviewUrl('')
      return undefined
    }

    const nextPreviewUrl = URL.createObjectURL(file)
    setPreviewUrl(nextPreviewUrl)
    setPreviewZoom(100)

    return () => {
      URL.revokeObjectURL(nextPreviewUrl)
    }
  }, [file])

  const upload = async () => {
    if (!file) return setStatus('Select a PDF, DOCX, TXT, or RTF resume first.')
    setLoading(true)
    setUploadProgress(0)
    clearSession()
    clearPageState()
    setStatus('Uploading and validating this file as a resume...')
    try {
      const uploaded = await studentApi.uploadResume(file, setUploadProgress)
      setSession((uploaded.resume ?? null) as ApiRecord | null, (uploaded.analysis ?? null) as ApiRecord | null)
      setStatus('Resume uploaded and analyzed for this session only. Refreshing the page will clear this resume data.')
    } catch (error) {
      clearSession()
      clearPageState()
      setStatus(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  const analyze = async () => {
    if (!sessionResume?.extractedText) return setStatus('Upload a resume before analysis.')
    setLoading(true)
    try {
      const analysis = await studentApi.analyzeResume({
        resumeText: String(sessionResume.extractedText ?? ''),
        htmlContent: String(sessionResume.htmlContent ?? ''),
        structuredData: {
          personalDetails: sessionResume.extractedPersonalDetails ?? {},
          skills: sessionResume.extractedSkills ?? [],
          education: sessionResume.extractedEducation ?? [],
          projects: sessionResume.extractedProjects ?? [],
          experience: sessionResume.extractedExperience ?? [],
          certifications: sessionResume.extractedCertifications ?? [],
        },
      })
      setSession(sessionResume, analysis as ApiRecord)
      setStatus('Resume re-analyzed for the current session.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }

  const uploadAndAnalyze = async () => {
    await upload()
  }

  const activeResume = (sessionResume as ApiRecord | null) ?? null
  const analysisSource = (sessionAnalysis as ApiRecord | null) ?? null
  const isSelectedPdf = Boolean(file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')))
  const uploadedFileName = String(activeResume?.fileName ?? '')
  const selectedFileName = String(file?.name ?? '')
  const isUploadedSelectedFile = Boolean(activeResume && selectedFileName && uploadedFileName === selectedFileName)
  const previewSrc = previewUrl ? `${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${previewZoom}` : ''
  const nonPdfPreviewHtml = isUploadedSelectedFile
    ? String(
        activeResume?.htmlContent ??
          (activeResume?.extractedText
            ? `<article><pre>${escapeHtml(String(activeResume.extractedText))}</pre></article>`
            : ''),
      ).trim()
    : ''
  const extractedSkills = toStringArray(analysisSource?.extractedSkills ?? activeResume?.extractedSkills)
  const extractedEducation = toStringArray(analysisSource?.extractedEducation ?? activeResume?.extractedEducation)
  const extractedProjects = toStringArray(analysisSource?.extractedProjects ?? activeResume?.extractedProjects)
  const extractedExperience = toStringArray(analysisSource?.extractedExperience ?? activeResume?.extractedExperience)
  const extractedCertifications = toStringArray(analysisSource?.extractedCertifications ?? activeResume?.extractedCertifications)
  const resumeStrengths = toStringArray(analysisSource?.strengths)
  const resumeWeaknesses = toStringArray(analysisSource?.weaknesses)
  const missingSections = toStringArray(analysisSource?.missingSections)
  const atsIssues = toStringArray(analysisSource?.atsIssues)

  const profileSkillPool = [
    ...profile.skills,
    ...profile.technicalSkills,
    ...profile.softSkills,
  ]
  const resumeSkillSet = toSet(extractedSkills)
  const missingProfileSkills = Array.from(
    new Set(
      profileSkillPool.filter((skill) => skill.trim() && !resumeSkillSet.has(skill.trim().toLowerCase())),
    ),
  ).slice(0, 6)
  const missingCertifications = profile.certifications.filter(
    (certification) => certification.trim() && !toSet(extractedCertifications).has(certification.trim().toLowerCase()),
  ).slice(0, 4)
  const missingProjects = profile.projects.length && !extractedProjects.length ? ['Projects from your profile are not reflected in the resume yet.'] : []
  const missingExperience = (profile.workExperience.trim() || profile.internshipExperience.trim() || profile.experience.trim()) && !extractedExperience.length
    ? ['Your profile includes experience details, but the resume analysis did not detect a clear experience section.']
    : []
  const missingEducation = (profile.collegeName.trim() || profile.degree.trim() || profile.branch.trim()) && !extractedEducation.length
    ? ['Education details exist in your profile, but the resume is missing a clearly detected education section.']
    : []
  const missingRoleAlignment = profile.preferredJobRole.trim() && !extractedSkills.length
    ? [`Add more role-specific skills and project evidence for ${profile.preferredJobRole}.`]
    : []
  const profileGapItems = [
    ...missingSections.map((section) => `${section} section needs to be added or strengthened.`),
    ...missingProfileSkills.map((skill) => `Include stronger evidence for profile skill: ${skill}.`),
    ...missingCertifications.map((certification) => `Mention certification from profile: ${certification}.`),
    ...missingProjects,
    ...missingExperience,
    ...missingEducation,
    ...missingRoleAlignment,
  ].slice(0, 8)

  const resumeContains = [
    extractedSkills.length ? `Detected ${extractedSkills.length} skills, led by ${extractedSkills.slice(0, 5).join(', ')}.` : '',
    extractedEducation.length ? `Education section found with ${extractedEducation.length} item${extractedEducation.length > 1 ? 's' : ''}.` : '',
    extractedProjects.length ? `Projects section found with ${extractedProjects.length} project highlight${extractedProjects.length > 1 ? 's' : ''}.` : '',
    extractedExperience.length ? `Experience section found with ${extractedExperience.length} role or internship entr${extractedExperience.length > 1 ? 'ies' : 'y'}.` : '',
    extractedCertifications.length ? `Certifications detected: ${extractedCertifications.slice(0, 3).join(', ')}.` : '',
  ].filter(Boolean)

  const resumeInsights = [
    Number(analysisSource?.score ?? 0) ? `Current resume analysis score is ${Number(analysisSource?.score ?? 0)}/100.` : '',
    resumeStrengths.length ? `Strongest areas: ${resumeStrengths.slice(0, 3).join(', ')}.` : '',
    resumeWeaknesses.length ? `Most important improvement areas: ${resumeWeaknesses.slice(0, 3).join(', ')}.` : '',
    atsIssues.length ? `ATS concerns detected: ${atsIssues.slice(0, 2).join(' ')}` : '',
    analysisSource?.enhancement?.summaryRewrite ? String(analysisSource.enhancement.summaryRewrite) : '',
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="reveal-up">
        <PageHeader title="Upload Resume" subtitle="Upload a PDF, DOCX, TXT, or RTF resume, convert it into clean HTML, and run AI analysis automatically." />
      </div>
      <div className="reveal-up reveal-delay-1">
        <FileDrop onSelect={setFile} />
      </div>
      <p className="reveal-up reveal-delay-1 text-sm text-slate-400">{file ? `Selected file: ${file.name}` : 'No file selected yet.'}</p>
      {loading ? <ProgressBar label="Upload Progress" value={uploadProgress} /> : null}
      <div className="reveal-up reveal-delay-2 flex flex-wrap gap-2">
        <button className="app-primary-button rounded-lg px-4 py-2 font-semibold" onClick={upload} disabled={loading}>{loading ? 'Processing...' : 'Upload Resume'}</button>
        <button className="app-primary-button rounded-lg px-4 py-2 font-semibold" onClick={analyze} disabled={loading}>Re-run Analysis</button>
        <button className="app-primary-button rounded-lg px-4 py-2 font-semibold" onClick={uploadAndAnalyze} disabled={loading}>{loading ? 'Processing...' : 'Upload Latest Version'}</button>
        <button className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300" onClick={clearSession} disabled={loading}>Clear Session Resume</button>
      </div>
      {status ? <p className="text-sm text-[color:var(--accent-primary)]">{status}</p> : null}
      <Card className="reveal-up reveal-delay-2 space-y-3">
        <div>
          <h3 className="font-semibold">Original Resume Preview</h3>
          <p className="mt-1 text-sm text-slate-400">This shows the file exactly as selected by the user. Extracted HTML is used only for analysis.</p>
        </div>
        {previewUrl && isSelectedPdf ? (
          <div className="pdf-preview-shell">
            <div className="pdf-preview-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{file?.name}</p>
                <p className="text-xs">Original PDF preview</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewZoom((current) => Math.max(50, current - 10))}
                  className="pdf-preview-icon-button"
                  title="Zoom out"
                >
                  <Minus size={16} />
                </button>
                <span className="pdf-preview-zoom-pill">{previewZoom}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewZoom((current) => Math.min(160, current + 10))}
                  className="pdf-preview-icon-button"
                  title="Zoom in"
                >
                  <Plus size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(100)}
                  className="pdf-preview-icon-button"
                  title="Reset zoom"
                >
                  <RotateCcw size={16} />
                </button>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="pdf-preview-open-button"
                  title="Open PDF"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            <div className="pdf-preview-viewport">
              <iframe
                key={previewSrc}
                src={previewSrc}
                title="Selected resume PDF preview"
                className="pdf-preview-iframe"
              />
            </div>
          </div>
        ) : nonPdfPreviewHtml ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-slate-700">
              <div>
                <p className="text-sm font-semibold text-slate-900">{file?.name ?? uploadedFileName}</p>
                <p className="text-xs text-slate-500">Converted preview from extracted document content</p>
              </div>
            </div>
            <div
              className="max-h-[720px] overflow-auto bg-white px-6 py-5 text-sm leading-6 text-slate-900 [&_article]:space-y-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-3 [&_section]:mb-5 [&_ul]:space-y-2"
              dangerouslySetInnerHTML={{ __html: nonPdfPreviewHtml }}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
            Select a PDF to preview the original file here. For DOCX, TXT, and RTF, upload the file first and this panel will show the converted content preview.
          </p>
        )}
      </Card>
      <Card className="reveal-up reveal-delay-3 space-y-5">
        <div>
          <h3 className="font-semibold">Resume Summary</h3>
          <p className="mt-1 text-sm text-slate-400">A cleaner summary of the uploaded resume, profile gaps, and the main insights from analysis.</p>
        </div>
        {activeResume ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <h4 className="text-sm font-semibold text-slate-100">What The Resume Contains</h4>
              {resumeContains.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-400">{asRows(resumeContains)}</ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Upload and process a resume to see the detected sections and extracted details.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <h4 className="text-sm font-semibold text-slate-100">What Is Needed From Your Profile</h4>
              {profileGapItems.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-400">{asRows(profileGapItems)}</ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Your resume is lining up well with the saved profile details so far.</p>
              )}
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
              <h4 className="text-sm font-semibold text-slate-100">Insights From The Resume</h4>
              {resumeInsights.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-400">{asRows(resumeInsights)}</ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">AI insights will appear here after the resume is analyzed.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Upload a resume to generate a structured summary instead of a raw document preview.</p>
        )}
      </Card>
      {analysisSource ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CircularScore score={Number(analysisSource.score ?? 0)} />
          <Card>
            <h3 className="mb-2 font-semibold">Latest Analysis Summary</h3>
            <p className="text-sm text-slate-400">{analysisSource.enhancement?.summaryRewrite ?? 'The latest AI analysis is ready.'}</p>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">{asRows((analysisSource.suggestions ?? []).slice(0, 5))}</ul>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

export const JobMatchPage = () => {
  const { resumes } = useResumes()
  const { pageState, setPageState } = useResumeSession()
  const activeResumeId = getId(latest(resumes) ?? {})
  const pageKey = `job-match:${activeResumeId || 'no-resume'}`
  const cachedPage = pageState[pageKey] ?? {}
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [targetRole, setTargetRole] = useState(String(cachedPage.targetRole ?? ''))
  const [preferredLocation, setPreferredLocation] = useState(String(cachedPage.preferredLocation ?? ''))
  const [result, setResult] = useState<ApiRecord | null>((cachedPage.result as ApiRecord | null | undefined) ?? null)
  const [jobDescriptionId, setJobDescriptionId] = useState(String(cachedPage.jobDescriptionId ?? ''))
  const [selectedDomain, setSelectedDomain] = useState(String(cachedPage.selectedDomain ?? ''))
  const [loading, setLoading] = useState(false)
  const [domainSaving, setDomainSaving] = useState(false)

  useEffect(() => {
    void studentApi.getProfile()
      .then((savedProfile) => {
        const normalized = normalizeStudentProfile(savedProfile)
        setProfile(normalized)
        setSelectedDomain(String(cachedPage.selectedDomain ?? normalized.confirmedDomain ?? ''))
      })
      .catch(() => undefined)
  }, [pageKey])

  useEffect(() => {
    const cached = pageState[pageKey]
    if (cached) {
      setTargetRole(String(cached.targetRole ?? ''))
      setPreferredLocation(String(cached.preferredLocation ?? ''))
      setResult((cached.result as ApiRecord | null | undefined) ?? null)
      setJobDescriptionId(String(cached.jobDescriptionId ?? ''))
      setSelectedDomain(String(cached.selectedDomain ?? ''))
      return
    }
    setResult(null)
    setJobDescriptionId('')
    if (!activeResumeId) {
      return
    }
    queueMicrotask(async () => {
      try {
        const saved = await studentApi.getLatestJobDescription(activeResumeId)
        if (saved?._id) setJobDescriptionId(String(saved._id))
        if (saved?.targetRole) setTargetRole(String(saved.targetRole))
        if (saved?.preferredLocation) setPreferredLocation(String(saved.preferredLocation))
        const latestRecommendation = await studentApi.getLatestRecommendations(activeResumeId, {
          jobDescriptionId: String(saved?._id ?? ''),
          language: 'both',
        })
        const normalized = (latestRecommendation as ApiRecord | null) ?? null
        setResult(normalized)
      } catch {
        setResult(null)
      }
    })
  }, [activeResumeId, pageKey])

  useEffect(() => {
    setPageState(pageKey, { targetRole, preferredLocation, result, jobDescriptionId, selectedDomain })
  }, [targetRole, preferredLocation, result, jobDescriptionId, selectedDomain, pageKey])

  const saveSelectedDomain = async () => {
    setDomainSaving(true)
    try {
      const savedProfile = normalizeStudentProfile(await studentApi.updateProfile({ confirmedDomain: selectedDomain }))
      setProfile(savedProfile)
    } finally {
      setDomainSaving(false)
    }
  }

  const analyze = async () => {
    if (!activeResumeId) return
    setLoading(true)
    try {
      const recommendation = await studentApi.smartRecommendations({
        resumeId: activeResumeId,
        language: 'both',
        targetRole,
        preferredLocation,
        jobDescriptionId,
        saveHistory: true,
        selectedDomain,
      })
      setResult(recommendation)
      await studentApi.createReport({ type: 'Step 6 Recommendation', title: `Smart Recommendation Report (${activeResumeId})`, payload: recommendation })
    } finally {
      setLoading(false)
    }
  }

  const readinessLabel = (value: string) =>
    value === 'ready_to_apply' ? 'Ready to apply' : value === 'near_match' ? 'Near-match' : 'Recommended to study'

  const readinessTone = (value: string) =>
    value === 'ready_to_apply'
      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
      : value === 'near_match'
        ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
        : 'bg-slate-700/50 text-slate-200 border-slate-500/50'

  const fitTone = (score: number) =>
    score >= 75 ? 'text-emerald-300' : score >= 55 ? 'text-cyan-300' : 'text-amber-300'

  const renderFieldCards = (fields: ApiRecord[]) => (
    <div className="grid gap-4 lg:grid-cols-2">
      {fields.map((field) => (
        <div key={String(field.fieldKey ?? field.fieldName)} className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-100">{String(field.fieldName ?? '-')}</p>
              <p className="mt-1 text-sm text-slate-400">{String(field.reasonForRecommendation ?? 'Field recommendation is based on your current profile and resume evidence.')}</p>
            </div>
            <div className="text-right">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${readinessTone(String(field.readinessCategory ?? 'recommended_to_study'))}`}>
                {readinessLabel(String(field.readinessCategory ?? 'recommended_to_study'))}
              </span>
              <p className={`mt-2 text-xl font-semibold ${fitTone(Number(field.fitScore ?? 0))}`}>{Number(field.fitScore ?? 0)}%</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Matched skills</p>
              <p className="mt-1 text-sm text-slate-300">{textList(field.matchedSkills ?? [])}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Missing skills</p>
              <p className="mt-1 text-sm text-amber-300">{textList(field.missingSkills ?? [])}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Suggested improvements</p>
              <p className="mt-1 text-sm text-slate-300">{textList(field.suggestedImprovements ?? [])}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Next steps</p>
              <p className="mt-1 text-sm text-slate-300">{textList(field.recommendedNextSteps ?? [])}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const skillGapAnalysis = (result?.skillGapAnalysis ?? {}) as ApiRecord
  const detectedDomain = (result?.detectedDomain ?? {}) as ApiRecord
  const detectedOptions = (detectedDomain.topDomains ?? profile.detectedDomains ?? []) as ApiRecord[]
  const fieldSummary = (result?.careerFieldSummary ?? {}) as ApiRecord
  const topFields = toStringArray(fieldSummary.topFields)
  const readyFields = (result?.readyToApplyFields ?? []) as ApiRecord[]
  const nearFields = (result?.nearMatchFields ?? []) as ApiRecord[]
  const studyFields = (result?.recommendedToStudyFields ?? []) as ApiRecord[]
  const allFields = (result?.careerFieldRecommendations ?? []) as ApiRecord[]
  const bestFitFields = allFields.slice(0, 3)
  const fieldJobGroups = (result?.fieldJobGroups ?? []) as ApiRecord[]
  const allJobs = fieldJobGroups.flatMap((group) => ((group.jobs ?? []) as ApiRecord[]))
  const topJob = allJobs[0] ?? {}
  const missingSkills = [
    ...(skillGapAnalysis.missingRequiredSkills ?? []),
    ...(skillGapAnalysis.weakRequiredSkills ?? []),
  ] as string[]
  const supportSkillsToImprove = unique([
    ...missingSkills,
    ...nearFields.flatMap((field) => toStringArray(field.missingSkills)),
    ...studyFields.flatMap((field) => toStringArray(field.missingSkills)),
  ]).slice(0, 8)

  return (
    <div className="space-y-5">
      <PageHeader title="Career Field Recommendations" subtitle="Find the roles you can realistically target now, the nearby options worth improving toward, and the study-next paths that fit your profile." />
      <Card className="space-y-3">
        <p className="text-sm text-slate-400">Latest resume: {latest(resumes)?.fileName ?? 'No resume uploaded yet'}</p>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">Field control</p>
              <p className="mt-1 text-sm text-slate-400">Recommendations stay inside your selected field. If detection is wrong, change it here and refresh.</p>
            </div>
            <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200">
              {profile.confirmedDomainLabel ? `Confirmed: ${profile.confirmedDomainLabel}` : 'Not your field? Change it below'}
            </span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <AppSelect
              value={selectedDomain}
              onChange={setSelectedDomain}
              options={[
                { value: '', label: 'Use detected suggestion' },
                ...domainOptions.map((option) => ({ value: option.key, label: option.label })),
              ]}
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
            />
            <button onClick={saveSelectedDomain} disabled={domainSaving} className="app-primary-button rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60">
              {domainSaving ? 'Saving field...' : 'Confirm field'}
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {detectedOptions.slice(0, 3).map((domain) => (
              <div key={String(domain.key)} className="rounded-xl border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-100">{String(domain.label)}</p>
                  <span className="text-xs text-slate-500">{Number(domain.confidence ?? 0)}%</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{textList(domain.reasons ?? [])}</p>
              </div>
            ))}
          </div>
        </div>
        <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Preferred role hint (optional, for example: Frontend Developer)" />
        <input value={preferredLocation} onChange={(event) => setPreferredLocation(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Preferred location (for example: Bengaluru)" />
        <button className="app-primary-button rounded-lg px-4 py-2 font-semibold" onClick={analyze}>{loading ? 'Refreshing Career Recommendations...' : 'Generate Career Recommendations'}</button>
      </Card>
      {result ? (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <Card>
              <p className="text-sm text-slate-400">Overall Career Fit</p>
              <p className="mt-2 text-lg font-semibold text-white">{String(fieldSummary.overallCareerFit ?? 'Generate recommendations to see your strongest role direction.')}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-400">Active Field</p>
              <p className="mt-2 text-lg font-semibold text-white">{String(profile.confirmedDomainLabel || detectedDomain.label || fieldSummary.detectedDomain || 'General Fresher')}</p>
              <p className="mt-2 text-xs text-slate-500">
                {detectedDomain.confirmed ? 'Using confirmed field for recommendations.' : `Detected with ${Number(detectedDomain.confidence ?? 0)}% confidence. Change field if needed.`}
              </p>
            </Card>
            <Card>
              <p className="text-sm text-slate-400">Ready To Apply</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-300">{Number(fieldSummary.readyToApplyCount ?? readyFields.length)}</p>
            </Card>
            <Card>
              <p className="text-sm text-slate-400">Top 3 Recommended Fields</p>
              <p className="mt-2 text-lg font-semibold text-white">{topFields.length ? topFields.join(', ') : '-'}</p>
              <p className="mt-2 text-xs text-slate-500">Top missing skill: {String(fieldSummary.topMissingSkill ?? supportSkillsToImprove[0] ?? '-')}</p>
            </Card>
          </div>
          {toStringArray(detectedDomain.alternativeSuggestions).length ? (
            <Card>
              <h3 className="font-semibold">Possible Alternate Domains</h3>
              <p className="mt-1 text-sm text-slate-400">
                Your profile is not strongly locked to one domain yet, so these are additional directions worth exploring.
              </p>
              <p className="mt-3 text-sm text-slate-300">{textList(detectedDomain.alternativeSuggestions)}</p>
            </Card>
          ) : null}

          <Card className="space-y-4">
            <div>
              <h3 className="font-semibold">Best Fit Fields</h3>
              <p className="mt-1 text-sm text-slate-400">These are the strongest and most realistic directions based on your actual skills, projects, education, and experience evidence.</p>
            </div>
            {bestFitFields.length ? renderFieldCards(bestFitFields) : <p className="text-sm text-slate-500">Generate recommendations to see your best-fit roles.</p>}
          </Card>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Missing Skills To Improve</h3>
              <p className="mt-1 text-sm text-slate-400">{supportSkillsToImprove.length ? `${supportSkillsToImprove.length} important gaps found: ${supportSkillsToImprove.slice(0, 5).join(', ')}.` : 'No major required skill gaps detected from the current recommendation set.'}</p>
            </div>
            <a href="/student/skill-gap" className="app-primary-button rounded-lg px-3 py-2 text-sm font-semibold">Open Skill Gap Report</a>
          </Card>
          <Card className="space-y-3">
            <div>
              <h3 className="font-semibold">Ready To Apply</h3>
              <p className="mt-1 text-sm text-slate-400">These roles have enough support from your current profile to start applying now.</p>
            </div>
            {readyFields.length ? renderFieldCards(readyFields) : <p className="text-sm text-slate-500">No strong apply-now roles yet. Focus on the near-match section below.</p>}
          </Card>
          <Card className="space-y-3">
            <div>
              <h3 className="font-semibold">Near-Match Roles</h3>
              <p className="mt-1 text-sm text-slate-400">These roles are close to your current profile and become realistic after a few focused improvements.</p>
            </div>
            {nearFields.length ? renderFieldCards(nearFields) : <p className="text-sm text-slate-500">No near-match roles were detected from the current data.</p>}
          </Card>
          <Card className="space-y-3">
            <div>
              <h3 className="font-semibold">Recommended To Study</h3>
              <p className="mt-1 text-sm text-slate-400">These paths are relevant, but they are better framed as next learning directions than immediate job targets.</p>
            </div>
            {studyFields.length ? renderFieldCards(studyFields) : <p className="text-sm text-slate-500">No study-next roles were identified from the current data.</p>}
          </Card>
          <Card className="space-y-4">
            <div>
              <h3 className="font-semibold">Jobs You Can Apply For</h3>
              <p className="mt-1 text-sm text-slate-400">Each group below uses your current field recommendations instead of one generic job list for everyone.</p>
            </div>
            <div className="space-y-4">
              {fieldJobGroups.map((group) => {
                const jobs = (group.jobs ?? []) as ApiRecord[]
                return (
                  <div key={String(group.fieldKey ?? group.fieldName)} className="rounded-xl border border-slate-800 bg-slate-950/25 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-slate-100">{String(group.fieldName ?? '-')}</p>
                        <p className="mt-1 text-sm text-slate-400">{readinessLabel(String(group.readinessCategory ?? 'recommended_to_study'))}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${readinessTone(String(group.readinessCategory ?? 'recommended_to_study'))}`}>
                        {jobs.length} jobs
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {jobs.map((job) => (
                        <div key={`${job.platformName}-${job.jobTitle}-${job.companyName}-${job.location}`} className="rounded-xl border border-slate-800 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-base font-semibold text-slate-100">{job.jobTitle}</p>
                              <p className="text-sm text-slate-400">{job.companyName} | {job.location} | {job.platformName}</p>
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${job.isPreferredLocationMatch ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 text-slate-100'}`}>
                              Fit {Number(job.fitScore ?? 0)}%
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-slate-300">{String(job.reasonForRecommendation ?? 'This job aligns with your current field direction.')}</p>
                          <p className="mt-2 text-sm text-slate-400">Matched skills: {textList(job.matchedSkills ?? [])}</p>
                          <p className="mt-1 text-sm text-amber-300">Missing skills: {textList(job.missingSkills ?? [])}</p>
                          <p className="mt-1 text-sm text-slate-500">Preparation before applying: {textList(job.suggestedImprovementsBeforeApplying ?? [])}</p>
                          <a href={String(job.applyLink ?? '#')} target="_blank" rel="noreferrer" className="app-primary-button mt-3 inline-block rounded-lg px-3 py-2 text-sm font-semibold">Open Job Link</a>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {fieldJobGroups.length === 0 ? <p className="text-sm text-slate-500">Generate recommendations to see field-specific job suggestions.</p> : null}
            </div>
          </Card>
          <Card className="space-y-3">
            <div>
              <h3 className="font-semibold">Suggested Next Steps</h3>
              <p className="mt-1 text-sm text-slate-400">The fastest way to improve your career options is to strengthen the most repeated gaps across your recommended fields.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Top missing skills</p>
                <p className="mt-2 text-sm text-slate-300">{textList(supportSkillsToImprove)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">First job to target</p>
                <p className="mt-2 text-sm text-slate-300">{String(topJob.jobTitle ?? bestFitFields[0]?.fieldName ?? 'Generate recommendations')}</p>
                <p className="mt-2 text-sm text-slate-500">{String(topJob.reasonForRecommendation ?? bestFitFields[0]?.reasonForRecommendation ?? '')}</p>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  )
}
export const ResumeAnalysisPage = () => {
  const { reports } = useReports()
  const report = reports.find((item) => item.type === 'Resume Analysis')
  const content = contentOf(report)
  const sections = content.structuredContent?.sections ?? []
  const scoreBreakdown = Array.isArray(content.scoreBreakdown) ? content.scoreBreakdown : []

  return (
    <div className="space-y-5">
      <PageHeader title="Resume Analysis" subtitle="ATS score, section feedback, keywords, and AI enhancement." />
      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2"><CircularScore score={Number(content.score ?? 0)} /><CircularScore score={Number(content.atsCompatibility?.score ?? 0)} /></div>
          <Card className="space-y-4">
            <div>
              <h3 className="font-semibold">ATS Score Breakdown</h3>
              <p className="mt-1 text-sm text-slate-400">This shows how the resume score is being built, so the number is easier to understand and improve.</p>
            </div>
            {scoreBreakdown.length ? (
              <div className="space-y-4">
                {scoreBreakdown.map((item: ApiRecord) => {
                  const label = String(item.label)
                  const earned = Number(item.score ?? 0)
                  const maxPoints = Number(item.weight ?? 0)
                  const missingPoints = Math.max(0, maxPoints - earned)
                  const progress = maxPoints ? Math.round((earned / maxPoints) * 100) : 0
                  const tips = atsImprovementTips[label] ?? ['Improve this section using the feedback shown above.']

                  return (
                    <div key={label} className="rounded-xl border border-slate-800 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-100">{label}</p>
                          <p className="mt-1 text-sm text-slate-400">{item.reason}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-white">{earned}/{maxPoints}</p>
                          <p className={missingPoints ? 'text-xs font-semibold text-amber-300' : 'text-xs font-semibold text-emerald-300'}>
                            {missingPoints ? `Can improve +${missingPoints} points` : 'Full points earned'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <ProgressBar label={`${label} progress`} value={progress} />
                      </div>
                      {missingPoints ? (
                        <div className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">Improve this section</p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(tips)}</ul>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-emerald-300">This section is already strong. Keep it consistent in future CV updates.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No detailed scoring breakdown is available for this report yet.</p>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold">ATS Formatting Guidance</h3>
            <p className="mt-2 text-sm text-slate-400">{content.atsCompatibility?.feedback ?? 'Use standard headings, clean formatting, and text-based content for better ATS parsing.'}</p>
          </Card>
          <Card><h3 className="font-semibold">Missing In-Demand Skills</h3><ul className="mt-2 list-disc pl-5 text-sm text-slate-600">{asRows(content.keywordOptimization?.missingInDemandSkills ?? [])}</ul></Card>
          <Card><h3 className="font-semibold">Resume Text Preview</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{content.structuredContent?.normalizedTextPreview ?? 'No extracted preview available.'}</p></Card>
          <Card><h3 className="font-semibold">AI Enhancement</h3><p className="mt-2 text-sm text-slate-600">{content.enhancement?.summaryRewrite}</p><p className="mt-2 text-sm text-slate-600">{content.enhancement?.bulletRewriteTemplate}</p></Card>
          <Card className="space-y-2">{sections.map((section: ApiRecord) => <ProgressBar key={section.title} label={section.title} value={Number(section.score)} />)}</Card>
        </>
      ) : <Card><p>Upload and analyze a resume first.</p></Card>}
    </div>
  )
}

export const SkillGapPage = () => {
  const { resumes } = useResumes()
  const { pageState, setPageState } = useResumeSession()
  const activeResumeId = getId(latest(resumes) ?? {})
  const pageKey = `skill-gap:${activeResumeId || 'no-resume'}`
  const cachedPage = pageState[pageKey] ?? {}
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [targetField, setTargetField] = useState(String(cachedPage.targetField ?? ''))
  const [jobText, setJobText] = useState(String(cachedPage.jobText ?? ''))
  const [result, setResult] = useState<ApiRecord | null>((cachedPage.result as ApiRecord | null | undefined) ?? null)
  const [recommendation, setRecommendation] = useState<ApiRecord | null>((cachedPage.recommendation as ApiRecord | null | undefined) ?? null)
  const [language, setLanguage] = useState<'english' | 'hindi' | 'both'>((cachedPage.language as 'english' | 'hindi' | 'both' | undefined) ?? 'both')
  const [selectedVideo, setSelectedVideo] = useState<ApiRecord | null>((cachedPage.selectedVideo as ApiRecord | null | undefined) ?? null)
  const [skillStatus, setSkillStatus] = useState<Record<string, string>>((cachedPage.skillStatus as Record<string, string> | undefined) ?? {})
  const [loading, setLoading] = useState(false)
  const playerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void studentApi.getProfile().then((savedProfile) => setProfile(normalizeStudentProfile(savedProfile))).catch(() => undefined)
  }, [])

  useEffect(() => {
    const cached = pageState[pageKey]
    setTargetField(String(cached?.targetField ?? ''))
    setJobText(String(cached?.jobText ?? ''))
    setResult((cached?.result as ApiRecord | null | undefined) ?? null)
    setRecommendation((cached?.recommendation as ApiRecord | null | undefined) ?? null)
    setLanguage((cached?.language as 'english' | 'hindi' | 'both' | undefined) ?? 'both')
    setSelectedVideo((cached?.selectedVideo as ApiRecord | null | undefined) ?? null)
    setSkillStatus((cached?.skillStatus as Record<string, string> | undefined) ?? {})
  }, [activeResumeId, pageKey])

  useEffect(() => {
    setPageState(pageKey, { targetField, jobText, result, recommendation, language, selectedVideo, skillStatus })
  }, [targetField, jobText, result, recommendation, language, selectedVideo, skillStatus, pageKey])

  const analyze = async () => {
    const resume = latest(resumes)
    const resumeId = getId(resume ?? {})
    if (!resume || !resumeId) return
    setLoading(true)
    setRecommendation(null)
    setSelectedVideo(null)
    try {
      const localJobText = [targetField, jobText].filter(Boolean).join('\n\n')
      const report = await studentApi.skillGap({
        resumeId,
        jobText: localJobText,
        targetRole: targetField,
        selectedDomain: profile.confirmedDomain,
      })
      const reportContent = contentOf(report)
      setResult(reportContent)
      await studentApi.createReport({ type: 'Skill Gap', title: 'Skill Gap Report', payload: reportContent })

      const localRecommendation = await studentApi.smartRecommendations({
        resumeId,
        language,
        targetRole: targetField,
        jobDescriptionText: jobText,
        saveHistory: false,
        selectedDomain: profile.confirmedDomain,
      })
      setRecommendation(localRecommendation)
      setSelectedVideo(((localRecommendation.learningRecommendations ?? []) as ApiRecord[])[0] ?? null)
    } finally {
      setLoading(false)
    }
  }
  const gaps = result?.gaps ?? []
  const skillGapAnalysis = (recommendation?.skillGapAnalysis ?? result?.skillGapAnalysis ?? {}) as ApiRecord
  const groupedVideos = (recommendation?.groupedLearningRecommendations ?? []) as ApiRecord[]
  const videos = (recommendation?.learningRecommendations ?? []) as ApiRecord[]
  const videoEmbedUrl = (video: ApiRecord | null): string => String(video?.embedUrl ?? video?.embedLink ?? '')
  const selectedVideoKey = String(
    selectedVideo?.selectedVideoId
    ?? selectedVideo?.videoLink
    ?? selectedVideo?.embedUrl
    ?? selectedVideo?.embedLink
    ?? selectedVideo?.videoTitle
    ?? '',
  )
  const videoSearchUrl = (video: ApiRecord): string => String(video.youtubeSearchUrl ?? `https://www.youtube.com/results?search_query=${encodeURIComponent(String(video.searchQuery ?? video.topicName ?? video.topic ?? 'learning tutorial'))}`)
  const playVideoHere = (video: ApiRecord) => {
    if (!videoEmbedUrl(video)) return
    setSelectedVideo(video)
    window.setTimeout(() => {
      playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
  }
  const jobSkills = (recommendation?.parsedJobDescription?.requiredSkills ?? []) as string[]
  const candidateSkills = (recommendation?.extractedCandidateProfile?.skills ?? result?.technicalSkills ?? []) as string[]
  const matchedSkills = (skillGapAnalysis.matchedSkills ?? []) as string[]
  const highSkills = unique([...(skillGapAnalysis.missingRequiredSkills ?? []), ...(skillGapAnalysis.weakRequiredSkills ?? [])] as string[])
  const mediumSkills = unique([...(skillGapAnalysis.partiallyMatchedSkills ?? [])] as string[])
  const lowSkills = unique([...(skillGapAnalysis.missingOptionalSkills ?? [])] as string[])
  const readinessScore = jobSkills.length
    ? Math.round((matchedSkills.length / jobSkills.length) * 100)
    : gaps.length
      ? Math.max(45, 90 - gaps.length * 8)
      : 0
  const topPriorityGap = highSkills[0] ?? mediumSkills[0] ?? lowSkills[0] ?? ''
  const gapDetails = (skill: string, priority: string, action: string): ApiRecord => {
    const topic = groupedVideos.find((group) => String(group.topicName).toLowerCase() === skill.toLowerCase())
    const typeLabel = priority === 'High' ? 'missing required skill' : priority === 'Medium' ? 'partially matched skill' : 'supporting skill'
    return {
      skill,
      priority,
      action,
      why: topic?.whyThisTopicMatters ?? `${skill} matters because it is a ${typeLabel} for the selected job.`,
      project: `Build a small ${skill} mini project and add one resume bullet explaining the problem, stack, and result.`,
      question: `How have you used ${skill} in a real project, and what tradeoff did you handle?`,
      impact: priority === 'High' ? 'High impact on job readiness' : priority === 'Medium' ? 'Medium impact on interview confidence' : 'Helpful supporting improvement',
      time: priority === 'High' ? '5-7 focused days' : priority === 'Medium' ? '2-4 focused days' : '1-2 focused days',
    }
  }
  const recommendationGapCandidates = [
    ...highSkills.map((skill: string) => gapDetails(skill, 'High', 'Learn the concept, build one proof project, and prepare one interview answer.')),
    ...mediumSkills.map((skill: string) => gapDetails(skill, 'Medium', 'Strengthen this with project evidence and targeted interview practice.')),
    ...lowSkills.map((skill: string) => gapDetails(skill, 'Low', 'Use this as a supporting topic after high priority gaps.')),
  ]
  const recommendationGaps = uniqueBy(recommendationGapCandidates, (gap) => `${String(gap.priority)}:${String(gap.skill).toLowerCase()}`)
  const visibleGaps = recommendationGaps.length
    ? recommendationGaps
    : uniqueBy((gaps as ApiRecord[]).filter(Boolean), (gap) => `${String(gap.priority ?? '')}:${String(gap.skill ?? '').toLowerCase()}`)
  const nextActions = visibleGaps.slice(0, 3).map((gap: ApiRecord, index: number) =>
    index === 0
      ? `Start with ${gap.skill}: ${gap.action}`
      : index === 1
        ? `Create one portfolio proof for ${gap.skill}.`
        : `Practice one interview answer around ${gap.skill}.`,
  )
  const priorityGroups = [
    { title: 'High Priority Gaps', items: visibleGaps.filter((gap: ApiRecord) => gap.priority === 'High'), className: 'border-red-400/40 bg-red-400/10 text-red-200' },
    { title: 'Medium Priority Gaps', items: visibleGaps.filter((gap: ApiRecord) => gap.priority === 'Medium'), className: 'border-amber-400/40 bg-amber-400/10 text-amber-200' },
    { title: 'Low Priority Gaps', items: visibleGaps.filter((gap: ApiRecord) => gap.priority === 'Low' || gap.priority === 'Optional'), className: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Skill Gap Report" subtitle="A practical improvement plan generated from your resume, profile, and this page's target details." />
      <Card className="space-y-3">
        <input value={targetField} onChange={(event) => setTargetField(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Target field, for example Data Analyst, Accounts Executive, Mechanical Engineer, or Frontend Developer" />
        <p className="text-sm text-slate-500">Current confirmed field: {profile.confirmedDomainLabel || profile.activeDomainLabel}. Use "Change field" in recommendations or profile if this is not your direction.</p>
        <textarea value={jobText} onChange={(event) => setJobText(event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Paste target job description for more accurate skill gap analysis..." />
        <label className="text-sm font-medium text-slate-200">Preferred learning language</label>
        <AppSelect
          value={language}
          onChange={(value) => setLanguage(value as 'english' | 'hindi' | 'both')}
          options={asSelectOptions([
            { value: 'both', label: 'Both (Hindi + English)' },
            { value: 'hindi', label: 'Hindi videos' },
            { value: 'english', label: 'English videos' },
          ])}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
        />
        <button onClick={analyze} className="app-primary-button rounded-lg px-4 py-2 font-semibold">{loading ? 'Analyzing...' : 'Analyze Skill Gap'}</button>
      </Card>
      <Card className="grid gap-4 md:grid-cols-4">
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Job readiness</p><p className="mt-1 text-2xl font-semibold text-white">{readinessScore ? `${readinessScore}%` : 'Pending'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Matched skills</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{matchedSkills.length}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Missing skills</p><p className="mt-1 text-2xl font-semibold text-amber-300">{highSkills.length + lowSkills.length}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Top priority gap</p><p className="mt-1 text-sm text-slate-200">{topPriorityGap || 'Run analysis'}</p></div>
      </Card>
      <Card className="grid gap-4 md:grid-cols-3">
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Resume</p><p className="mt-1 text-sm text-slate-200">{latest(resumes)?.fileName ?? 'No uploaded resume'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Target Field</p><p className="mt-1 text-sm text-slate-200">{String(recommendation?.targetRole ?? targetField)}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Estimated improvement time</p><p className="mt-1 text-sm text-slate-200">{visibleGaps.length ? `${Math.min(21, visibleGaps.length * 3)} focused days` : 'Pending'}</p></div>
      </Card>
      <Card>
        <p className="text-xs uppercase tracking-wide text-slate-400">Gap context</p>
        <p className="mt-2 text-sm text-slate-300">
          These gaps are generated for {String(recommendation?.targetRole ?? targetField ?? profile.confirmedDomainLabel ?? profile.activeDomainLabel ?? 'your selected direction')}
          {' '}inside the {profile.confirmedDomainLabel || profile.activeDomainLabel} field.
        </p>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Job vs Your Current Skills</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Job requires</p><p className="mt-1 text-sm text-slate-200">{textList(jobSkills)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">You already have</p><p className="mt-1 text-sm text-emerald-300">{textList(candidateSkills)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Missing or weak</p><p className="mt-1 text-sm text-amber-300">{textList(visibleGaps.map((gap: ApiRecord) => gap.skill))}</p></div>
        </div>
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">Priority Gaps</h3>
        {visibleGaps.length ? visibleGaps.map((gap: ApiRecord) => (
          <div key={gap.skill} className="rounded-xl border border-slate-800 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{gap.skill}</p>
              <AppSelect
                value={skillStatus[gap.skill] ?? 'not started'}
                onChange={(value) => setSkillStatus((current) => ({ ...current, [gap.skill]: value }))}
                options={asSelectOptions([
                  { value: 'not started', label: 'Not started' },
                  { value: 'learning', label: 'Learning' },
                  { value: 'completed', label: 'Completed' },
                ])}
                className="rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs"
              />
            </div>
            <span className={`inline-block rounded-full border px-2 py-1 text-xs ${gap.priority === 'High' ? 'border-red-400/40 bg-red-400/10 text-red-200' : gap.priority === 'Medium' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'}`}>{gap.priority} priority</span>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <p className="text-sm text-slate-400"><span className="font-semibold text-slate-200">Why it matters:</span> {gap.why ?? gap.action}</p>
              <p className="text-sm text-slate-400"><span className="font-semibold text-slate-200">What to do next:</span> {gap.action}</p>
              <p className="text-sm text-slate-400"><span className="font-semibold text-slate-200">Mini project:</span> {gap.project}</p>
              <p className="text-sm text-slate-400"><span className="font-semibold text-slate-200">Practice question:</span> {gap.question}</p>
              <p className="text-sm text-slate-400"><span className="font-semibold text-slate-200">Impact:</span> {gap.impact}</p>
              <p className="text-sm text-slate-400"><span className="font-semibold text-slate-200">Time:</span> {gap.time}</p>
            </div>
          </div>
        )) : <p>Run analysis here to see personalized skill gaps from your uploaded resume and profile.</p>}
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {priorityGroups.map((group) => (
          <Card key={group.title} className="space-y-3">
            <h3 className="font-semibold">{group.title}</h3>
            {group.items.length ? group.items.map((gap: ApiRecord) => (
              <div key={`${group.title}-${gap.skill}`} className={`rounded-xl border p-3 ${group.className}`}>
                <p className="font-medium">{gap.skill}</p>
                <p className="mt-1 text-xs opacity-90">{gap.action}</p>
              </div>
            )) : <p className="text-sm text-slate-500">No gaps in this priority group.</p>}
          </Card>
        ))}
      </div>
      <Card className="space-y-3">
        <h3 className="font-semibold">Recommended Learning Topics</h3>
        {groupedVideos.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {groupedVideos.map((group) => (
              <div key={`${group.topicName}-${group.priorityLevel}`} className="rounded-xl border border-slate-800 p-3">
                <p className="font-semibold text-slate-100">{group.topicName}</p>
                <p className="text-xs uppercase tracking-wide text-amber-300">Priority: {group.priorityLevel} | Gap: {group.gapType}</p>
                <p className="mt-1 text-sm text-slate-400">{group.whyThisTopicMatters}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">Run analysis here to load learning topics for this skill gap report.</p>}
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Recommended learning videos based on your skill gaps</h3>
        <p className="text-sm text-slate-400">Hindi and English videos are ranked from the current recommendation result.</p>
        {videoEmbedUrl(selectedVideo) ? (
          <div ref={playerRef} className="overflow-hidden rounded-xl border border-slate-800">
            <iframe
              key={selectedVideoKey}
              title={String(selectedVideo?.videoTitle ?? 'Recommended video')}
              src={videoEmbedUrl(selectedVideo)}
              className="h-72 w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        ) : null}
        <div className="space-y-4">
          {groupedVideos.map((group) => (
            <div key={`${group.topicName}-${group.gapType}-videos`} className="rounded-xl border border-slate-800 p-3">
              <p className="font-semibold text-slate-100">{group.topicName}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {(group.videos ?? []).map((video: ApiRecord) => (
                  <div key={`${video.topicName}-${video.language}-${video.videoTitle}-${video.recommendationType}`} className="rounded-xl border border-slate-800 p-3">
                    <p className="font-medium text-slate-100">{video.videoTitle}</p>
                    <p className="text-xs uppercase tracking-wide text-cyan-300">{video.language} | {video.recommendationIntent ?? video.recommendationType} | {video.difficultyLevel}</p>
                    <p className="mt-1 text-xs text-emerald-300">Relevance score: {Number(video.relevanceScore ?? 0)}</p>
                    <p className="mt-1 text-xs text-slate-500">Query: {String(video.searchQuery ?? '')}</p>
                    <p className="mt-2 text-sm text-slate-400">{video.reasonForRecommendation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => playVideoHere(video)} disabled={!videoEmbedUrl(video)} className="app-primary-button rounded-lg px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Play Here</button>
                      <a href={videoSearchUrl(video)} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-100">Play on YouTube</a>
                      {!video.isEmbeddable ? <span className="rounded-lg border border-amber-500/40 px-2 py-1 text-xs text-amber-200">External only</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {groupedVideos.length === 0 && videos.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {videos.map((video) => (
              <div key={`${video.topicName}-${video.language}-${video.videoTitle}`} className="rounded-xl border border-slate-800 p-3">
                <p className="font-medium text-slate-100">{video.videoTitle}</p>
                <p className="text-xs uppercase tracking-wide text-cyan-300">{video.language} | {video.recommendationIntent ?? video.recommendationType} | {video.difficultyLevel}</p>
                <p className="mt-1 text-xs text-slate-500">Query: {String(video.searchQuery ?? '')}</p>
                <p className="mt-2 text-sm text-slate-400">{video.reasonForRecommendation}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => playVideoHere(video)} disabled={!videoEmbedUrl(video)} className="app-primary-button rounded-lg px-2 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Play Here</button>
                  <a href={videoSearchUrl(video)} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-100">Play on YouTube</a>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Your Next 3 Steps</h3>
        {nextActions.length ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
            {nextActions.map((action: string) => <li key={action}>{action}</li>)}
          </ol>
        ) : <p className="text-sm text-slate-500">Generate recommendations to receive your next actions.</p>}
      </Card>
    </div>
  )
}

export const InterviewPreparationPage = () => {
  const { resumes } = useResumes()
  const { reports } = useReports()
  const { pageState, setPageState } = useResumeSession()
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const activeResumeId = getId(latest(resumes) ?? {})
  const pageKey = `interview-prep:${activeResumeId || 'no-resume'}`
  const cachedPage = pageState[pageKey] ?? {}
  const [role, setRole] = useState(String(cachedPage.role ?? ''))
  const [difficulty, setDifficulty] = useState(String(cachedPage.difficulty ?? 'Intermediate'))
  const [companyType, setCompanyType] = useState(String(cachedPage.companyType ?? 'campus placement'))
  const [jobDescriptionText, setJobDescriptionText] = useState(String(cachedPage.jobDescriptionText ?? ''))
  const [plan, setPlan] = useState<ApiRecord | null>((cachedPage.plan as ApiRecord | null | undefined) ?? null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState(String(cachedPage.activeTab ?? 'All'))
  const [difficultyFilter, setDifficultyFilter] = useState(String(cachedPage.difficultyFilter ?? 'All'))
  const [topicFilter, setTopicFilter] = useState(String(cachedPage.topicFilter ?? 'All'))
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(Number(cachedPage.currentQuestionIndex ?? 0))
  const [expandedId, setExpandedId] = useState(String(cachedPage.expandedId ?? ''))
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>((cachedPage.bookmarked as Record<string, boolean> | undefined) ?? {})
  const [practiced, setPracticed] = useState<Record<string, boolean>>((cachedPage.practiced as Record<string, boolean> | undefined) ?? {})
  const [error, setError] = useState(String(cachedPage.error ?? ''))
  const skillGapReport = contentOf(reports.find((item) => item.type === 'Skill Gap'))

  useEffect(() => {
    void studentApi.getProfile().then((savedProfile) => setProfile(normalizeStudentProfile(savedProfile))).catch(() => undefined)
  }, [])

  useEffect(() => {
    const cached = pageState[pageKey]
    setRole(String(cached?.role ?? ''))
    setDifficulty(String(cached?.difficulty ?? 'Intermediate'))
    setCompanyType(String(cached?.companyType ?? 'campus placement'))
    setJobDescriptionText(String(cached?.jobDescriptionText ?? ''))
    setPlan((cached?.plan as ApiRecord | null | undefined) ?? null)
    setActiveTab(String(cached?.activeTab ?? 'All'))
    setDifficultyFilter(String(cached?.difficultyFilter ?? 'All'))
    setTopicFilter(String(cached?.topicFilter ?? 'All'))
    setCurrentQuestionIndex(Number(cached?.currentQuestionIndex ?? 0))
    setExpandedId(String(cached?.expandedId ?? ''))
    setBookmarked((cached?.bookmarked as Record<string, boolean> | undefined) ?? {})
    setPracticed((cached?.practiced as Record<string, boolean> | undefined) ?? {})
    setError(String(cached?.error ?? ''))
  }, [activeResumeId, pageKey])

  useEffect(() => {
    setPageState(pageKey, { role, difficulty, companyType, jobDescriptionText, plan, activeTab, difficultyFilter, topicFilter, currentQuestionIndex, expandedId, bookmarked, practiced, error })
  }, [role, difficulty, companyType, jobDescriptionText, plan, activeTab, difficultyFilter, topicFilter, currentQuestionIndex, expandedId, bookmarked, practiced, error, pageKey])

  const generate = async () => {
    const resume = latest(resumes)
    setLoading(true)
    setError('')
    try {
      const saved = await studentApi.generateInterview({
        role,
        difficulty,
        resumeId: resume ? getId(resume) : undefined,
        jobDescriptionText,
        companyType,
      })
      const savedContent = contentOf(saved)
      setPlan(savedContent)
      setCurrentQuestionIndex(0)
      setExpandedId(String((savedContent.topRecommended ?? savedContent.questions ?? [])[0]?.id ?? ''))
      await studentApi.createReport({ type: 'Interview Preparation', title: 'Interview Preparation Plan', payload: savedContent })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to build interview preparation plan.')
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  const questions = ((plan?.questions ?? []) as ApiRecord[])
  const readiness = (plan?.readiness ?? {}) as ApiRecord
  const contextSummary = (plan?.contextSummary ?? {}) as ApiRecord
  const practicedCount = questions.filter((question) => practiced[String(question.id)]).length
  const bookmarkedCount = questions.filter((question) => bookmarked[String(question.id)]).length
  const weakTopics = toStringArray(contextSummary.weakSkills)
  const topWeakTopic = String(readiness.topWeakTopic ?? weakTopics[0] ?? skillGapReport.gaps?.[0]?.skill ?? 'Run preparation')
  const categories = ['All', 'Technical', 'HR', 'Resume-Based', 'Weak Topics', 'Role-Based', 'Revision', 'Saved']
  const questionCategory = (question: ApiRecord) => String(question.category ?? '')
  const categoryMatches = (question: ApiRecord) => {
    const category = questionCategory(question).toLowerCase()
    if (activeTab === 'All') return true
    if (activeTab === 'Technical') return category.includes('technical') || category.includes('core') || category.includes('skill')
    if (activeTab === 'HR') return category.includes('hr')
    if (activeTab === 'Resume-Based') return category.includes('resume') || category.includes('project')
    if (activeTab === 'Weak Topics') return category.includes('weak')
    if (activeTab === 'Role-Based') return category.includes('role') || category.includes('job')
    if (activeTab === 'Revision') return category.includes('revision')
    if (activeTab === 'Saved') return Boolean(bookmarked[String(question.id)])
    return true
  }
  const topicOptions = ['All', ...unique(questions.map((question) => String(question.topic ?? '')).filter(Boolean))]
  const difficultyOptions = ['All', ...unique(questions.map((question) => String(question.difficulty ?? '')).filter(Boolean))]
  const filteredQuestions = questions.filter((question) =>
    categoryMatches(question)
    && (difficultyFilter === 'All' || String(question.difficulty) === difficultyFilter)
    && (topicFilter === 'All' || String(question.topic) === topicFilter)
  )
  useEffect(() => {
    setCurrentQuestionIndex((current) => {
      if (filteredQuestions.length === 0) return 0
      return Math.min(current, filteredQuestions.length - 1)
    })
  }, [filteredQuestions.length, activeTab, difficultyFilter, topicFilter])
  const dailyPractice = ((plan?.dailyPractice ?? questions.slice(0, 7)) as ApiRecord[]).filter(Boolean)
  const quickRevision = toStringArray(plan?.quickRevision)
  const commonMistakes = toStringArray(plan?.commonMistakes)
  const readinessScore = questions.length ? Math.round((practicedCount / questions.length) * 100) : Number(readiness.score ?? 0)
  const currentQuestion = filteredQuestions[currentQuestionIndex] ?? null
  const toggle = (setter: Dispatch<SetStateAction<Record<string, boolean>>>, id: string) => {
    setter((current) => ({ ...current, [id]: !current[id] }))
  }
  const toggleAnswerStructure = (id: string) => {
    const scrollY = window.scrollY
    setExpandedId((current) => current === id ? '' : id)
    window.requestAnimationFrame(() => window.scrollTo({ top: scrollY }))
  }
  const renderQuestionCard = (question: ApiRecord, compact = false) => {
    const id = String(question.id ?? question.questionText)
    const isExpanded = expandedId === id
    const structure = (question.answerStructure ?? {}) as ApiRecord
    return (
      <div className={`rounded-xl border p-4 ${practiced[id] ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-slate-800'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-cyan-400/40 px-2 py-1 text-cyan-200">{String(question.category ?? 'Question')}</span>
              <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{String(question.topic ?? 'Topic')}</span>
              <span className="rounded-full border border-amber-400/40 px-2 py-1 text-amber-200">{String(question.difficulty ?? difficulty)}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-100">{String(question.questionText ?? '')}</h3>
            <p className="mt-2 text-sm text-slate-400">{String(question.whyRecommended ?? 'Recommended from your preparation context.')}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => toggle(setBookmarked, id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${bookmarked[id] ? 'bg-amber-400 text-slate-950' : 'border border-slate-700 text-slate-200'}`}>{bookmarked[id] ? 'Saved' : 'Save'}</button>
            <button type="button" onClick={() => toggle(setPracticed, id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${practiced[id] ? 'bg-emerald-400 text-slate-950' : 'border border-slate-700 text-slate-200'}`}>{practiced[id] ? 'Practiced' : 'Mark Practiced'}</button>
          </div>
        </div>
        {!compact ? (
          <>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Answer guidance</p>
              <p className="mt-1 text-sm text-slate-300">{String(question.answerHint ?? 'Answer directly, explain briefly, give an example, and close with impact.')}</p>
            </div>
            <button type="button" onClick={() => toggleAnswerStructure(id)} className="mt-3 text-sm font-semibold text-cyan-300">{isExpanded ? 'Hide answer structure' : 'Show answer structure'}</button>
            {isExpanded ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-slate-800 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Use this structure</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
                    <li>{String(structure.directAnswer ?? 'Give the direct answer first.')}</li>
                    <li>{String(structure.explanation ?? 'Explain the concept in simple language.')}</li>
                    <li>{String(structure.example ?? 'Add a practical example.')}</li>
                    <li>{String(structure.projectLink ?? 'Connect it to your project or experience.')}</li>
                    <li>{String(structure.impact ?? 'Close with the result or impact.')}</li>
                  </ol>
                </div>
                <div className="rounded-lg border border-slate-800 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Key points</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(toStringArray(question.keyPoints))}</ul>
                </div>
                <div className="rounded-lg border border-slate-800 p-3 md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Common mistakes to avoid</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">{asRows(toStringArray(question.commonMistakes))}</ul>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    )
  }
  const goToQuestion = (direction: 'previous' | 'next') => {
    setCurrentQuestionIndex((current) => {
      if (filteredQuestions.length === 0) return 0
      if (direction === 'previous') return Math.max(0, current - 1)
      return Math.min(filteredQuestions.length - 1, current + 1)
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Interview Preparation" subtitle="Personalized technical, HR, resume, weak-topic, and role-based preparation coach." />
      <Card className="space-y-3">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Target role" />
          <AppSelect
            value={difficulty}
            onChange={setDifficulty}
            options={asSelectOptions(['Beginner', 'Intermediate', 'Advanced'])}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
          />
          <AppSelect
            value={companyType}
            onChange={setCompanyType}
            options={asSelectOptions([
              { value: 'campus placement', label: 'Campus placement' },
              { value: 'service company', label: 'Service company' },
              { value: 'product company', label: 'Product company' },
              { value: 'startup', label: 'Startup' },
            ])}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
          />
          <button onClick={generate} disabled={loading} className="app-primary-button rounded-lg px-4 py-2 font-semibold disabled:opacity-60">{loading ? 'Building Plan...' : 'Build Prep Plan'}</button>
        </div>
        <textarea value={jobDescriptionText} onChange={(event) => setJobDescriptionText(event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Paste selected job description or responsibilities here for job-specific questions..." />
        <p className="text-sm text-slate-400">Using latest resume: {latest(resumes)?.fileName ?? 'Upload a resume first for stronger personalization'}. Active field: {profile.confirmedDomainLabel || profile.activeDomainLabel}. Latest skill gap report is used automatically when available.</p>
        {error ? <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
      </Card>

      {plan ? (
        <>
          <Card className="grid gap-4 md:grid-cols-5">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Target role</p><p className="mt-1 text-sm font-semibold text-slate-100">{String(plan.role ?? role)}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Readiness</p><p className="mt-1 text-2xl font-semibold text-white">{readinessScore}%</p><p className="text-xs text-cyan-300">{String(readiness.level ?? 'Building')}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Questions</p><p className="mt-1 text-2xl font-semibold text-white">{questions.length}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Top weak topic</p><p className="mt-1 text-sm font-semibold text-amber-200">{topWeakTopic}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Practiced / Saved</p><p className="mt-1 text-sm font-semibold text-emerald-300">{practicedCount} practiced, {bookmarkedCount} saved</p></div>
          </Card>

          <Card className="space-y-3">
            <h3 className="font-semibold">Coach Summary</h3>
            <p className="text-sm text-slate-400">{String(readiness.message ?? 'Start with project questions, then weak topics, then role-specific questions.')}</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Resume projects</p><p className="mt-1 text-sm text-slate-200">{textList(toStringArray(contextSummary.topProjects).slice(0, 3))}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Strong skills</p><p className="mt-1 text-sm text-slate-200">{textList(toStringArray(contextSummary.strongSkills).slice(0, 8))}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Job skills</p><p className="mt-1 text-sm text-slate-200">{textList(toStringArray(contextSummary.jobSkills).slice(0, 8))}</p></div>
            </div>
          </Card>

          <Card className="space-y-3">
            <h3 className="font-semibold">Top 5 Recommended Questions</h3>
            <div className="grid gap-3">
              {((plan.topRecommended ?? questions.slice(0, 5)) as ApiRecord[]).map((question) => (
                <div key={String(question.id ?? question.questionText)}>{renderQuestionCard(question, true)}</div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="space-y-3 lg:col-span-2">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button key={category} type="button" onClick={() => { setActiveTab(category); setCurrentQuestionIndex(0) }} className={`rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === category ? 'app-primary-button' : 'border border-slate-700 text-slate-200'}`}>{category}</button>
                ))}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <AppSelect
                  value={difficultyFilter}
                  onChange={(value) => { setDifficultyFilter(value); setCurrentQuestionIndex(0) }}
                  options={difficultyOptions.map((item) => ({ value: item, label: item }))}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                />
                <AppSelect
                  value={topicFilter}
                  onChange={(value) => { setTopicFilter(value); setCurrentQuestionIndex(0) }}
                  options={topicOptions.map((item) => ({ value: item, label: item }))}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                />
              </div>
              <div className="space-y-3">
                {currentQuestion ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Question Navigator</p>
                        <p className="mt-1 text-sm text-slate-300">Question {currentQuestionIndex + 1} of {filteredQuestions.length}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => goToQuestion('previous')} disabled={currentQuestionIndex === 0} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 disabled:opacity-50">Previous</button>
                        <button type="button" onClick={() => goToQuestion('next')} disabled={currentQuestionIndex >= filteredQuestions.length - 1} className="app-primary-button rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
                      </div>
                    </div>
                    <div key={String(currentQuestion.id ?? currentQuestion.questionText)}>{renderQuestionCard(currentQuestion)}</div>
                  </>
                ) : (
                  <p className="text-sm text-slate-500">No questions match these filters yet.</p>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="space-y-3">
                <h3 className="font-semibold">Progress</h3>
                <ProgressBar label="Practice completion" value={questions.length ? Math.round((practicedCount / questions.length) * 100) : 0} />
                <p className="text-sm text-slate-400">Weak topics not practiced: {textList(weakTopics.filter((topic) => !questions.some((question) => practiced[String(question.id)] && String(question.topic).toLowerCase() === topic.toLowerCase())))}</p>
              </Card>
              <Card className="space-y-3">
                <h3 className="font-semibold">Daily Practice</h3>
                <div className="space-y-2">
                  {dailyPractice.map((question) => (
                    <label key={String(question.id ?? question.questionText)} className="flex gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={Boolean(practiced[String(question.id)])} onChange={() => toggle(setPracticed, String(question.id))} />
                      <span>{String(question.questionText)}</span>
                    </label>
                  ))}
                </div>
              </Card>
              <Card className="space-y-3">
                <h3 className="font-semibold">Quick Revision</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(quickRevision)}</ul>
              </Card>
              <Card className="space-y-3">
                <h3 className="font-semibold">Common Mistakes</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200">{asRows(commonMistakes)}</ul>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <Card>
          <h3 className="font-semibold">Your coach is ready to build a personal plan</h3>
          <p className="mt-2 text-sm text-slate-400">Add a target role, choose the interview pattern, paste a job description if you have one, then build the prep plan. The system will combine your resume, profile, latest skill gap report, question bank, and target role.</p>
        </Card>
      )}
      </div>
  )
}

export const MockInterviewPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { reports, refresh } = useReports()
  const { resumes } = useResumes()
  const { pageState, setPageState } = useResumeSession()
  const launchState = (location.state ?? {}) as {
    assignmentId?: string
    applicationId?: string
    recruiterId?: string
    jobId?: string
    role?: string
    selectedDomain?: DomainKey
    difficulty?: string
    interviewType?: string
    questionCount?: number
    timerPerQuestionSec?: number
    deadline?: string
  }
  const isAssignedAssessment = Boolean(launchState.assignmentId)
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [history, setHistory] = useState<ApiRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const activeResume = latest(resumes)
  const activeResumeId = getId(activeResume ?? {})
  const pageKey = `mock-interview:${activeResumeId || 'no-resume'}`
  const cachedPage = pageState[pageKey] ?? {}
  const [historyPage, setHistoryPage] = useState(Number(cachedPage.historyPage ?? 1))
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>((String(cachedPage.selectedDomain ?? launchState.selectedDomain ?? 'general_fresher') as DomainKey))
  const [role, setRole] = useState(String(cachedPage.role ?? launchState.role ?? ''))
  const [interviewType, setInterviewType] = useState(String(cachedPage.interviewType ?? launchState.interviewType ?? 'mixed'))
  const [sessionMode, setSessionMode] = useState(String(cachedPage.sessionMode ?? 'quick_practice'))
  const [difficulty, setDifficulty] = useState(String(cachedPage.difficulty ?? launchState.difficulty ?? 'Intermediate'))
  const [questionCount, setQuestionCount] = useState(Number(cachedPage.questionCount ?? launchState.questionCount ?? 6))
  const [timerEnabled, setTimerEnabled] = useState(Boolean(cachedPage.timerEnabled ?? Boolean(launchState.timerPerQuestionSec)))
  const [timerPerQuestionSec, setTimerPerQuestionSec] = useState(Number(cachedPage.timerPerQuestionSec ?? launchState.timerPerQuestionSec ?? 90))
  const [jobDescriptionText, setJobDescriptionText] = useState(String(cachedPage.jobDescriptionText ?? ''))
  const [session, setSession] = useState<ApiRecord | null>((cachedPage.session as ApiRecord | null | undefined) ?? null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(Number(cachedPage.currentQuestionIndex ?? 0))
  const [answer, setAnswer] = useState(String(cachedPage.answer ?? ''))
  const [answerEvaluations, setAnswerEvaluations] = useState<Record<string, ApiRecord>>((cachedPage.answerEvaluations as Record<string, ApiRecord> | undefined) ?? {})
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, string>>((cachedPage.submittedAnswers as Record<string, string> | undefined) ?? {})
  const [lastEvaluation, setLastEvaluation] = useState<ApiRecord | null>((cachedPage.lastEvaluation as ApiRecord | null | undefined) ?? null)
  const [finalEvaluation, setFinalEvaluation] = useState<ApiRecord | null>((cachedPage.finalEvaluation as ApiRecord | null | undefined) ?? null)
  const [recommendedNextSteps, setRecommendedNextSteps] = useState<string[]>((cachedPage.recommendedNextSteps as string[] | undefined) ?? [])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState(String(cachedPage.error ?? ''))
  const [codingAvailability, setCodingAvailability] = useState<ApiRecord | null>((cachedPage.codingAvailability as ApiRecord | null | undefined) ?? null)
  const [isRecordingVoice, setIsRecordingVoice] = useState(Boolean(cachedPage.isRecordingVoice ?? false))
  const [isVoicePaused, setIsVoicePaused] = useState(Boolean(cachedPage.isVoicePaused ?? false))
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(String(cachedPage.voicePreviewUrl ?? ''))
  const questionStartedAtRef = useRef(Date.now())
  const canUseVoice = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  const canRecordAudio = typeof window !== 'undefined' && typeof navigator !== 'undefined' && typeof window.MediaRecorder !== 'undefined'
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const voiceChunksRef = useRef<Blob[]>([])
  const isRecordingVoiceRef = useRef(false)
  const isVoicePausedRef = useRef(false)

  const skillGapReport = contentOf(reports.find((item) => item.type === 'Skill Gap'))
  const prepPlan = contentOf(reports.find((item) => item.type === 'Interview Preparation'))
  const lastMockReport = contentOf(reports.find((item) => item.type === 'Mock Interview'))
  const weakTopics = unique([
    ...toStringArray(skillGapReport.missingSkills),
    ...toStringArray((skillGapReport.gaps as Array<ApiRecord> | undefined)?.map((gap) => String(gap.skill ?? ''))),
    ...toStringArray(prepPlan.weakTopicsNotPracticed),
    ...toStringArray(prepPlan.contextSummary?.weakSkills),
  ]).slice(0, 6)
  const readinessScore = Number(prepPlan.readiness?.score ?? skillGapReport.readinessScore ?? lastMockReport.overallScore ?? 0)
  const lastScore = Number(lastMockReport.score ?? lastMockReport.overallScore ?? 0)
  const currentQuestions = ((session?.questionItems ?? []) as ApiRecord[])
  const currentQuestion = currentQuestions[currentQuestionIndex] ?? null
  const currentQuestionId = String(currentQuestion?.id ?? '')
  const currentAnswerSaved = submittedAnswers[currentQuestionId]
  const isCurrentAnswered = Boolean(answerEvaluations[currentQuestionId])
  const answeredCount = Object.keys(answerEvaluations).length
  const topWeakTopic = weakTopics[0] ?? String(prepPlan.readiness?.topWeakTopic ?? 'Interview fundamentals')

  useEffect(() => {
    void studentApi.getProfile().then((savedProfile) => {
      const nextProfile = normalizeStudentProfile(savedProfile)
      setProfile(nextProfile)
      setSelectedDomain((current) => current || nextProfile.activeDomain)
      setRole((current) => current || nextProfile.preferredJobRole || '')
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    setSelectedDomain((cachedPage.selectedDomain as DomainKey | undefined) ?? profile.activeDomain)
    setRole(String(cachedPage.role ?? profile.preferredJobRole ?? ''))
  }, [activeResumeId])

  useEffect(() => {
    setPageState(pageKey, {
      selectedDomain,
      role,
      interviewType,
      sessionMode,
      difficulty,
      questionCount,
      timerEnabled,
      timerPerQuestionSec,
      jobDescriptionText,
      session,
      currentQuestionIndex,
      answer,
      answerEvaluations,
      submittedAnswers,
      lastEvaluation,
      finalEvaluation,
      recommendedNextSteps,
      historyPage,
      codingAvailability,
      isRecordingVoice,
      isVoicePaused,
      voicePreviewUrl,
      error,
    })
  }, [selectedDomain, role, interviewType, sessionMode, difficulty, questionCount, timerEnabled, timerPerQuestionSec, jobDescriptionText, session, currentQuestionIndex, answer, answerEvaluations, submittedAnswers, lastEvaluation, finalEvaluation, recommendedNextSteps, historyPage, codingAvailability, isRecordingVoice, isVoicePaused, voicePreviewUrl, error, pageKey])

  useEffect(() => {
    setHistoryLoading(true)
    void studentApi.listMockInterviewSessions()
      .then((sessions) => setHistory(sessions))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [])

  useEffect(() => {
    if (isAssignedAssessment) return
    if (!role.trim()) {
      setCodingAvailability(null)
      return
    }
    void studentApi.getCodingTestAvailability({ domain: selectedDomain, role })
      .then((availability) => setCodingAvailability(availability))
      .catch(() => setCodingAvailability({
        available: roleNeedsCoding(selectedDomain, role),
        reason: 'Coding test visibility is based on coding relevance for the selected role.',
        supportedLanguages: codingLanguageOptions.map((item) => item.key),
      }))
  }, [isAssignedAssessment, selectedDomain, role])

  useEffect(() => {
    questionStartedAtRef.current = Date.now()
    if (isRecordingVoiceRef.current) {
      stopVoiceRecording()
    }
    if (voicePreviewUrl) {
      URL.revokeObjectURL(voicePreviewUrl)
      setVoicePreviewUrl('')
    }
    if (currentQuestionId && !currentAnswerSaved) {
      setAnswer('')
      setLastEvaluation(null)
    } else if (currentQuestionId) {
      setAnswer(currentAnswerSaved ?? '')
      setLastEvaluation(answerEvaluations[currentQuestionId] ?? null)
    }
  }, [currentQuestionId])

  useEffect(() => {
    isRecordingVoiceRef.current = isRecordingVoice
  }, [isRecordingVoice])

  useEffect(() => {
    isVoicePausedRef.current = isVoicePaused
  }, [isVoicePaused])

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onend = null
        speechRecognitionRef.current.stop()
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl)
      }
    }
  }, [voicePreviewUrl])

  const stopSpeechRecognition = () => {
    if (!speechRecognitionRef.current) return
    speechRecognitionRef.current.onend = null
    speechRecognitionRef.current.stop()
    speechRecognitionRef.current = null
  }

  const stopMediaStream = () => {
    if (!mediaStreamRef.current) return
    mediaStreamRef.current.getTracks().forEach((track) => track.stop())
    mediaStreamRef.current = null
  }

  const startVoice = async () => {
    if (!canRecordAudio || !canUseVoice || isCurrentAnswered || finalEvaluation) return
    setError('')
    try {
      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl)
        setVoicePreviewUrl('')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      voiceChunksRef.current = []

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceChunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        if (voicePreviewUrl) {
          URL.revokeObjectURL(voicePreviewUrl)
        }
        const audioBlob = voiceChunksRef.current.length ? new Blob(voiceChunksRef.current, { type: recorder.mimeType || 'audio/webm' }) : null
        setVoicePreviewUrl(audioBlob ? URL.createObjectURL(audioBlob) : '')
        stopMediaStream()
      }
      recorder.start()

      const speechWindow = window as SpeechWindow
      const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
      if (!SpeechRecognition) {
        throw new Error('Speech recognition is not supported in this browser.')
      }
      const recognition = new SpeechRecognition()
      speechRecognitionRef.current = recognition
      recognition.lang = 'en-US'
      recognition.continuous = true
      recognition.interimResults = false
      recognition.onresult = (event) => {
        const lastResult = event.results[event.results.length - 1]
        const nextTranscript = lastResult?.[0]?.transcript?.trim() ?? ''
        if (nextTranscript) {
          setAnswer((current) => `${current}${current ? ' ' : ''}${nextTranscript}`.trim())
        }
      }
      recognition.onend = () => {
        if (isRecordingVoiceRef.current && !isVoicePausedRef.current) {
          try {
            recognition.start()
          } catch {
            return
          }
        }
      }
      recognition.start()

      isRecordingVoiceRef.current = true
      isVoicePausedRef.current = false
      setIsRecordingVoice(true)
      setIsVoicePaused(false)
    } catch (err) {
      stopSpeechRecognition()
      stopMediaStream()
      setError(err instanceof Error ? err.message : 'Unable to start voice recording.')
    }
  }

  const pauseVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
    }
    stopSpeechRecognition()
    isVoicePausedRef.current = true
    setIsVoicePaused(true)
  }

  const resumeVoiceRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
    }
    const speechWindow = window as SpeechWindow
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    speechRecognitionRef.current = recognition
    recognition.lang = 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1]
      const nextTranscript = lastResult?.[0]?.transcript?.trim() ?? ''
      if (nextTranscript) {
        setAnswer((current) => `${current}${current ? ' ' : ''}${nextTranscript}`.trim())
      }
    }
    recognition.onend = () => {
      if (isRecordingVoiceRef.current && !isVoicePausedRef.current) {
        try {
          recognition.start()
        } catch {
          return
        }
      }
    }
    recognition.start()
    isVoicePausedRef.current = false
    setIsVoicePaused(false)
  }

  const stopVoiceRecording = () => {
    stopSpeechRecognition()
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    } else {
      stopMediaStream()
    }
    isRecordingVoiceRef.current = false
    isVoicePausedRef.current = false
    setIsRecordingVoice(false)
    setIsVoicePaused(false)
  }

  const speakQuestion = () => {
    if (!currentQuestion || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(String(currentQuestion.questionText ?? '')))
  }

  const refreshHistoryAndReports = async () => {
    const [sessions] = await Promise.all([
      studentApi.listMockInterviewSessions().catch(() => []),
      refresh().catch(() => undefined),
    ])
    setHistory(Array.isArray(sessions) ? sessions : [])
  }

  const startSession = async () => {
    setLoading(true)
    setError('')
    try {
      const started = await studentApi.startMockInterviewSession({
        role: role || profile.preferredJobRole,
        selectedDomain,
        difficulty,
        interviewType,
        sessionMode,
        questionCount,
        timerEnabled,
        timerPerQuestionSec,
        resumeId: activeResumeId || undefined,
        jobDescriptionText,
        assignmentId: launchState.assignmentId,
        applicationId: launchState.applicationId,
        recruiterId: launchState.recruiterId,
        jobId: launchState.jobId,
      })
      setSession((started.session as ApiRecord | undefined) ?? null)
      setCurrentQuestionIndex(0)
      setAnswer('')
      setAnswerEvaluations({})
      setSubmittedAnswers({})
      setLastEvaluation(null)
      setFinalEvaluation(null)
      setRecommendedNextSteps([])
      questionStartedAtRef.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start the mock interview.')
    } finally {
      setLoading(false)
    }
  }

  const submitCurrentAnswer = async (skipped = false) => {
    if (!session?._id || !currentQuestion) return
    if (!skipped && !answer.trim()) {
      setError('Please answer the question or use Skip.')
      return
    }
    if (isRecordingVoiceRef.current) {
      stopVoiceRecording()
    }
    setSubmitting(true)
    setError('')
    try {
      const elapsed = Math.max(1, Math.round((Date.now() - questionStartedAtRef.current) / 1000))
      const response = await studentApi.submitMockInterviewAnswer(String(session._id), {
        questionId: String(currentQuestion.id ?? ''),
        answer: skipped ? '' : answer.trim(),
        responseTimeSec: elapsed,
        skipped,
      })
      const evaluation = (response.answerEvaluation as ApiRecord | undefined) ?? {}
      setSubmittedAnswers((current) => ({ ...current, [currentQuestionId]: skipped ? '' : answer.trim() }))
      setAnswerEvaluations((current) => ({ ...current, [currentQuestionId]: evaluation }))
      setLastEvaluation(evaluation)
      setSession((current) => current ? {
        ...current,
        currentQuestionIndex: Math.min(currentQuestionIndex + 1, currentQuestions.length - 1),
      } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to evaluate the answer.')
    } finally {
      setSubmitting(false)
    }
  }

  const moveToNextQuestion = async () => {
    if (Boolean(finalEvaluation) || currentQuestionIndex >= currentQuestions.length - 1) return
    if (!isCurrentAnswered) {
      await submitCurrentAnswer(true)
    }
    setCurrentQuestionIndex((current) => Math.min(current + 1, Math.max(currentQuestions.length - 1, 0)))
  }

  const finishSession = async () => {
    if (!session?._id) return
    if (isRecordingVoiceRef.current) {
      stopVoiceRecording()
    }
    setCompleting(true)
    setError('')
    try {
      const completed = await studentApi.completeMockInterviewSession(String(session._id))
      setFinalEvaluation((completed.evaluation as ApiRecord | undefined) ?? null)
      setRecommendedNextSteps(toStringArray(completed.recommendedNextSteps))
      await refreshHistoryAndReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete the session.')
    } finally {
      setCompleting(false)
    }
  }

  const openHistorySession = async (sessionId: string) => {
    if (isRecordingVoiceRef.current) {
      stopVoiceRecording()
    }
    setLoading(true)
    setError('')
    try {
      const savedSession = await studentApi.getMockInterviewSession(sessionId)
      setSession(savedSession)
      setCurrentQuestionIndex(0)
      const answerItems = ((savedSession.answerItems ?? []) as ApiRecord[])
      setSubmittedAnswers(answerItems.reduce<Record<string, string>>((acc, item) => {
        acc[String(item.questionId ?? '')] = String(item.answer ?? '')
        return acc
      }, {}))
      setAnswerEvaluations(answerItems.reduce<Record<string, ApiRecord>>((acc, item) => {
        acc[String(item.questionId ?? '')] = (item.feedback as ApiRecord | undefined) ?? {}
        return acc
      }, {}))
      setFinalEvaluation((savedSession.evaluation as ApiRecord | undefined) ?? null)
      setRecommendedNextSteps(toStringArray(savedSession.recommendedNextSteps))
      setLastEvaluation(null)
      setAnswer('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to open this session.')
    } finally {
      setLoading(false)
    }
  }

  const domainOption = domainOptions.find((item) => item.key === selectedDomain) ?? domainOptions[domainOptions.length - 1]
  const recommendedRoles = {
    it_software: ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'QA Tester'],
    data_analytics: ['Data Analyst', 'Reporting Analyst', 'BI Analyst', 'Junior Analyst'],
    commerce_finance: ['Accounts Executive', 'Finance Analyst', 'Tax Assistant', 'Banking Trainee'],
    mechanical: ['Production Engineer', 'Maintenance Engineer', 'Design Engineer', 'Quality Engineer'],
    marketing: ['Digital Marketing Intern', 'SEO Executive', 'Brand Assistant', 'Content Marketing Assistant'],
    general_fresher: ['Graduate Trainee', 'Operations Trainee', 'Management Trainee', 'Support Associate'],
  } as Record<string, string[]>
  const roleSuggestions = recommendedRoles[selectedDomain] ?? recommendedRoles.general_fresher
  const codingRoundSelected = interviewType === 'coding_round'
  const historyPageSize = 5
  const totalHistoryPages = Math.max(1, Math.ceil(history.length / historyPageSize))
  const safeHistoryPage = Math.min(historyPage, totalHistoryPages)
  const pagedHistory = history.slice((safeHistoryPage - 1) * historyPageSize, safeHistoryPage * historyPageSize)

  useEffect(() => {
    setHistoryPage((current) => Math.min(Math.max(1, current), totalHistoryPages))
  }, [totalHistoryPages])

  const startSelectedRound = async () => {
    if (isAssignedAssessment) {
      await startSession()
      return
    }
    if (codingRoundSelected) {
      if (!codingAvailability?.available) {
        setError('Coding round is not available for this selected field or role.')
        return
      }
      navigate('/student/mock-interview/coding-test', { state: { domain: selectedDomain, role, difficulty } })
      return
    }
    await startSession()
  }

  return (
    <div className="space-y-5">
      <PageHeader title={isAssignedAssessment ? 'Recruiter Assigned Interview' : 'Mock Interview'} subtitle={isAssignedAssessment ? 'Locked assessment mode. Only answer and final submission actions are available.' : 'Run realistic, domain-aware interview sessions using your field, role, resume, weak topics, and preparation progress.'} />
      {isAssignedAssessment ? (
        <Card className="border border-cyan-400/30 bg-cyan-500/5">
          <p className="text-sm font-semibold text-cyan-200">Recruiter-assigned interview round</p>
          <p className="mt-1 text-sm text-slate-300">This interview is linked to a live job application. Complete it here and the recruiter will receive the result automatically{launchState.deadline ? ` before ${new Date(launchState.deadline).toLocaleString()}` : ''}.</p>
        </Card>
      ) : null}

      <Card className={`grid gap-4 ${isAssignedAssessment ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Selected field</p><p className="mt-1 text-sm font-semibold text-slate-100">{domainOption.label}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Target role</p><p className="mt-1 text-sm font-semibold text-slate-100">{role || profile.preferredJobRole || 'Choose a role'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">{isAssignedAssessment ? 'Round type' : 'Readiness'}</p><p className="mt-1 text-2xl font-semibold text-white">{isAssignedAssessment ? toTitleCase(String(interviewType).replace(/_/g, ' ')) : (readinessScore ? `${readinessScore}%` : 'Pending')}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">{isAssignedAssessment ? 'Difficulty' : 'Last score'}</p><p className="mt-1 text-2xl font-semibold text-cyan-300">{isAssignedAssessment ? difficulty : (lastScore ? `${lastScore}%` : 'No session yet')}</p></div>
        {!isAssignedAssessment ? <div><p className="text-xs uppercase tracking-wide text-slate-400">Top weak topic</p><p className="mt-1 text-sm font-semibold text-amber-200">{topWeakTopic}</p></div> : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.1fr,1.9fr]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <h3 className="font-semibold">{isAssignedAssessment ? 'Assessment Instructions' : 'Interview Setup'}</h3>
            <div className="grid gap-3">
              {!isAssignedAssessment ? <AppSelect
                value={selectedDomain}
                onChange={(value) => setSelectedDomain(value as DomainKey)}
                options={domainOptions
                  .filter((item) => ['it_software', 'data_analytics', 'commerce_finance', 'mechanical', 'marketing', 'general_fresher'].includes(item.key))
                  .map((item) => ({ value: item.key, label: item.label }))}
                className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
              /> : <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 px-4 py-3 text-sm text-slate-200">This recruiter interview runs in locked assessment mode. You cannot change the field, role, difficulty, or question count.</div>}
              {!isAssignedAssessment ? <SuggestionInput value={role} onChange={setRole} placeholder="Target role" suggestions={roleSuggestions} /> : null}
              {!isAssignedAssessment ? <AppSelect
                value={interviewType}
                onChange={setInterviewType}
                options={[
                  { value: 'mixed', label: 'Mixed interview' },
                  { value: 'technical', label: 'Technical interview' },
                  { value: 'hr', label: 'HR interview' },
                  { value: 'role_based', label: 'Role-based interview' },
                  { value: 'resume_based', label: 'Resume-based interview' },
                  ...(codingAvailability?.available ? [{ value: 'coding_round', label: 'Coding round' }] : []),
                ]}
                className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
              /> : null}
              {isAssignedAssessment ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">Questions: {questionCount}</div>
                  <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">Timer: {timerEnabled ? `${timerPerQuestionSec}s per question` : 'Not timed'}</div>
                </div>
              ) : !codingRoundSelected ? (
                <>
                  <AppSelect
                    value={sessionMode}
                    onChange={setSessionMode}
                    options={asSelectOptions([
                      { value: 'quick_practice', label: 'Quick Practice' },
                      { value: 'full_mock', label: 'Full Mock Interview' },
                      { value: 'weak_topic_practice', label: 'Weak Topic Practice' },
                      { value: 'resume_defense', label: 'Resume Defense Mode' },
                      { value: 'hr_round', label: 'HR Round' },
                    ])}
                    className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <AppSelect
                      value={difficulty}
                      onChange={setDifficulty}
                      options={asSelectOptions(['Beginner', 'Intermediate', 'Advanced'])}
                      className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                    />
                    <AppSelect
                      value={String(questionCount)}
                      onChange={(value) => setQuestionCount(Number(value))}
                      options={[5, 6, 7, 10, 12, 15].map((count) => ({ value: String(count), label: `${count} questions` }))}
                      className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <AppSelect
                    value={difficulty}
                    onChange={setDifficulty}
                    options={asSelectOptions(['Beginner', 'Intermediate', 'Advanced'])}
                    className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                  />
                  <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 px-3 py-2 text-sm text-slate-300">
                    {codingAvailability?.available
                      ? `Coding round is available for ${role || 'this role'}.`
                      : 'Coding round is available only for coding-related roles.'}
                  </div>
                </div>
              )}
              {!isAssignedAssessment ? <InlineSwitch
                label="Enable timer"
                helper="Turn timed practice on or off for each question."
                checked={timerEnabled}
                onChange={setTimerEnabled}
              /> : null}
              {!isAssignedAssessment && timerEnabled ? (
                <input type="number" min={30} max={300} step={15} value={timerPerQuestionSec} onChange={(event) => setTimerPerQuestionSec(Number(event.target.value))} className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Seconds per question" />
              ) : null}
              {!isAssignedAssessment ? <textarea value={jobDescriptionText} onChange={(event) => setJobDescriptionText(event.target.value)} className="min-h-28 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Optional: paste a job description to make the interview more role-specific." /> : null}
              <button onClick={() => void startSelectedRound()} disabled={loading || !role.trim()} className="app-primary-button rounded-lg px-4 py-3 font-semibold disabled:opacity-60">
                {loading ? 'Starting...' : isAssignedAssessment ? 'Start Assigned Interview' : codingRoundSelected ? 'Start Coding Round' : 'Start Mock Interview'}
              </button>
            </div>
            <p className="text-xs text-slate-500">{isAssignedAssessment ? 'Only answering and final submission are allowed in this assessment.' : 'Using confirmed field, latest resume, profile, skill gap report, and interview preparation history when available.'}</p>
          </Card>

          {!isAssignedAssessment ? <Card className="space-y-3">
            <h3 className="font-semibold">Readiness Summary</h3>
            <p className="text-sm text-slate-400">{String(prepPlan.readiness?.message ?? 'This mock session will adapt to your current profile, role, and weak areas.')}</p>
            <div className="grid gap-3">
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Strong areas</p><p className="mt-1 text-sm text-emerald-300">{textList(toStringArray(prepPlan.contextSummary?.strongSkills).slice(0, 6) || profile.skills.slice(0, 6))}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Weak topics to focus on</p><p className="mt-1 text-sm text-amber-300">{textList(weakTopics)}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Resume context</p><p className="mt-1 text-sm text-slate-300">{textList((toStringArray(prepPlan.contextSummary?.topProjects).slice(0, 3)).length ? toStringArray(prepPlan.contextSummary?.topProjects).slice(0, 3) : profile.projects.slice(0, 3))}</p></div>
            </div>
          </Card> : null}

        </div>

        <div className="space-y-4">
          {!session ? (
            <Card className="space-y-3">
              <h3 className="font-semibold">{isAssignedAssessment ? 'Assigned Assessment Ready' : 'Test Selection'}</h3>
              <p className="text-sm text-slate-400">{isAssignedAssessment ? 'Start the recruiter-assigned interview to begin the locked question flow.' : 'Choose a field, role, and round type. Domain-aware interview rounds stay here, and coding-related roles can launch a separate Coding Round.'}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 p-4">
                  <p className="text-xs uppercase tracking-wide text-cyan-300">Quick Practice</p>
                  <p className="mt-2 text-sm text-slate-400">5 to 7 focused questions for one topic, one role, or one round.</p>
                </div>
                <div className="rounded-xl border border-slate-800 p-4">
                  <p className="text-xs uppercase tracking-wide text-fuchsia-300">Full Mock</p>
                  <p className="mt-2 text-sm text-slate-400">10 to 15 realistic questions combining technical, HR, and resume depth.</p>
                </div>
                {!isAssignedAssessment && codingAvailability?.available ? (
                  <div className="rounded-xl border border-cyan-400/25 bg-cyan-500/5 p-4 md:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-cyan-300">Coding Round</p>
                    <p className="mt-2 text-sm text-slate-300">For coding-related roles, choose `Coding round` above and click `Start Coding Round` to open the dedicated coding test page.</p>
                    <p className="mt-2 text-xs text-slate-500">Supported languages: {textList(toStringArray(codingAvailability.supportedLanguages))}</p>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : (
            <>
              <Card className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-cyan-300">{String(session.contextSummary?.domainLabel ?? domainOption.label)} | {String(session.interviewType ?? interviewType).replace(/_/g, ' ')}</p>
                    <h3 className="text-lg font-semibold text-slate-100">{String(session.targetRole ?? role)}</h3>
                    <p className="text-sm text-slate-400">Question {Math.min(currentQuestionIndex + 1, Math.max(currentQuestions.length, 1))} of {currentQuestions.length} | {String(session.difficulty ?? difficulty)}</p>
                  </div>
                  <div className="min-w-48">
                    <ProgressBar label="Session progress" value={currentQuestions.length ? Math.round((answeredCount / currentQuestions.length) * 100) : 0} />
                  </div>
                </div>

                {currentQuestion ? (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
                      <div className="mb-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-cyan-400/40 px-2 py-1 text-cyan-200">{String(currentQuestion.category ?? 'Question')}</span>
                        <span className="rounded-full border border-slate-700 px-2 py-1 text-slate-300">{String(currentQuestion.topic ?? 'Topic')}</span>
                        {timerEnabled ? <span className="rounded-full border border-amber-400/40 px-2 py-1 text-amber-200">{timerPerQuestionSec}s pacing</span> : null}
                      </div>
                      <h4 className="text-xl font-semibold text-white">{String(currentQuestion.questionText ?? '')}</h4>
                      <p className="mt-3 text-sm text-slate-400">{String(currentQuestion.whyRecommended ?? 'Selected from your profile, role, and weak topics.')}</p>
                    </div>

                    <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} disabled={isCurrentAnswered || Boolean(finalEvaluation)} className="min-h-40 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 disabled:opacity-60" placeholder={isAssignedAssessment ? 'Type your assessment answer here.' : 'Type your answer here. Focus on clarity, role relevance, and one practical example.'} />

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => void submitCurrentAnswer(false)} disabled={submitting || isCurrentAnswered || Boolean(finalEvaluation)} className="app-primary-button rounded-lg px-4 py-2 font-semibold disabled:opacity-60">{submitting ? (isAssignedAssessment ? 'Saving...' : 'Evaluating...') : 'Submit Answer'}</button>
                      {!isAssignedAssessment ? <button onClick={() => void submitCurrentAnswer(true)} disabled={submitting || isCurrentAnswered || Boolean(finalEvaluation)} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-60">Skip Question</button> : null}
                      <button onClick={() => void startVoice()} disabled={!canUseVoice || !canRecordAudio || isCurrentAnswered || Boolean(finalEvaluation) || isRecordingVoice} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Start Voice</button>
                      <button onClick={pauseVoiceRecording} disabled={!isRecordingVoice || isVoicePaused || isCurrentAnswered || Boolean(finalEvaluation)} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Pause</button>
                      <button onClick={resumeVoiceRecording} disabled={!isRecordingVoice || !isVoicePaused || isCurrentAnswered || Boolean(finalEvaluation)} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Resume</button>
                      <button onClick={stopVoiceRecording} disabled={!isRecordingVoice} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Stop Voice</button>
                      {!isAssignedAssessment ? <button onClick={speakQuestion} className="rounded-lg border border-slate-600 px-4 py-2">Read Question</button> : null}
                      <button onClick={() => void moveToNextQuestion()} disabled={submitting || currentQuestionIndex >= currentQuestions.length - 1 || Boolean(finalEvaluation)} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">Next Question</button>
                      <button onClick={() => { if (!window.confirm(isAssignedAssessment ? 'Submit this recruiter-assigned interview? You cannot edit it after final submission.' : 'Finish this interview session?')) return; void finishSession() }} disabled={completing} className="rounded-lg border border-rose-400/45 px-4 py-2 text-rose-100 disabled:opacity-50">{completing ? 'Submitting...' : isAssignedAssessment ? 'Final Submit' : 'End Interview'}</button>
                    </div>

                    {(isRecordingVoice || voicePreviewUrl) ? (
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Voice recorder</p>
                            <p className="mt-1 text-sm text-slate-300">
                              {isRecordingVoice ? (isVoicePaused ? 'Recording paused. Resume when you are ready.' : 'Recording and writing your answer live.') : 'Voice recording saved. You can play it before submitting.'}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isRecordingVoice ? (isVoicePaused ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200') : 'bg-slate-800 text-slate-300'}`}>
                            {isRecordingVoice ? (isVoicePaused ? 'Paused' : 'Recording') : 'Ready'}
                          </span>
                        </div>
                        {voicePreviewUrl ? <audio controls className="mt-3 w-full" src={voicePreviewUrl} /> : null}
                      </div>
                    ) : null}

                    {!isAssignedAssessment && lastEvaluation ? (
                      <Card className="space-y-3 border border-emerald-400/20 bg-emerald-400/5">
                        <h4 className="font-semibold">Answer Feedback</h4>
                        <div className="grid gap-3 md:grid-cols-2">
                          <ProgressBar label="Score" value={Number(lastEvaluation.score ?? 0)} />
                          <ProgressBar label="Confidence" value={Number(lastEvaluation.confidence ?? 0)} />
                          <ProgressBar label="Clarity" value={Number(lastEvaluation.clarity ?? 0)} />
                          <ProgressBar label="Technical Accuracy" value={Number(lastEvaluation.technicalAccuracy ?? 0)} />
                        </div>
                        <p className="text-sm text-slate-300">{String(lastEvaluation.feedback ?? '')}</p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-emerald-300">What was good</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(toStringArray(lastEvaluation.strengths))}</ul>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-amber-300">What was missing</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(toStringArray(lastEvaluation.improvements))}</ul>
                          </div>
                        </div>
                      </Card>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Start a session to begin the interview simulation.</p>
                )}
              </Card>

              {finalEvaluation ? (
                <Card className="space-y-4">
                  <h3 className="font-semibold">{isAssignedAssessment ? 'Assessment Submitted' : 'Final Feedback Report'}</h3>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div><p className="text-xs uppercase tracking-wide text-slate-400">Overall</p><p className="mt-1 text-2xl font-semibold text-white">{Number(finalEvaluation.overallScore ?? 0)}%</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-slate-400">Technical</p><p className="mt-1 text-2xl font-semibold text-cyan-300">{Number(finalEvaluation.technicalScore ?? 0)}%</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-slate-400">HR</p><p className="mt-1 text-2xl font-semibold text-fuchsia-300">{Number(finalEvaluation.hrScore ?? 0)}%</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-slate-400">Resume / Project</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{Number(finalEvaluation.resumeProjectScore ?? 0)}%</p></div>
                  </div>
                  <p className="text-sm text-slate-400">{String(finalEvaluation.summary ?? '')}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><p className="text-xs uppercase tracking-wide text-emerald-300">Strong areas</p><p className="mt-1 text-sm text-slate-300">{textList(toStringArray(finalEvaluation.strongAreas))}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-amber-300">Weak areas</p><p className="mt-1 text-sm text-slate-300">{textList(toStringArray(finalEvaluation.weakAreas))}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-cyan-300">Recommended next topics</p><p className="mt-1 text-sm text-slate-300">{textList(toStringArray(finalEvaluation.recommendedNextTopics))}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-fuchsia-300">Role readiness</p><p className="mt-1 text-sm text-slate-300">{String(finalEvaluation.roleReadiness?.band ?? 'Building')}</p></div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Recommended next steps</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(recommendedNextSteps)}</ul>
                  </div>
                </Card>
              ) : null}
            </>
          )}

          {!isAssignedAssessment ? <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Previous Mock Interview History</h3>
              {!historyLoading && history.length > 0 ? <p className="text-xs text-slate-500">Showing recent {pagedHistory.length} of {history.length}</p> : null}
            </div>
            {historyLoading ? <p className="text-sm text-slate-500">Loading history...</p> : null}
            {!historyLoading && history.length === 0 ? <p className="text-sm text-slate-500">No previous sessions yet.</p> : null}
            <div className="grid gap-3">
              {pagedHistory.map((item) => (
                <button key={String(item.id ?? item._id ?? '')} type="button" onClick={() => void openHistorySession(String(item.id ?? item._id ?? ''))} className="rounded-xl border border-slate-800 p-4 text-left transition hover:border-cyan-400/35 hover:bg-slate-950/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-cyan-300">{String(item.domain ?? '')} | {String(item.interviewType ?? '').replace(/_/g, ' ')}</p>
                      <p className="mt-1 font-semibold text-slate-100">{String(item.targetRole ?? 'Mock Interview')}</p>
                      <p className="text-xs text-slate-500">{new Date(String(item.createdAt ?? Date.now())).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-white">{Number(item.score ?? 0)}%</p>
                      <p className="text-xs text-slate-500">{String(item.status ?? 'completed')}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {!historyLoading && history.length > historyPageSize ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">Page {safeHistoryPage} of {totalHistoryPages}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} disabled={safeHistoryPage <= 1} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Previous</button>
                  <button type="button" onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))} disabled={safeHistoryPage >= totalHistoryPages} className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </Card> : null}
        </div>
      </div>

      {error ? <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
    </div>
  )
}

export const CodingTestPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { reports } = useReports()
  const initialState = (location.state ?? {}) as { domain?: DomainKey; role?: string; difficulty?: string }
  const assignmentState = (location.state ?? {}) as { assignmentId?: string; applicationId?: string; recruiterId?: string; jobId?: string; deadline?: string }
  const isAssignedCodingAssessment = Boolean(assignmentState.assignmentId)
  const pageKey = 'coding-test'
  const { pageState, setPageState } = useResumeSession()
  const cachedPage = pageState[pageKey] ?? {}
  const [selectedDomain, setSelectedDomain] = useState<DomainKey>((cachedPage.selectedDomain as DomainKey | undefined) ?? initialState.domain ?? 'it_software')
  const [role, setRole] = useState(String(cachedPage.role ?? initialState.role ?? ''))
  const [difficulty, setDifficulty] = useState(String(cachedPage.difficulty ?? initialState.difficulty ?? 'Intermediate'))
  const [language, setLanguage] = useState(String(cachedPage.language ?? 'python'))
  const [sessionData, setSessionData] = useState<ApiRecord | null>((cachedPage.sessionData as ApiRecord | null | undefined) ?? null)
  const [problemIndex, setProblemIndex] = useState(Number(cachedPage.problemIndex ?? 0))
  const [code, setCode] = useState(String(cachedPage.code ?? codingStarterTemplates.python))
  const [runResult, setRunResult] = useState<ApiRecord | null>((cachedPage.runResult as ApiRecord | null | undefined) ?? null)
  const [finalResult, setFinalResult] = useState<ApiRecord | null>((cachedPage.finalResult as ApiRecord | null | undefined) ?? null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(String(cachedPage.error ?? ''))
  const latestCodingReport = contentOf(reports.find((item) => item.type === 'Coding Test'))
  const editorInstanceRef = useRef<MonacoEditorLike | null>(null)
  const editorWheelCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    setPageState(pageKey, { selectedDomain, role, difficulty, language, sessionData, problemIndex, code, runResult, finalResult, error })
  }, [selectedDomain, role, difficulty, language, sessionData, problemIndex, code, runResult, finalResult, error])

  useEffect(() => {
    setCode((current) => {
      const template = codingStarterTemplates[language] ?? codingStarterTemplates.python
      return current && current !== codingStarterTemplates.python && current !== codingStarterTemplates.javascript && current !== codingStarterTemplates.java && current !== codingStarterTemplates.cpp
        ? current
        : template
    })
  }, [language])

  useEffect(() => {
    return () => {
      editorWheelCleanupRef.current?.()
      editorWheelCleanupRef.current = null
    }
  }, [])

  const problems = ((sessionData?.problems ?? []) as ApiRecord[])
  const currentProblem = problems[problemIndex] ?? null
  const supportedLanguages = toStringArray(currentProblem?.supportedLanguages ?? sessionData?.supportedLanguages)
  const codingVisible = roleNeedsCoding(selectedDomain, role)
  const executionConfigured = sessionData?.executionConfigured !== false
  const roleSuggestions = selectedDomain === 'data_analytics'
    ? ['Data Analyst', 'BI Analyst', 'Reporting Analyst', 'Python Data Analyst']
    : ['Software Developer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'QA Automation Engineer']

  const endCodingTest = () => {
    setSessionData(null)
    setProblemIndex(0)
    setCode(codingStarterTemplates[language] ?? codingStarterTemplates.python)
    setRunResult(null)
    setFinalResult(null)
    setError('')
    setPageState(pageKey, {})
    navigate('/student/mock-interview')
  }

  const startCodingRound = async () => {
    setLoading(true)
    setError('')
    try {
      const linkedStarted = assignmentState.assignmentId
        ? await studentApi.startCodingTestSession({
          domain: selectedDomain,
          role,
          difficulty,
          language,
          assignmentId: assignmentState.assignmentId,
          applicationId: assignmentState.applicationId,
          recruiterId: assignmentState.recruiterId,
          jobId: assignmentState.jobId,
        })
        : await studentApi.startCodingTestSession({ domain: selectedDomain, role, difficulty, language })
      setSessionData(linkedStarted)
      setProblemIndex(Number(linkedStarted.currentProblemIndex ?? 0))
      const startedSupportedLanguages = toStringArray(linkedStarted.supportedLanguages)
      const nextLanguage = startedSupportedLanguages.includes(language) ? language : (startedSupportedLanguages[0] ?? language)
      setLanguage(nextLanguage)
      setCode(codingStarterTemplates[nextLanguage] ?? codingStarterTemplates.python)
      setRunResult(null)
      setFinalResult(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start coding test.')
    } finally {
      setLoading(false)
    }
  }

  const runCode = async () => {
    if (!sessionData?.sessionId || !currentProblem) return
    setRunning(true)
    setError('')
    try {
      const result = await studentApi.runCodingTestCode(String(sessionData.sessionId), {
        problemId: String(currentProblem.id ?? ''),
        language,
        code,
        currentProblemIndex: problemIndex,
      })
      setRunResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run code.')
    } finally {
      setRunning(false)
    }
  }

  const submitCode = async () => {
    if (!sessionData?.sessionId || !currentProblem) return
    setSubmitting(true)
    setError('')
    try {
      const result = await studentApi.submitCodingTestCode(String(sessionData.sessionId), {
        problemId: String(currentProblem.id ?? ''),
        language,
        code,
        currentProblemIndex: problemIndex,
      })
      setFinalResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit code.')
    } finally {
      setSubmitting(false)
    }
  }

  const goToNextProblem = () => {
    const nextIndex = Math.min(problemIndex + 1, Math.max(problems.length - 1, 0))
    setProblemIndex(nextIndex)
    setCode(codingStarterTemplates[language] ?? codingStarterTemplates.python)
    setRunResult(null)
    setFinalResult(null)
  }

  const bindEditorScrollBridge = (editor: MonacoEditorLike | null) => {
    editorWheelCleanupRef.current?.()
    editorWheelCleanupRef.current = null
    editorInstanceRef.current = editor
    const domNode = editor?.getDomNode()
    if (!editor || !domNode) return

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return
      const scrollTop = editor.getScrollTop()
      const scrollHeight = editor.getScrollHeight()
      const editorHeight = editor.getLayoutInfo().height
      const maxScrollTop = Math.max(0, scrollHeight - editorHeight)
      const atTop = scrollTop <= 0
      const atBottom = scrollTop >= maxScrollTop - 1
      const scrollingUp = event.deltaY < 0
      const scrollingDown = event.deltaY > 0

      if ((scrollingUp && atTop) || (scrollingDown && atBottom)) {
        event.preventDefault()
        window.scrollBy({ top: event.deltaY, behavior: 'auto' })
      }
    }

    domNode.addEventListener('wheel', onWheel, { passive: false })
    editorWheelCleanupRef.current = () => domNode.removeEventListener('wheel', onWheel)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAssignedCodingAssessment ? 'Recruiter Assigned Coding Round' : 'Coding Test'}
        subtitle={isAssignedCodingAssessment ? 'Locked assessment mode. Only coding and final submission actions are available.' : 'Dedicated coding round for coding-related roles only, with backend-controlled execution and real test-case evaluation.'}
        action={
          !isAssignedCodingAssessment ? <div className="flex flex-wrap gap-2">
            <button type="button" onClick={endCodingTest} className="rounded-lg border border-rose-400/45 px-3 py-2 text-sm text-rose-100">End Test</button>
            <button type="button" onClick={() => navigate('/student/mock-interview')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Back to Mock Interview</button>
          </div> : undefined
        }
      />
      {assignmentState.assignmentId ? (
        <Card className="border border-cyan-400/30 bg-cyan-500/5">
          <p className="text-sm font-semibold text-cyan-200">Recruiter-assigned coding round</p>
          <p className="mt-1 text-sm text-slate-300">This coding round is linked to a recruiter application and the result will be shared automatically after submission{assignmentState.deadline ? ` before ${new Date(assignmentState.deadline).toLocaleString()}` : ''}.</p>
        </Card>
      ) : null}

      <Card className="grid gap-4 md:grid-cols-5">
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Selected field</p><p className="mt-1 text-sm font-semibold text-slate-100">{domainOptions.find((item) => item.key === selectedDomain)?.label ?? 'Coding'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Target role</p><p className="mt-1 text-sm font-semibold text-slate-100">{role || 'Choose role'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Difficulty</p><p className="mt-1 text-sm font-semibold text-slate-100">{difficulty}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Last coding score</p><p className="mt-1 text-2xl font-semibold text-cyan-300">{Number(latestCodingReport.finalScore ?? latestCodingReport.passPercentage ?? 0) ? `${Number(latestCodingReport.finalScore ?? latestCodingReport.passPercentage ?? 0)}%` : 'No attempt yet'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Execution</p><p className="mt-1 text-sm font-semibold text-slate-100">{executionConfigured ? 'Configured' : 'Needs backend API config'}</p></div>
      </Card>

      {!codingVisible ? (
        <Card>
          <h3 className="font-semibold">Coding Test is not enabled for this path</h3>
          <p className="mt-2 text-sm text-slate-400">This practical round is reserved for coding-related roles. For non-coding tracks, keep using HR, role-based, resume, and domain-specific practical rounds.</p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.05fr,1.95fr]">
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="font-semibold">{isAssignedCodingAssessment ? 'Assessment Instructions' : 'Launcher'}</h3>
              {!isAssignedCodingAssessment ? <AppSelect
                value={selectedDomain}
                onChange={(value) => setSelectedDomain(value as DomainKey)}
                options={domainOptions
                  .filter((item) => codingRelevantDomainKeys.includes(item.key))
                  .map((item) => ({ value: item.key, label: item.label }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
              /> : <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/5 px-4 py-3 text-sm text-slate-200">This recruiter coding round uses a locked configuration. You cannot change the field, role, or difficulty.</div>}
              {!isAssignedCodingAssessment ? <SuggestionInput value={role} onChange={setRole} placeholder="Coding role" suggestions={roleSuggestions} /> : null}
              <div className="grid gap-3 md:grid-cols-2">
                {!isAssignedCodingAssessment ? <AppSelect
                  value={difficulty}
                  onChange={setDifficulty}
                  options={asSelectOptions(['Beginner', 'Intermediate', 'Advanced'])}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                /> : <div className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-slate-200">Difficulty: {difficulty}</div>}
                <AppSelect
                  value={language}
                  onChange={setLanguage}
                  options={codingLanguageOptions.map((item) => ({ value: item.key, label: item.label }))}
                  className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                />
              </div>
              <button type="button" onClick={() => void startCodingRound()} disabled={loading || !role.trim()} className="app-primary-button rounded-lg px-4 py-3 font-semibold disabled:opacity-60">{loading ? 'Preparing...' : isAssignedCodingAssessment ? 'Start Assigned Coding Round' : 'Launch Coding Round'}</button>
              <p className="text-xs text-slate-500">{isAssignedCodingAssessment ? 'Assessment settings are locked. Final Submit ends the round.' : 'Run Code checks visible cases only. Submit Code checks visible and hidden cases for real scoring.'}</p>
            </Card>

            <Card className="space-y-3">
              <h3 className="font-semibold">Evaluation Rules</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                <li>`Run Code` uses only visible test cases for debugging.</li>
                <li>`Submit Code` uses both visible and hidden test cases.</li>
                <li>Output comparison is normalized for extra spaces and newline differences.</li>
                <li>100% pass = `Passed`, 50-99% = `Partial`, below 50% = `Failed`.</li>
              </ul>
            </Card>

            {!executionConfigured && sessionData ? (
              <Card className="space-y-3 border border-amber-400/30 bg-amber-500/5">
                <h3 className="font-semibold text-amber-200">Execution Setup Needed</h3>
                <p className="text-sm text-slate-300">This session was created when execution looked unavailable. Try `Run Code` again now. If the backend is ready, the runner will work immediately.</p>
                <p className="text-xs text-slate-400">If it still fails, the backend will return the real execution error instead of a fake test failure.</p>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            {!currentProblem ? (
              <Card>
                <h3 className="font-semibold">Coding Test Setup Ready</h3>
                <p className="mt-2 text-sm text-slate-400">{isAssignedCodingAssessment ? 'Start the recruiter-assigned coding round to open the locked problem workspace.' : 'Launch the coding round to open a dedicated problem workspace with Monaco Editor, language selection, visible samples, and backend-controlled evaluation.'}</p>
              </Card>
            ) : (
              <>
                <Card className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-cyan-300">{String(currentProblem.topic ?? 'Coding')} | {String(currentProblem.difficulty ?? difficulty)}</p>
                      <h3 className="text-xl font-semibold text-white">{String(currentProblem.title ?? 'Coding Problem')}</h3>
                      <p className="mt-1 text-sm text-slate-400">{String(currentProblem.role ?? role)} | {String(currentProblem.domain ?? selectedDomain)}</p>
                    </div>
                    <div className="min-w-44">
                      <ProgressBar label="Problem progress" value={problems.length ? Math.round(((problemIndex + 1) / problems.length) * 100) : 0} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Problem Statement</p>
                      <p className="mt-2 text-sm text-slate-300">{String(currentProblem.problemStatement ?? '')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Formats</p>
                      <p className="mt-2 text-sm text-slate-300"><strong>Input:</strong> {String(currentProblem.inputFormat ?? '')}</p>
                      <p className="mt-2 text-sm text-slate-300"><strong>Output:</strong> {String(currentProblem.outputFormat ?? '')}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-800 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Constraints</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(toStringArray(currentProblem.constraints))}</ul>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Sample Input</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{String(currentProblem.sampleInput ?? '')}</pre>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Sample Output</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{String(currentProblem.sampleOutput ?? '')}</pre>
                    </div>
                  </div>
                </Card>

                <Card className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-3">
                      <AppSelect
                        value={language}
                        onChange={(value) => {
                          setLanguage(value)
                          setCode(codingStarterTemplates[value] ?? codingStarterTemplates.python)
                        }}
                        options={supportedLanguages.map((item) => ({ value: item, label: toTitleCase(item) }))}
                        className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
                      />
                      <button type="button" onClick={() => setCode(codingStarterTemplates[language] ?? codingStarterTemplates.python)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Reset Starter</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void runCode()} disabled={running || submitting} className="rounded-lg border border-slate-600 px-4 py-2 disabled:opacity-50">{running ? 'Running...' : 'Run Code'}</button>
                      <button type="button" onClick={() => { if (isAssignedCodingAssessment && !window.confirm('Submit this recruiter-assigned coding round? You cannot edit it after final submission.')) return; void submitCode() }} disabled={submitting || running} className="app-primary-button rounded-lg px-4 py-2 font-semibold disabled:opacity-50">{submitting ? 'Submitting...' : isAssignedCodingAssessment ? 'Final Submit' : 'Submit Code'}</button>
                    </div>
                  </div>
                  <Editor
                    height="460px"
                    language={language === 'cpp' ? 'cpp' : language}
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value ?? '')}
                    onMount={(editor) => bindEditorScrollBridge(editor as unknown as MonacoEditorLike)}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      automaticLayout: true,
                      mouseWheelZoom: true,
                      scrollBeyondLastLine: false,
                      scrollbar: {
                        alwaysConsumeMouseWheel: false,
                      },
                    }}
                  />
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="space-y-3">
                    <h3 className="font-semibold">Visible Test Cases</h3>
                    <div className="space-y-3">
                      {((currentProblem.visibleTestCases ?? []) as ApiRecord[]).map((testCase, index) => (
                        <div key={`visible-${index}`} className="rounded-xl border border-slate-800 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Case {index + 1}</p>
                          <p className="mt-2 text-xs text-slate-500">Input</p>
                          <pre className="whitespace-pre-wrap text-sm text-slate-300">{String(testCase.input ?? '')}</pre>
                          <p className="mt-2 text-xs text-slate-500">Expected Output</p>
                          <pre className="whitespace-pre-wrap text-sm text-slate-300">{String(testCase.output ?? '')}</pre>
                          <p className="mt-2 text-xs text-slate-500">{String(testCase.explanation ?? '')}</p>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="space-y-3">
                    <h3 className="font-semibold">Run Result</h3>
                    {runResult ? (
                      <>
                        <p className="text-sm text-slate-300">Status: <span className="font-semibold text-white">{String(runResult.status ?? 'Pending')}</span></p>
                        <p className="text-sm text-slate-300">Passed: {Number(runResult.passedCount ?? 0)} / {Number(runResult.totalCount ?? 0)}</p>
                        <p className="text-sm text-slate-300">Score: {Number(runResult.score ?? 0)}%</p>
                        <ConsoleBlock title="Console Output" content={String(runResult.outputPreview ?? runResult.testCaseResults?.[0]?.actualOutput ?? '')} />
                        <div className="space-y-2">
                          {((runResult.testCaseResults ?? []) as ApiRecord[]).map((item, index) => (
                            <div key={`run-result-${index}`} className="rounded-xl border border-slate-800 p-3">
                              <p className={`text-sm font-semibold ${item.passed ? 'text-emerald-300' : 'text-amber-300'}`}>Visible Case {index + 1}: {item.passed ? 'Passed' : 'Failed'}</p>
                              <div className="mt-3 space-y-3">
                                <ConsoleBlock title="Your Output" content={String(item.actualOutput ?? '')} />
                                {item.error ? <ConsoleBlock title="Execution Error" content={String(item.error)} tone="error" /> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-sm text-slate-500">Use `Run Code` to test against visible cases first.</p>}
                  </Card>
                </div>

                {finalResult ? (
                  <Card className="space-y-4">
                    <h3 className="font-semibold">Final Result</h3>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div><p className="text-xs uppercase tracking-wide text-slate-400">Status</p><p className="mt-1 text-xl font-semibold text-white">{toTitleCase(String(finalResult.status ?? ''))}</p></div>
                      <div><p className="text-xs uppercase tracking-wide text-slate-400">Final score</p><p className="mt-1 text-xl font-semibold text-cyan-300">{Number(finalResult.finalScore ?? 0)}%</p></div>
                      <div><p className="text-xs uppercase tracking-wide text-slate-400">Test cases passed</p><p className="mt-1 text-xl font-semibold text-emerald-300">{Number(finalResult.passedCount ?? 0)} / {Number(finalResult.totalCount ?? 0)}</p></div>
                      <div><p className="text-xs uppercase tracking-wide text-slate-400">Time taken</p><p className="mt-1 text-xl font-semibold text-fuchsia-300">{Number(finalResult.timeTakenSec ?? 0)}s</p></div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div><p className="text-xs uppercase tracking-wide text-amber-300">Weak areas</p><p className="mt-1 text-sm text-slate-300">{textList(toStringArray(finalResult.weakTopics))}</p></div>
                      <div><p className="text-xs uppercase tracking-wide text-emerald-300">Solved topics</p><p className="mt-1 text-sm text-slate-300">{textList(toStringArray(finalResult.solvedTopics))}</p></div>
                    </div>
                    <ConsoleBlock title="Submission Output Snapshot" content={String((finalResult.testCaseResults?.[0] as ApiRecord | undefined)?.actualOutput ?? '')} />
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">Suggested next practice topics</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">{asRows(toStringArray(finalResult.recommendedNextSteps))}</ul>
                    </div>
                    <div className="space-y-2">
                      {((finalResult.testCaseResults ?? []) as ApiRecord[]).map((item, index) => (
                        <div key={`submit-result-${index}`} className="rounded-xl border border-slate-800 p-3">
                          <p className={`text-sm font-semibold ${item.passed ? 'text-emerald-300' : 'text-amber-300'}`}>{String(item.hidden ? 'Hidden' : 'Visible')} case {index + 1}: {item.passed ? 'Passed' : 'Failed'}</p>
                          <div className="mt-3 space-y-3">
                            <ConsoleBlock title="Actual Output" content={String(item.actualOutput ?? '')} />
                            {item.error ? <ConsoleBlock title="Execution Error" content={String(item.error)} tone="error" /> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!isAssignedCodingAssessment ? <button type="button" onClick={() => { setCode(codingStarterTemplates[language] ?? codingStarterTemplates.python); setRunResult(null); setFinalResult(null) }} className="rounded-lg border border-slate-700 px-4 py-2">Retry Problem</button> : null}
                      {!isAssignedCodingAssessment ? <button type="button" onClick={goToNextProblem} disabled={problemIndex >= problems.length - 1} className="app-primary-button rounded-lg px-4 py-2 font-semibold disabled:opacity-50">Next Problem</button> : null}
                      {!isAssignedCodingAssessment && problemIndex >= problems.length - 1 ? (
                        <button type="button" onClick={() => void startCodingRound()} className="app-primary-button rounded-lg px-4 py-2 font-semibold">Start New Coding Round</button>
                      ) : null}
                      {!isAssignedCodingAssessment ? <button type="button" onClick={endCodingTest} className="rounded-lg border border-rose-400/45 px-4 py-2 text-rose-100">End Test</button> : null}
                    </div>
                    {!isAssignedCodingAssessment && problemIndex >= problems.length - 1 ? (
                      <p className="text-xs text-slate-500">You have reached the last loaded problem in this coding round.</p>
                    ) : null}
                  </Card>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {error ? <p className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}
    </div>
  )
}

export const MyReportsPage = () => {
  const navigate = useNavigate()
  const { reports } = useReports()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ApiRecord | null>(null)
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [domainFilter, setDomainFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('')
  const reportType = (report: ApiRecord) => String(report.type ?? report.reportType ?? 'Report')
  const reportDate = (report: ApiRecord) => new Date(String(report.createdAt ?? report.generatedAt ?? Date.now()))
  const reportScore = (report: ApiRecord): number => {
    const content = contentOf(report)
    return Number(content.score ?? content.finalScore ?? content.passPercentage ?? content.readinessScore ?? content.skillGapAnalysis?.readinessScore ?? content.jobRecommendations?.[0]?.fitScore ?? content.atsScore ?? report.atsScore ?? 0)
  }
  const reportDomain = (report: ApiRecord): string => {
    const content = contentOf(report)
    const raw = String(content.selectedDomain ?? content.domain ?? content.field ?? content.activeDomainLabel ?? content.confirmedDomainLabel ?? report.selectedDomain ?? report.domain ?? '').trim()
    const option = domainOptions.find((item) => item.key === raw || item.label.toLowerCase() === raw.toLowerCase())
    return option?.label ?? raw ?? '-'
  }
  const reportRole = (report: ApiRecord): string => {
    const content = contentOf(report)
    return String(content.targetRole ?? content.parsedJobDescription?.jobRole ?? content.role ?? report.targetRole ?? '-')
  }
  const reportStatus = (report: ApiRecord): string => {
    const score = reportScore(report)
    if (score >= 75) return 'Strong progress'
    if (score >= 50) return 'Improving'
    return score > 0 ? 'Needs attention' : 'Review ready'
  }
  const reportWeakAreas = (report: ApiRecord): string[] => {
    const content = contentOf(report)
    return [
      ...(content.skillGapAnalysis?.missingRequiredSkills ?? []),
      ...(content.skillGapAnalysis?.weakRequiredSkills ?? []),
      ...(content.missingSkills ?? []),
      ...((content.gaps ?? []) as ApiRecord[]).map((gap) => String(gap.skill ?? '')),
      ...(content.weaknesses ?? []),
      ...(content.missingSections ?? []),
      ...(content.weakTopics ?? []),
    ].filter(Boolean)
  }
  const reportSummary = (report: ApiRecord): string => {
    const content = contentOf(report)
    return String(content.summary ?? content.enhancement?.summaryRewrite ?? content.feedback ?? content.suggestions?.[0] ?? report.summary ?? 'Report is ready for review.')
  }
  const sortedReports = [...reports].sort((a, b) => reportDate(b).getTime() - reportDate(a).getTime())
  const filteredReports = sortedReports.filter((report) => {
    const typeOk = typeFilter === 'all' || reportType(report) === typeFilter
    const domainOk = domainFilter === 'all' || reportDomain(report) === domainFilter
    const roleOk = !roleFilter.trim() || reportRole(report).toLowerCase().includes(roleFilter.trim().toLowerCase())
    const ageDays = (Date.now() - reportDate(report).getTime()) / (1000 * 60 * 60 * 24)
    const dateOk = dateFilter === 'all' || (dateFilter === '7' ? ageDays <= 7 : ageDays <= 30)
    return typeOk && domainOk && roleOk && dateOk
  })
  const typeOptions = [...new Set(sortedReports.map(reportType))]
  const domainOptionsInReports = [...new Set(sortedReports.map(reportDomain).filter(Boolean))]
  const latestReport = sortedReports[0]
  const previousReport = sortedReports[1]
  const latestScore = latestReport ? reportScore(latestReport) : 0
  const previousScore = previousReport ? reportScore(previousReport) : 0
  const scoreChange = latestScore && previousScore ? latestScore - previousScore : 0
  const recent7 = sortedReports.filter((report) => (Date.now() - reportDate(report).getTime()) / (1000 * 60 * 60 * 24) <= 7).length
  const recent30 = sortedReports.filter((report) => (Date.now() - reportDate(report).getTime()) / (1000 * 60 * 60 * 24) <= 30).length
  const weakCounts = sortedReports.flatMap(reportWeakAreas).reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1
    return acc
  }, {})
  const mostRepeatedWeakness = Object.entries(weakCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No repeated weakness yet'
  const latestWeakAreas = latestReport ? reportWeakAreas(latestReport) : []
  const previousWeakAreas = previousReport ? reportWeakAreas(previousReport) : []
  const improvedSkills = previousWeakAreas.filter((skill) => !latestWeakAreas.includes(skill))
  const trendData = sortedReports
    .slice(0, 8)
    .reverse()
    .map((report) => ({ name: reportDate(report).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: reportScore(report), secondary: reportWeakAreas(report).length }))
  const latestMock = sortedReports.find((report) => reportType(report) === 'Mock Interview')
  const latestCoding = sortedReports.find((report) => reportType(report) === 'Coding Test')
  const topStrongAreas = unique(
    sortedReports.flatMap((report) => [
      ...toStringArray(contentOf(report).strengths),
      ...toStringArray(contentOf(report).matchedSkills),
      ...toStringArray(contentOf(report).topSkills),
    ]),
  ).slice(0, 4)
  const nextRecommendedAction = String(
    contentOf(latestReport ?? {}).recommendedNextSteps?.[0] ??
      contentOf(latestReport ?? {}).readiness?.message ??
      reportWeakAreas(latestReport ?? {}).at(0) ??
      'Generate a fresh report to see your next recommended action.',
  )
  const latestOfType = (type: string) => sortedReports.find((report) => reportType(report) === type)
  const compareType = typeFilter !== 'all' ? typeFilter : reportType(latestReport ?? {})
  const latestComparable = latestOfType(compareType)
  const previousComparable = sortedReports.filter((report) => reportType(report) === compareType)[1]
  const comparableScoreDelta = latestComparable && previousComparable ? reportScore(latestComparable) - reportScore(previousComparable) : 0
  const rows = filteredReports.map((report) => ({
    Report: String(report.title ?? reportType(report)),
    Type: reportType(report),
    Date: reportDate(report).toLocaleString(),
    Field: reportDomain(report),
    Role: reportRole(report),
    Score: reportScore(report) ? `${reportScore(report)}%` : '-',
    Status: reportStatus(report),
    Action: (
      <div className="flex gap-2">
        <button onClick={() => { setSelected(report); setOpen(true) }} className="app-primary-button rounded px-2 py-1 text-xs font-semibold">View</button>
        <button onClick={() => downloadPdfReport(String(report.title ?? 'report'), contentOf(report).formattedHtml ?? `<pre>${JSON.stringify(contentOf(report), null, 2)}</pre>`)} className="rounded border border-slate-600 px-2 py-1 text-xs">PDF</button>
      </div>
    ),
  }))
  return (
    <div className="space-y-5">
      <PageHeader title="My Reports" subtitle="Track your resume, job match, skill gap, and interview progress over time." />
      <Card className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Total reports</p><p className="mt-1 text-2xl font-semibold text-white">{reports.length}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Latest readiness</p><p className="mt-1 text-2xl font-semibold text-cyan-300">{latestScore ? `${latestScore}%` : 'Pending'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Latest mock score</p><p className="mt-1 text-2xl font-semibold text-emerald-300">{latestMock && reportScore(latestMock) ? `${reportScore(latestMock)}%` : 'Pending'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Latest coding score</p><p className="mt-1 text-2xl font-semibold text-amber-300">{latestCoding && reportScore(latestCoding) ? `${reportScore(latestCoding)}%` : 'Pending'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Biggest improvement area</p><p className="mt-1 text-sm text-emerald-300">{improvedSkills[0] ?? 'No change detected yet'}</p></div>
        <div><p className="text-xs uppercase tracking-wide text-slate-400">Most repeated weak area</p><p className="mt-1 text-sm text-amber-300">{mostRepeatedWeakness}</p></div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrendChart data={trendData.length ? trendData : [{ name: 'Now', value: 0, secondary: 0 }]} />
        </div>
        <Card className="space-y-3">
          <h3 className="font-semibold">Comparison snapshot</h3>
          <p className="text-sm text-slate-400">{compareType && compareType !== 'undefined' ? `${compareType} comparison` : 'Previous vs latest report'}</p>
          <p className="text-sm text-slate-400">Old score: {previousComparable ? `${reportScore(previousComparable)}%` : previousScore ? `${previousScore}%` : '-'} | New score: {latestComparable ? `${reportScore(latestComparable)}%` : latestScore ? `${latestScore}%` : '-'}</p>
          <p className={(latestComparable && previousComparable ? comparableScoreDelta : scoreChange) >= 0 ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}>
            {(latestComparable && previousComparable ? comparableScoreDelta : scoreChange)
              ? `${(latestComparable && previousComparable ? comparableScoreDelta : scoreChange) > 0 ? '+' : ''}${latestComparable && previousComparable ? comparableScoreDelta : scoreChange}% change`
              : 'No score change yet'}
          </p>
          <p className="text-sm text-slate-400">Improved areas: {textList(improvedSkills)}</p>
          <p className="text-sm text-slate-400">Still weak: {textList(latestWeakAreas)}</p>
          <p className="text-sm text-slate-400">Updated readiness direction: {nextRecommendedAction}</p>
        </Card>
      </div>
      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Top strong areas</p>
            <p className="mt-2 text-sm text-slate-300">{textList(topStrongAreas)}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Recent activity</p>
            <p className="mt-2 text-sm text-slate-300">{recent30} report actions in the last 30 days</p>
            <p className="text-xs text-slate-500">{recent7} in the last 7 days</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Next recommended action</p>
            <p className="mt-2 text-sm text-slate-300">{nextRecommendedAction}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
        <AppSelect
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'All report types' },
            ...typeOptions.map((type: string) => ({ value: type, label: type })),
          ]}
          className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
        />
        <AppSelect
          value={dateFilter}
          onChange={setDateFilter}
          options={asSelectOptions([
            { value: 'all', label: 'All dates' },
            { value: '7', label: 'Last 7 days' },
            { value: '30', label: 'Last 30 days' },
          ])}
          className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
        />
        <AppSelect
          value={domainFilter}
          onChange={setDomainFilter}
          options={[
            { value: 'all', label: 'All fields' },
            ...domainOptionsInReports.map((domain) => ({ value: domain, label: domain })),
          ]}
          className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
        />
        <input value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Filter by target role" />
        </div>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Latest Report Summary</h3>
        <p className="text-sm text-slate-400">{latestReport ? reportSummary(latestReport) : 'No reports have been generated yet.'}</p>
        <div className="grid gap-3 md:grid-cols-3">
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Latest report type</p><p className="mt-1 text-sm text-slate-200">{latestReport ? reportType(latestReport) : '-'}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Selected field</p><p className="mt-1 text-sm text-slate-200">{latestReport ? reportDomain(latestReport) : '-'}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Target role</p><p className="mt-1 text-sm text-slate-200">{latestReport ? reportRole(latestReport) : '-'}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Biggest improvement area</p><p className="mt-1 text-sm text-emerald-300">{textList(improvedSkills)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Still weak areas</p><p className="mt-1 text-sm text-amber-300">{textList(latestWeakAreas)}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-400">Progress badge</p><p className="mt-1 text-sm text-cyan-300">{reportStatus(latestReport ?? {})}</p></div>
        </div>
      </Card>
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Progress review</h3>
            <p className="text-sm text-slate-400">Use the latest report to decide what to improve next.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/student/skill-gap')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Open Skill Gap</button>
            <button onClick={() => navigate('/student/interview-prep')} className="rounded-lg border border-slate-700 px-3 py-2 text-sm">Open Interview Prep</button>
          </div>
        </div>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {filteredReports.map((report) => (
          <Card key={`${reportType(report)}-${reportDate(report).toISOString()}-${report.title}`} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-cyan-300">{reportType(report)}</p>
                <h3 className="font-semibold text-slate-100">{String(report.title ?? reportType(report))}</h3>
                <p className="text-xs text-slate-500">{reportDate(report).toLocaleString()} | {reportDomain(report)} | {reportRole(report)}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-100">{reportScore(report) ? `${reportScore(report)}%` : 'No score'}</span>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300">{reportStatus(report)}</span>
              </div>
            </div>
            <p className="text-sm text-slate-400">{reportSummary(report)}</p>
            <p className="text-xs text-amber-300">Weak areas: {textList(reportWeakAreas(report).slice(0, 5))}</p>
            <div className="flex gap-2">
              <button onClick={() => { setSelected(report); setOpen(true) }} className="app-primary-button rounded px-3 py-2 text-xs font-semibold">View full report</button>
              <button onClick={() => downloadPdfReport(String(report.title ?? 'report'), contentOf(report).formattedHtml ?? `<pre>${JSON.stringify(contentOf(report), null, 2)}</pre>`)} className="rounded border border-slate-600 px-3 py-2 text-xs">Download PDF</button>
            </div>
          </Card>
        ))}
      </div>
      <Card className="space-y-3">
        <h3 className="font-semibold">Report History Table</h3>
        <DataTable columns={['Report', 'Type', 'Date', 'Field', 'Role', 'Score', 'Status', 'Action']} rows={rows} />
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Recent Activity Timeline</h3>
        {filteredReports.slice(0, 6).map((report) => (
          <div key={`timeline-${reportDate(report).toISOString()}-${report.title}`} className="border-l border-slate-700 pl-4">
            <p className="text-sm font-medium text-slate-100">{reportType(report)} generated</p>
            <p className="text-xs text-slate-500">{reportDate(report).toLocaleString()} | {reportSummary(report)}</p>
          </div>
        ))}
        {!filteredReports.length ? <p className="text-sm text-slate-500">No reports match the current filters.</p> : null}
      </Card>
      <AppModal open={open} onClose={() => setOpen(false)} title="Report Details" panelClassName="max-w-3xl border border-slate-700 bg-slate-950 text-slate-100" titleClassName="text-white" closeClassName="text-white">
        <div className="max-h-[70vh] overflow-auto rounded-lg bg-white p-4 text-slate-900" dangerouslySetInnerHTML={{ __html: contentOf(selected ?? {}).formattedHtml ?? `<pre>${JSON.stringify(contentOf(selected ?? {}), null, 2)}</pre>` }} />
      </AppModal>
    </div>
  )
}

export const MyApplicationsPage = () => {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<ApiRecord[]>([])
  const [applications, setApplications] = useState<ApiRecord[]>([])
  const [resumes, setResumes] = useState<ApiRecord[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedJob, setSelectedJob] = useState<ApiRecord | null>(null)
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [newResumeFile, setNewResumeFile] = useState<File | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadData = async () => {
    const [jobRows, applicationRows, resumeRows] = await Promise.all([
      studentApi.listOpenJobs(),
      studentApi.listApplications(),
      studentApi.listResumes(),
    ])
    setJobs(jobRows.filter((job) => String(job.status ?? 'active') !== 'inactive'))
    setApplications(applicationRows)
    setResumes(resumeRows)
    if (!selectedResumeId && resumeRows.length) {
      setSelectedResumeId(getId(resumeRows[0]))
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const haystack = `${job.title ?? ''} ${job.company ?? ''} ${job.domain ?? ''} ${job.roleLabel ?? ''} ${job.location ?? ''}`.toLowerCase()
    return !query.trim() || haystack.includes(query.toLowerCase())
  }), [jobs, query])

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const haystack = `${application.job?.title ?? ''} ${application.job?.company ?? ''} ${application.status ?? ''} ${application.job?.domain ?? ''}`.toLowerCase()
    const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase())
    const matchesStatus = statusFilter === 'all' || String(application.status ?? '') === statusFilter
    return matchesQuery && matchesStatus
  }), [applications, query, statusFilter])

  const openApplyModal = (job: ApiRecord) => {
    setSelectedJob(job)
    setSelectedResumeId(getId(resumes[0] ?? {}))
    setNewResumeFile(null)
    setModalOpen(true)
    setMessage('')
  }

  const submitApplication = async () => {
    if (!selectedJob) return
    try {
      setLoading(true)
      setMessage('')
      let resumeId = selectedResumeId
      if (newResumeFile) {
        const uploaded = await studentApi.uploadResume(newResumeFile)
        resumeId = String(uploaded.resume?._id ?? uploaded.resume?.id ?? '')
      }
      if (!resumeId) {
        setMessage('Choose an existing resume or upload a CV for this application.')
        return
      }
      await studentApi.applyToJob({ jobId: getId(selectedJob), resumeId })
      await loadData()
      setModalOpen(false)
      setMessage('Application submitted successfully.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit the application.')
    } finally {
      setLoading(false)
    }
  }

  const openAssignedInterview = (application: ApiRecord, round: ApiRecord) => {
    navigate('/student/mock-interview', {
      state: {
        assignmentId: String(round._id ?? round.id ?? ''),
        applicationId: String(application._id ?? application.id ?? ''),
        recruiterId: String(application.recruiter?.id ?? ''),
        jobId: String(application.job?.id ?? ''),
        role: String(application.job?.roleLabel ?? application.student?.targetRole ?? ''),
        selectedDomain: String(application.job?.domain ?? 'general_fresher') as DomainKey,
        difficulty: String(round.difficulty ?? 'Intermediate'),
        interviewType: String(round.roundType ?? 'mixed'),
        questionCount: Number(round.questionCount ?? 6),
        timerPerQuestionSec: Number(round.timeLimitSec ?? 0),
        deadline: String(round.deadline ?? ''),
      },
    })
  }

  const openAssignedCoding = (application: ApiRecord, round: ApiRecord) => {
    navigate('/student/mock-interview/coding-test', {
      state: {
        assignmentId: String(round._id ?? round.id ?? ''),
        applicationId: String(application._id ?? application.id ?? ''),
        recruiterId: String(application.recruiter?.id ?? ''),
        jobId: String(application.job?.id ?? ''),
        role: String(application.job?.roleLabel ?? application.student?.targetRole ?? ''),
        domain: String(application.job?.domain ?? 'it_software') as DomainKey,
        difficulty: String(round.difficulty ?? 'Intermediate'),
        deadline: String(round.deadline ?? ''),
      },
    })
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My Applications" subtitle="Apply to recruiter jobs, track progress, and complete assigned hiring rounds without leaving the platform." />
      <Card className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2" placeholder="Search jobs, companies, domains, or application status" />
        <AppSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All application states' },
            { value: 'applied', label: 'Applied' },
            { value: 'under_review', label: 'Under review' },
            { value: 'interview_assigned', label: 'Interview assigned' },
            { value: 'coding_round_assigned', label: 'Coding round assigned' },
            { value: 'completed', label: 'Completed' },
            { value: 'shortlisted', label: 'Shortlisted' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'hired', label: 'Hired' },
          ]}
          className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.1fr,1.4fr]">
        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Open recruiter jobs</h3>
              <p className="text-sm text-slate-400">Apply using an existing resume or upload a CV specifically for the application.</p>
            </div>
            <div className="space-y-3">
              {filteredJobs.slice(0, 8).map((job: ApiRecord) => (
                <div key={getId(job)} className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{String(job.title ?? 'Untitled job')}</p>
                      <p className="mt-1 text-xs text-slate-400">{String(job.company ?? '-')} | {String(job.location ?? 'Remote / flexible')}</p>
                    </div>
                    <button type="button" onClick={() => openApplyModal(job)} className="app-primary-button rounded-xl px-3 py-2 text-sm font-semibold">Apply</button>
                  </div>
                  <p className="mt-3 text-sm text-slate-300">{String(job.description ?? job.descriptionText ?? '').slice(0, 180) || 'No description shared.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {toStringArray(job.requiredSkills).slice(0, 5).map((skill) => (
                      <span key={skill} className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200">{skill}</span>
                    ))}
                  </div>
                </div>
              ))}
              {!filteredJobs.length ? <p className="text-sm text-slate-400">No recruiter jobs match the current search.</p> : null}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Applied jobs and assigned rounds</h3>
              <p className="text-sm text-slate-400">Track recruiter decisions, deadlines, and assessment progress from one place.</p>
            </div>
            <div className="space-y-4">
              {filteredApplications.map((application: ApiRecord) => (
                <div key={String(application._id ?? application.id ?? '')} className="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{String(application.job?.title ?? 'Applied job')}</p>
                      <p className="mt-1 text-xs text-slate-400">{String(application.job?.company ?? '-')} | {String(application.job?.domain ?? 'General')}</p>
                    </div>
                    <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-200">{String(application.status ?? 'applied')}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Resume used</p>
                      <p className="mt-1 text-sm text-slate-200">{String(application.resume?.fileName ?? 'Resume attached')}</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Recruiter review</p>
                      <p className="mt-1 text-sm text-slate-200">{String(application.recruiterReviewStatus ?? 'new')}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(application.assignedRounds as ApiRecord[] | undefined)?.length ? (
                      (application.assignedRounds as ApiRecord[]).map((round) => (
                        <div key={String(round._id ?? round.id ?? '')} className="rounded-xl border border-slate-800 bg-slate-950/45 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{String(round.roundCategory ?? '').toUpperCase()} | {String(round.roundType ?? '-')}</p>
                              <p className="mt-1 text-xs text-slate-400">Difficulty: {String(round.difficulty ?? 'Intermediate')} | Questions: {Number(round.questionCount ?? 0) || '-'}</p>
                              {round.deadline ? <p className="mt-1 text-xs text-amber-300">Deadline: {new Date(String(round.deadline)).toLocaleString()}</p> : null}
                            </div>
                            <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200">{String(round.status ?? 'assigned')}</span>
                          </div>
                          {String(round.status ?? '') !== 'completed' && String(round.status ?? '') !== 'reviewed' ? (
                            <div className="mt-3">
                              {String(round.roundCategory ?? '') === 'interview' ? (
                                <button type="button" onClick={() => openAssignedInterview(application, round)} className="app-primary-button rounded-xl px-3 py-2 text-sm font-semibold">Take assigned interview</button>
                              ) : (
                                <button type="button" onClick={() => openAssignedCoding(application, round)} className="app-primary-button rounded-xl px-3 py-2 text-sm font-semibold">Take assigned coding round</button>
                              )}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                              <p className="text-sm font-semibold text-emerald-200">Completed</p>
                              <p className="mt-1 text-xs text-slate-300">
                                {String(round.roundCategory ?? '') === 'interview'
                                  ? `Interview score: ${Number(round.resultSummary?.score ?? round.sessionSummary?.score ?? 0)}%`
                                  : `Coding score: ${Number(round.resultSummary?.score ?? round.sessionSummary?.score ?? 0)}%`}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : <p className="text-sm text-slate-400">No recruiter-assigned rounds yet.</p>}
                  </div>
                </div>
              ))}
              {!filteredApplications.length ? <p className="text-sm text-slate-400">You have not applied to any recruiter jobs yet.</p> : null}
            </div>
          </Card>
        </div>
      </div>

      {message ? <p className="text-sm text-cyan-300">{message}</p> : null}

      <AppModal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply to job" panelClassName="border-slate-700 bg-[#09101d] text-slate-100" headerClassName="border-slate-700" bodyClassName="p-5">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-white">{String(selectedJob?.title ?? 'Selected job')}</p>
            <p className="mt-1 text-xs text-slate-400">{String(selectedJob?.company ?? '-')}</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">Select existing resume</label>
            <AppSelect
              value={selectedResumeId}
              onChange={setSelectedResumeId}
              options={resumes.map((resume) => ({ value: getId(resume), label: String(resume.fileName ?? 'Resume') }))}
              placeholder="Choose resume"
              className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">Or upload a new CV for this application</label>
            <FileDrop onSelect={setNewResumeFile} />
            {newResumeFile ? <p className="mt-2 text-sm text-slate-300">Selected file: {newResumeFile.name}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void submitApplication() }} disabled={loading} className="app-primary-button rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60">{loading ? 'Submitting...' : 'Submit application'}</button>
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200">Cancel</button>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

export const StudentSettingsPage = () => {
  const { resumes } = useResumes()
  const session = authApi.getSession()
  const [profile, setProfile] = useState<StudentProfile>(emptyStudentProfile)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const settingsKey = `career-compass-student-settings:${session?.user.id ?? 'guest'}`
  type StudentLocalSettings = {
    phone: string
    profilePhoto: string
    preferredDomain: string
    preferredTargetRole: string
    preferredJobType: string
    preferredLocation: string
    workPreference: string
    learningLanguage: string
    emailNotifications: boolean
    interviewReminders: boolean
    mockInterviewReminders: boolean
    reportNotifications: boolean
    jobAlerts: boolean
    resumeUploadReminders: boolean
    skillImprovementReminders: boolean
    inactiveUserReminders: boolean
    emailReminderFrequency: 'daily' | 'every_3_days' | 'weekly'
    profileVisibility: string
    completenessReminders: boolean
    consentAnalysis: boolean
    consentRecommendations: boolean
    themeMode: string
    autoConfirmField: boolean
    preferredInterviewLanguage: string
    defaultLanding: string
    defaultResumeId: string
  }
  const defaultSettings: StudentLocalSettings = {
    phone: '',
    profilePhoto: '',
    preferredDomain: '',
    preferredTargetRole: '',
    preferredJobType: 'hybrid',
    preferredLocation: '',
    workPreference: 'full-time',
    learningLanguage: 'both',
    emailNotifications: true,
    interviewReminders: true,
    mockInterviewReminders: true,
    reportNotifications: true,
    jobAlerts: true,
    resumeUploadReminders: true,
    skillImprovementReminders: true,
    inactiveUserReminders: true,
    emailReminderFrequency: 'every_3_days',
    profileVisibility: 'private',
    completenessReminders: true,
    consentAnalysis: true,
    consentRecommendations: true,
    themeMode: 'system',
    autoConfirmField: false,
    preferredInterviewLanguage: 'English',
    defaultLanding: 'dashboard',
    defaultResumeId: '',
  }
  const [settings, setSettings] = useState<StudentLocalSettings>(() => {
    if (typeof window === 'undefined') {
      return defaultSettings
    }
    try {
      return {
        ...defaultSettings,
        ...JSON.parse(window.localStorage.getItem(settingsKey) ?? '{}'),
      }
    } catch {
      return defaultSettings
    }
  })

  useEffect(() => {
    void studentApi.getProfile()
      .then((savedProfile) => {
        const normalized = normalizeStudentProfile(savedProfile)
        setProfile(normalized)
        setSettings((current) => ({
          ...current,
          phone: current.phone || normalized.phone,
          profilePhoto: current.profilePhoto || normalized.profilePhoto,
          preferredDomain: current.preferredDomain || normalized.confirmedDomain || normalized.activeDomain,
          preferredTargetRole: current.preferredTargetRole || normalized.preferredJobRole,
          preferredLocation: current.preferredLocation || normalized.currentLocation,
          emailNotifications: normalized.notificationPreferences?.emailRemindersEnabled ?? current.emailNotifications,
          completenessReminders: normalized.notificationPreferences?.profileCompletionReminder ?? current.completenessReminders,
          resumeUploadReminders: normalized.notificationPreferences?.resumeUploadReminder ?? current.resumeUploadReminders,
          skillImprovementReminders: normalized.notificationPreferences?.skillImprovementReminder ?? current.skillImprovementReminders,
          interviewReminders: normalized.notificationPreferences?.interviewPreparationReminder ?? current.interviewReminders,
          mockInterviewReminders: normalized.notificationPreferences?.mockInterviewReminder ?? current.mockInterviewReminders,
          reportNotifications: normalized.notificationPreferences?.reportReadyNotification ?? current.reportNotifications,
          jobAlerts: normalized.notificationPreferences?.jobRecommendationReminder ?? current.jobAlerts,
          inactiveUserReminders: normalized.notificationPreferences?.inactiveUserReminder ?? current.inactiveUserReminders,
          emailReminderFrequency: normalized.notificationPreferences?.frequency ?? current.emailReminderFrequency,
        }))
      })
      .catch(() => setStatus('Could not load all profile-backed settings. You can still save local preferences.'))
      .finally(() => setLoading(false))
  }, [])

  const setField = (field: string, value: string | boolean) => {
    setSettings((current) => ({ ...current, [field]: value }))
  }

  const saveSettings = async () => {
    try {
      setStatus('')
      window.localStorage.setItem(settingsKey, JSON.stringify(settings))
      if (settings.themeMode === 'light' || settings.themeMode === 'dark') {
        document.documentElement.setAttribute('data-theme', settings.themeMode)
        window.localStorage.setItem('interview-prep-theme', settings.themeMode)
      }
      const nextProfilePayload = {
        name: session?.user.name ?? profile.name,
        email: session?.user.email ?? profile.email,
        phone: String(settings.phone ?? profile.phone),
        profilePhoto: String(settings.profilePhoto ?? profile.profilePhoto),
        currentLocation: String(settings.preferredLocation ?? profile.currentLocation),
        preferredJobRole: String(settings.preferredTargetRole ?? profile.preferredJobRole),
        confirmedDomain: settings.preferredDomain || profile.confirmedDomain,
        notificationPreferences: {
          emailRemindersEnabled: Boolean(settings.emailNotifications),
          profileCompletionReminder: Boolean(settings.completenessReminders),
          resumeUploadReminder: Boolean(settings.resumeUploadReminders),
          skillImprovementReminder: Boolean(settings.skillImprovementReminders),
          interviewPreparationReminder: Boolean(settings.interviewReminders),
          mockInterviewReminder: Boolean(settings.mockInterviewReminders),
          reportReadyNotification: Boolean(settings.reportNotifications),
          jobRecommendationReminder: Boolean(settings.jobAlerts),
          inactiveUserReminder: Boolean(settings.inactiveUserReminders),
          frequency: settings.emailReminderFrequency,
        },
      }
      const savedProfile = normalizeStudentProfile(await studentApi.updateProfile(nextProfilePayload))
      setProfile(savedProfile)
      if (session) {
        authApi.setSession({
          ...session,
          user: {
            ...session.user,
            name: String(nextProfilePayload.name),
            email: String(nextProfilePayload.email),
          },
        })
      }
      setStatus('Settings saved successfully. Career preferences and platform behavior will apply on your next related actions.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save settings.')
    }
  }

  const resetLocalPreferences = () => {
    window.localStorage.removeItem(settingsKey)
    setSettings(defaultSettings)
    setStatus('Local preferences cleared. Reload the page to restore profile-based defaults.')
  }

  const sectionClassName = 'student-settings-section space-y-5 rounded-3xl border p-5'
  const inputClassName = 'student-settings-input w-full rounded-2xl border px-3.5 py-3 text-sm outline-none transition'
  const selectClassName = `${inputClassName} pr-10`
  const helperClassName = 'student-settings-helper text-xs'
  const titleClassName = 'student-settings-section-title text-base font-semibold'

  const SettingsSection = ({
    title,
    description,
    children,
  }: {
    title: string
    description: string
    children: ReactNode
  }) => (
    <section className={sectionClassName}>
      <div className="space-y-1 border-b border-current/10 pb-4">
        <h3 className={titleClassName}>{title}</h3>
        <p className="student-settings-section-copy text-sm">{description}</p>
      </div>
      {children}
    </section>
  )

  const SettingsField = ({
    label,
    helper,
    children,
  }: {
    label: string
    helper?: string
    children: ReactNode
  }) => (
    <div className="space-y-2">
      <label className="student-settings-label block text-xs font-semibold uppercase tracking-[0.18em]">{label}</label>
      {children}
      {helper ? <p className={helperClassName}>{helper}</p> : null}
    </div>
  )

  const SettingsToggle = ({
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
    <label className="student-settings-toggle-row flex cursor-pointer items-start justify-between gap-4 rounded-2xl border px-4 py-3.5">
      <span className="min-w-0 flex-1">
        <span className="student-settings-toggle-label block text-sm font-medium">{label}</span>
        <span className="student-settings-helper mt-1 block text-xs">{helper}</span>
      </span>
      <span className="relative mt-0.5 inline-flex flex-shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="student-settings-switch-track h-7 w-12 rounded-full border transition peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-400/20 peer-checked:bg-[var(--accent-primary)]" />
        <span className="student-settings-switch-thumb pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full transition peer-checked:translate-x-5" />
      </span>
    </label>
  )

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Manage account details, career preferences, notifications, privacy, and platform behavior." />
      <Card className="student-settings-overview grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="student-settings-overview-card rounded-2xl border p-4"><p className="student-settings-overview-label text-xs uppercase tracking-wide">Active field</p><p className="mt-1 text-sm font-semibold">{profile.confirmedDomainLabel || profile.activeDomainLabel || 'General Fresher'}</p></div>
        <div className="student-settings-overview-card rounded-2xl border p-4"><p className="student-settings-overview-label text-xs uppercase tracking-wide">Preferred role</p><p className="mt-1 text-sm font-semibold">{String(settings.preferredTargetRole || profile.preferredJobRole || 'Not set')}</p></div>
        <div className="student-settings-overview-card rounded-2xl border p-4"><p className="student-settings-overview-label text-xs uppercase tracking-wide">Learning language</p><p className="mt-1 text-sm font-semibold">{String(settings.learningLanguage)}</p></div>
        <div className="student-settings-overview-card rounded-2xl border p-4"><p className="student-settings-overview-label text-xs uppercase tracking-wide">Default resume</p><p className="mt-1 text-sm font-semibold">{resumes.find((resume) => getId(resume as ApiRecord) === settings.defaultResumeId)?.fileName ?? latest(resumes)?.fileName ?? 'No resume selected'}</p></div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsSection title="Account Settings" description="Manage personal contact details used across your student account.">
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsField label="Full name" helper="Your display name comes from your account session.">
              <input value={session?.user.name ?? profile.name} readOnly className={inputClassName} />
            </SettingsField>
            <SettingsField label="Email" helper="Your primary login email cannot be changed here yet.">
              <input value={session?.user.email ?? profile.email} readOnly className={inputClassName} />
            </SettingsField>
            <SettingsField label="Phone number" helper="Used for contact context and profile completeness.">
              <input value={String(settings.phone)} onChange={(event) => setField('phone', event.target.value)} className={inputClassName} />
            </SettingsField>
            <SettingsField label="Profile photo URL" helper="Optional photo link for future account display use.">
              <input value={String(settings.profilePhoto)} onChange={(event) => setField('profilePhoto', event.target.value)} className={inputClassName} />
            </SettingsField>
          </div>
          <div className="student-settings-note rounded-2xl border px-4 py-3 text-xs">
            Password, email, and account deletion controls still need backend security endpoints, so this page keeps those actions honest instead of pretending they already work.
          </div>
        </SettingsSection>

        <SettingsSection title="Career Preferences" description="These choices influence future recommendations, role suggestions, and guided preparation.">
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsField label="Preferred field or domain" helper="Leave this blank to continue using your detected field.">
              <AppSelect
                value={String(settings.preferredDomain)}
                onChange={(value) => setField('preferredDomain', value)}
                options={[
                  { value: '', label: 'Use current detected field' },
                  ...domainOptions.map((option) => ({ value: option.key, label: option.label })),
                ]}
                className={selectClassName}
              />
            </SettingsField>
            <SettingsField label="Preferred target role" helper="Example: Backend Developer, Finance Analyst, Marketing Associate.">
              <input value={String(settings.preferredTargetRole)} onChange={(event) => setField('preferredTargetRole', event.target.value)} className={inputClassName} />
            </SettingsField>
            <SettingsField label="Preferred job type" helper="Choose where you want to work most often.">
              <AppSelect
                value={String(settings.preferredJobType)}
                onChange={(value) => setField('preferredJobType', value)}
                options={asSelectOptions([
                  { value: 'onsite', label: 'On-site' },
                  { value: 'hybrid', label: 'Hybrid' },
                  { value: 'remote', label: 'Remote' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
            <SettingsField label="Preferred job location" helper="City, region, or preferred hiring market.">
              <input value={String(settings.preferredLocation)} onChange={(event) => setField('preferredLocation', event.target.value)} className={inputClassName} />
            </SettingsField>
            <SettingsField label="Internship or full-time" helper="Tell CareerCompass what opportunity type to prioritize.">
              <AppSelect
                value={String(settings.workPreference)}
                onChange={(value) => setField('workPreference', value)}
                options={asSelectOptions([
                  { value: 'internship', label: 'Internship' },
                  { value: 'full-time', label: 'Full-time' },
                  { value: 'both', label: 'Both' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
            <SettingsField label="Preferred learning language" helper="Used for study material and preparation guidance where supported.">
              <AppSelect
                value={String(settings.learningLanguage)}
                onChange={(value) => setField('learningLanguage', value)}
                options={asSelectOptions([
                  { value: 'english', label: 'English' },
                  { value: 'hindi', label: 'Hindi' },
                  { value: 'both', label: 'Both' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
          </div>
        </SettingsSection>

        <SettingsSection title="Resume and Profile Preferences" description="Choose how the platform should use your resume and remind you about incomplete setup.">
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsField label="Default selected resume" helper="If not chosen, CareerCompass will use your latest uploaded resume." >
              <AppSelect
                value={String(settings.defaultResumeId)}
                onChange={(value) => setField('defaultResumeId', value)}
                options={[
                  { value: '', label: 'Use latest uploaded resume' },
                  ...resumes.map((resume) => ({ value: getId(resume as ApiRecord), label: String((resume as ApiRecord).fileName) })),
                ]}
                className={selectClassName}
              />
            </SettingsField>
            <div className="space-y-3 md:col-span-2">
              <SettingsToggle
                label="Profile completeness reminders"
                helper="Get nudges when key profile details are still missing."
                checked={Boolean(settings.completenessReminders)}
                onChange={(checked) => setField('completenessReminders', checked)}
              />
              <SettingsToggle
                label="Auto-confirm detected field"
                helper="Automatically keep the detected field unless you manually change it."
                checked={Boolean(settings.autoConfirmField)}
                onChange={(checked) => setField('autoConfirmField', checked)}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Notification Preferences" description="Control reminders and alerts for preparation, reports, and job recommendations.">
          <div className="grid gap-3">
            {[
              ['emailNotifications', 'Email notifications', 'Allow CareerCompass to send account and preparation emails.'],
              ['resumeUploadReminders', 'Resume upload reminders', 'Get reminders when resume setup is still incomplete.'],
              ['skillImprovementReminders', 'Skill improvement reminders', 'Follow up on missing skills highlighted in your reports.'],
              ['interviewReminders', 'Interview preparation reminders', 'Receive prompts to continue question practice.'],
              ['mockInterviewReminders', 'Mock interview reminders', 'Stay consistent with mock interview sessions.'],
              ['reportNotifications', 'Report generation notifications', 'Be notified when a new report is ready to review.'],
              ['jobAlerts', 'Job recommendation alerts', 'Receive updates when relevant opportunities appear.'],
              ['inactiveUserReminders', 'Inactive user reminders', 'Get a reminder after longer inactivity.'],
            ].map(([key, label, helper]) => (
              <SettingsToggle
                key={key}
                label={label}
                helper={helper}
                checked={Boolean(settings[key as keyof typeof settings])}
                onChange={(checked) => setField(key, checked)}
              />
            ))}
            <div className="student-settings-inline-panel grid gap-3 rounded-2xl border px-4 py-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
              <div className="space-y-1">
                <p className="student-settings-toggle-label text-sm font-medium">Reminder frequency</p>
                <p className="student-settings-helper text-xs">Choose how often CareerCompass can follow up when an important step is still pending.</p>
              </div>
              <AppSelect
                value={String(settings.emailReminderFrequency)}
                onChange={(value) => setField('emailReminderFrequency', value as StudentLocalSettings['emailReminderFrequency'])}
                options={asSelectOptions([
                  { value: 'daily', label: 'Daily' },
                  { value: 'every_3_days', label: 'Every 3 days' },
                  { value: 'weekly', label: 'Weekly' },
                ])}
                className={selectClassName}
              />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Privacy and Security" description="Choose how your profile and analysis preferences should behave inside the platform.">
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsField label="Profile visibility" helper="Control how your account is used for internal platform guidance.">
              <AppSelect
                value={String(settings.profileVisibility)}
                onChange={(value) => setField('profileVisibility', value)}
                options={asSelectOptions([
                  { value: 'private', label: 'Private to me' },
                  { value: 'career_compass', label: 'Visible for platform guidance' },
                  { value: 'recruiter_ready', label: 'Visible when recruiter features are enabled' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
            <div className="space-y-3 md:col-span-2">
              <SettingsToggle
                label="Consent for analysis"
                helper="Allow the platform to analyze your resume and profile details."
                checked={Boolean(settings.consentAnalysis)}
                onChange={(checked) => setField('consentAnalysis', checked)}
              />
              <SettingsToggle
                label="Consent for recommendations"
                helper="Allow CareerCompass to generate role, skill, and preparation recommendations."
                checked={Boolean(settings.consentRecommendations)}
                onChange={(checked) => setField('consentRecommendations', checked)}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={resetLocalPreferences} className="student-settings-secondary-button rounded-2xl border px-4 py-3 text-sm font-medium">Clear local preferences</button>
            <button type="button" disabled className="student-settings-danger-button rounded-2xl border px-4 py-3 text-sm font-medium disabled:opacity-70">Delete account (coming from backend)</button>
          </div>
        </SettingsSection>

        <SettingsSection title="Platform Preferences" description="Set how CareerCompass should feel and which page should become your default starting point.">
          <div className="grid gap-3 md:grid-cols-2">
            <SettingsField label="Theme mode" helper="Choose how the application should appear by default.">
              <AppSelect
                value={String(settings.themeMode)}
                onChange={(value) => setField('themeMode', value)}
                options={asSelectOptions([
                  { value: 'system', label: 'Use current theme' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
            <SettingsField label="Preferred interview language" helper="Use this as your default practice language when supported.">
              <AppSelect
                value={String(settings.preferredInterviewLanguage)}
                onChange={(value) => setField('preferredInterviewLanguage', value)}
                options={asSelectOptions([
                  { value: 'English', label: 'English' },
                  { value: 'Hindi', label: 'Hindi' },
                  { value: 'Both', label: 'Both' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
            <SettingsField label="Default landing page" helper="Pick the workspace you want to open to most often.">
              <AppSelect
                value={String(settings.defaultLanding)}
                onChange={(value) => setField('defaultLanding', value)}
                options={asSelectOptions([
                  { value: 'dashboard', label: 'Home Dashboard' },
                  { value: 'reports', label: 'My Reports' },
                  { value: 'upload-resume', label: 'Upload Resume' },
                  { value: 'interview-prep', label: 'Interview Preparation' },
                ])}
                className={selectClassName}
              />
            </SettingsField>
          </div>
        </SettingsSection>
      </div>

      <Card className="student-settings-savebar flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="student-settings-save-title font-semibold">Save changes</p>
          <p className="student-settings-section-copy text-sm">Profile-backed settings update recommendations. Local settings personalize notifications and platform behavior.</p>
          {status ? <p className="student-settings-status mt-2 text-sm">{status}</p> : null}
        </div>
        <button onClick={() => void saveSettings()} disabled={loading} className="student-settings-save-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-60">
          {loading ? 'Loading settings...' : 'Save Settings'}
        </button>
      </Card>
    </div>
  )
}

export const StudentFallbackPage = () => (
  <Card>
    <p className="text-slate-600">Feature under progress.</p>
  </Card>
)
