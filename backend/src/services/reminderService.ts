import { EmailReminderLog, MockInterview, Profile, RecommendationSnapshot, Report, Resume, SkillGapReport } from '../models/CoreModels'
import { User } from '../models/User'
import { env } from '../config/env'
import { emailService } from './emailService'

type ReminderType =
  | 'profile_completion'
  | 'resume_upload'
  | 'skill_improvement'
  | 'interview_preparation'
  | 'mock_interview'
  | 'report_ready'
  | 'job_recommendation'
  | 'inactive_user'

type ReminderCandidate = {
  userId: string
  email: string
  name: string
  reminderType: ReminderType
  subject: string
  preview: string
  actionPath: string
  contextKey?: string
  metadata?: Record<string, unknown>
}

const frequencyToDays = (value: unknown): number => {
  if (value === 'daily') return 1
  if (value === 'weekly') return 7
  return 3
}

const completionFields = [
  'phone',
  'currentLocation',
  'professionalHeadline',
  'summary',
  'collegeName',
  'degree',
  'branch',
  'graduationYear',
  'cgpaOrPercentage',
  'preferredJobRole',
]

const listFields = ['skills', 'technicalSkills', 'softSkills', 'projects', 'strengths']

const deriveCompletion = (profile: Record<string, unknown> | null) => {
  if (!profile) {
    return { completion: 0, missingFields: ['profile details'] }
  }

  const missingFields = [
    ...completionFields.filter((field) => !profile[field]),
    ...listFields.filter((field) => !Array.isArray(profile[field]) || !(profile[field] as unknown[]).length),
  ]
  const totalChecks = completionFields.length + listFields.length
  const completion = Math.round(((totalChecks - missingFields.length) / totalChecks) * 100)
  return { completion, missingFields }
}

const buildEmailHtml = (candidate: ReminderCandidate) => `
  <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#24364b">
    <p>Hello ${candidate.name || 'there'},</p>
    <p>${candidate.preview}</p>
    <p>
      <a href="${env.appBaseUrl}${candidate.actionPath}" style="display:inline-block;padding:10px 16px;border-radius:10px;background:#ff7a1a;color:#ffffff;text-decoration:none;font-weight:600">
        Open CareerCompass
      </a>
    </p>
    <p style="color:#607489;font-size:14px">This reminder was sent based on your current CareerCompass activity and notification preferences.</p>
  </div>
`

const buildEmailText = (candidate: ReminderCandidate) =>
  `Hello ${candidate.name || 'there'},\n\n${candidate.preview}\n\nOpen CareerCompass: ${env.appBaseUrl}${candidate.actionPath}\n`

const shouldRespectPreference = (preferences: Record<string, unknown>, type: ReminderType): boolean => {
  if (preferences.emailRemindersEnabled === false) return false
  const map: Record<ReminderType, string> = {
    profile_completion: 'profileCompletionReminder',
    resume_upload: 'resumeUploadReminder',
    skill_improvement: 'skillImprovementReminder',
    interview_preparation: 'interviewPreparationReminder',
    mock_interview: 'mockInterviewReminder',
    report_ready: 'reportReadyNotification',
    job_recommendation: 'jobRecommendationReminder',
    inactive_user: 'inactiveUserReminder',
  }
  return preferences[map[type]] !== false
}

const canSendReminder = async (candidate: ReminderCandidate, cooldownDays: number): Promise<boolean> => {
  const cutoff = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000)
  const existing = await EmailReminderLog.findOne({
    userId: candidate.userId,
    reminderType: candidate.reminderType,
    contextKey: candidate.contextKey ?? 'default',
    sentAt: { $gte: cutoff },
  }).lean()
  return !existing
}

const logReminder = async (candidate: ReminderCandidate) => {
  await EmailReminderLog.create({
    userId: candidate.userId,
    email: candidate.email,
    reminderType: candidate.reminderType,
    subject: candidate.subject,
    contextKey: candidate.contextKey ?? 'default',
    metadata: candidate.metadata ?? {},
    sentAt: new Date(),
  })
}

const sendReminder = async (candidate: ReminderCandidate, cooldownDays: number) => {
  if (!(await canSendReminder(candidate, cooldownDays))) return false
  const result = await emailService.send({
    to: candidate.email,
    subject: candidate.subject,
    text: buildEmailText(candidate),
    html: buildEmailHtml(candidate),
  })
  if (!result.delivered) return false
  await logReminder(candidate)
  return true
}

export const reminderService = {
  async sendReportReadyNotification(input: {
    userId: string
    reportType: string
    title: string
    summary: string
    actionPath: string
    contextKey?: string
  }): Promise<void> {
    const [user, profile] = await Promise.all([
      User.findById(input.userId).lean<Record<string, unknown>>(),
      Profile.findOne({ userId: input.userId }).lean<Record<string, unknown>>(),
    ])
    if (!user?.email) return
    const preferences = (profile?.notificationPreferences ?? {}) as Record<string, unknown>
    if (!shouldRespectPreference(preferences, 'report_ready')) return

    await sendReminder(
      {
        userId: String(user._id),
        email: String(user.email),
        name: String(user.name ?? 'there'),
        reminderType: 'report_ready',
        subject: `Your ${input.reportType} is ready in CareerCompass`,
        preview: input.summary || `${input.title} is ready to review in CareerCompass.`,
        actionPath: input.actionPath,
        contextKey: input.contextKey ?? `${input.reportType}:${input.title}`,
        metadata: { reportType: input.reportType, title: input.title },
      },
      1,
    )
  },

  async runScheduledReminders(): Promise<{ checked: number; sent: number }> {
    const users = await User.find({ role: 'student' }).lean<Array<Record<string, unknown>>>()
    let checked = 0
    let sent = 0

    for (const user of users) {
      checked += 1
      const userId = String(user._id ?? '')
      const [profile, resumes, latestSkillGap, latestMock, latestRecommendation, latestPrep] = await Promise.all([
        Profile.findOne({ userId }).lean<Record<string, unknown>>(),
        Resume.find({ userId }).sort({ createdAt: -1 }).limit(1).lean<Array<Record<string, unknown>>>(),
        SkillGapReport.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>(),
        MockInterview.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>(),
        RecommendationSnapshot.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>(),
        Report.findOne({ userId, reportType: 'Interview Preparation' }).sort({ createdAt: -1 }).lean<Record<string, unknown>>(),
      ])

      const email = String(user.email ?? '').trim()
      if (!email) continue
      const preferences = (profile?.notificationPreferences ?? {}) as Record<string, unknown>
      const cooldownDays = frequencyToDays(preferences.frequency)
      const completionState = deriveCompletion(profile)
      const completion = completionState.completion
      const missingFields = completionState.missingFields
      const hasResume = resumes.length > 0
      const skillGapContent = (latestSkillGap?.content ?? {}) as Record<string, unknown>
      const missingSkills = [
        ...((skillGapContent.gaps ?? []) as Array<Record<string, unknown>>).map((item) => String(item.skill ?? '').trim()).filter(Boolean),
        ...((skillGapContent.missingSkills ?? []) as string[]),
      ].filter(Boolean)
      const lastActiveAt = user.lastActiveAt ? new Date(String(user.lastActiveAt)) : null
      const inactiveDays = lastActiveAt ? (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24) : 999

      const candidates: ReminderCandidate[] = []

      if (shouldRespectPreference(preferences, 'profile_completion') && completion < 80) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'profile_completion',
          subject: 'Complete your profile to unlock better recommendations',
          preview: `Your profile is about ${completion || 0}% complete. Add ${missingFields.slice(0, 3).join(', ') || 'key profile details'} to improve recommendation quality.`,
          actionPath: '/student/profile',
        })
      }

      if (shouldRespectPreference(preferences, 'resume_upload') && !hasResume) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'resume_upload',
          subject: 'Upload your resume to unlock personalized guidance',
          preview: 'Add your resume to receive role recommendations, skill gap analysis, and interview preparation tailored to your current profile.',
          actionPath: '/student/upload-resume',
        })
      }

      if (hasResume && shouldRespectPreference(preferences, 'skill_improvement') && missingSkills.length) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'skill_improvement',
          subject: 'A few important skills still need attention',
          preview: `Your latest skill gap report still highlights ${missingSkills.slice(0, 3).join(', ')}. Improving one of these can strengthen job readiness.`,
          actionPath: '/student/skill-gap',
          contextKey: `skill-gap:${missingSkills[0]}`,
        })
      }

      if (hasResume && shouldRespectPreference(preferences, 'interview_preparation') && !latestPrep) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'interview_preparation',
          subject: 'Continue your interview preparation',
          preview: 'You already have enough profile data to start interview preparation. Generate practice questions based on your field and target role.',
          actionPath: '/student/interview-prep',
        })
      }

      if (hasResume && shouldRespectPreference(preferences, 'mock_interview') && !latestMock) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'mock_interview',
          subject: 'Try a mock interview to build confidence',
          preview: 'A mock interview can help you practice role-based answers and identify weak areas before real interviews.',
          actionPath: '/student/mock-interview',
        })
      }

      if (hasResume && shouldRespectPreference(preferences, 'job_recommendation') && !latestRecommendation) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'job_recommendation',
          subject: 'New career suggestions are waiting for your profile',
          preview: 'Generate field-aware recommendations to see which roles fit your current skills and what to improve next.',
          actionPath: '/student/job-match',
        })
      }

      if (shouldRespectPreference(preferences, 'inactive_user') && inactiveDays >= 7) {
        candidates.push({
          userId,
          email,
          name: String(user.name ?? 'there'),
          reminderType: 'inactive_user',
          subject: 'Return to CareerCompass and continue your preparation',
          preview: 'You have been away for a few days. Review your latest progress, continue interview preparation, or complete the next important career step.',
          actionPath: '/student/dashboard',
          contextKey: `inactive:${Math.floor(inactiveDays / 7)}`,
          metadata: { inactiveDays: Math.floor(inactiveDays) },
        })
      }

      for (const candidate of candidates) {
        if (await sendReminder(candidate, cooldownDays)) {
          sent += 1
        }
      }
    }

    return { checked, sent }
  },
}

let schedulerStarted = false

export const startReminderScheduler = () => {
  if (schedulerStarted) return
  schedulerStarted = true

  const run = async () => {
    try {
      const result = await reminderService.runScheduledReminders()
      console.log(`[reminders] checked=${result.checked} sent=${result.sent}`)
    } catch (error) {
      console.error('[reminders] sweep failed', error)
    }
  }

  setTimeout(() => void run(), 30_000)
  setInterval(() => void run(), env.reminderSweepIntervalMs)
}
