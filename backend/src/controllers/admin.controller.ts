import type { Request, Response } from 'express'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { AdminActivityLog } from '../models/AdminActivityLog'
import { AdminSetting } from '../models/AdminSetting'
import { CodingProblem } from '../models/CodingProblem'
import { ContactRequest } from '../models/ContactRequest'
import { CodingTestSession, EmailReminderLog, InterviewQuestion, JobDescription, MockInterviewSession, Profile, RecommendationSnapshot, Report, Resume } from '../models/CoreModels'
import { PlatformField } from '../models/PlatformField'
import { PlatformNotification } from '../models/PlatformNotification'
import { RecruiterProfile } from '../models/RecruiterProfile'
import { User } from '../models/User'
import { domainOptions } from '../services/domainService'
import { codingQuestionBankService } from '../services/codingQuestionBankService'
import { interviewQuestionBankService } from '../services/interviewQuestionBankService'
import { env } from '../config/env'
import { ApiError } from '../utils/ApiError'
import { adminCreateUserSchema } from '../validators/schemas'

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []

const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const unique = (values: string[]) => Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))

const defaultAdminSettings = {
  emailSettings: {
    notificationsEmail: env.emailFrom,
    smtpConfigured: Boolean(env.emailHost && env.emailUser && env.emailPass),
    senderName: env.emailFromName,
    senderEmail: env.emailFrom,
  },
  notificationPreferences: {
    unreadContactAlerts: true,
    reportFailureAlerts: true,
    weeklyAdminSummary: true,
    recruiterApprovalAlerts: true,
    flaggedUploadAlerts: true,
  },
  branding: {
    applicationName: 'CareerCompass',
    supportEmail: env.emailFrom,
  },
  systemPreferences: {
    defaultTheme: 'light',
    reminderSweepEnabled: true,
    fieldConfirmationRequired: true,
    reminderFrequency: 'weekly',
  },
  reminderTemplates: {
    profileCompletion: 'Complete your profile to unlock better role and skill guidance.',
    recruiterApproval: 'Your recruiter request is being reviewed by the CareerCompass admin team.',
    reportReady: 'A new CareerCompass report is ready for review in your dashboard.',
  },
  featureToggles: {
    codingRoundEnabled: true,
    mockInterviewEnabled: true,
    contactPageEnabled: true,
  },
}

const ensurePlatformFields = async () => {
  const count = await PlatformField.countDocuments()
  if (count > 0) return

  await PlatformField.insertMany(domainOptions.map((option) => ({
    key: option.key,
    label: option.label,
    description: `${option.label} guidance and role support within CareerCompass.`,
    active: true,
    roles: option.defaultRoles.map((label) => ({ label, active: true })),
  })))
}

const ensureAdminSettings = async () => {
  const existing = await AdminSetting.findOne({ key: 'platform' }).lean<Record<string, unknown> | null>()
  if (existing) return existing
  const created = await AdminSetting.create({ key: 'platform', value: defaultAdminSettings })
  return created.toObject() as unknown as Record<string, unknown>
}

const roleLabelFromProfile = (profile: Record<string, unknown> | null) =>
  String(profile?.preferredJobRole ?? profile?.targetRole ?? '').trim()

const fieldLabelFromProfile = (profile: Record<string, unknown> | null) => {
  const confirmed = String(profile?.confirmedDomain ?? '').trim()
  if (confirmed) return confirmed
  const detected = Array.isArray(profile?.detectedDomains) ? profile?.detectedDomains[0] as Record<string, unknown> : null
  return String(detected?.key ?? 'general_fresher')
}

const getLatestReadinessScore = (reports: Array<Record<string, unknown>>) => {
  const latest = reports[0]
  if (!latest) return 0
  const payload = (latest.payload ?? {}) as Record<string, unknown>
  return Number(payload.score ?? payload.readinessScore ?? payload.finalScore ?? 0)
}

const mapInterviewQuestionForAdmin = (question: Record<string, unknown>) => ({
  id: String(question._id ?? ''),
  bankId: String(question.bankId ?? ''),
  field: String(question.field ?? question.domain ?? ''),
  role: String(question.role ?? ''),
  category: String(question.category ?? ''),
  topic: String(question.topic ?? ''),
  difficulty: String(question.difficulty ?? 'Intermediate'),
  companyType: String(question.companyType ?? 'general'),
  experienceLevel: String(question.experienceLevel ?? 'fresher'),
  questionText: String(question.questionText ?? ''),
  answerHint: String(question.answerHint ?? ''),
  keyPoints: toStringArray(question.keyPoints),
  commonMistakes: toStringArray(question.commonMistakes),
  tags: toStringArray(question.tags),
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
  source: 'admin',
})

const mapCodingProblemForAdmin = (problem: Record<string, unknown>) => ({
  id: String(problem._id ?? ''),
  problemId: String(problem.problemId ?? ''),
  domain: String(problem.domain ?? ''),
  role: String(problem.role ?? ''),
  topic: String(problem.topic ?? ''),
  difficulty: String(problem.difficulty ?? 'Intermediate'),
  title: String(problem.title ?? ''),
  problemStatement: String(problem.problemStatement ?? ''),
  inputFormat: String(problem.inputFormat ?? ''),
  outputFormat: String(problem.outputFormat ?? ''),
  constraints: toStringArray(problem.constraints),
  sampleInput: String(problem.sampleInput ?? ''),
  sampleOutput: String(problem.sampleOutput ?? ''),
  explanation: String(problem.explanation ?? ''),
  supportedLanguages: toStringArray(problem.supportedLanguages),
  timeLimit: Number(problem.timeLimit ?? 2),
  memoryLimit: Number(problem.memoryLimit ?? 256),
  visibleTestCases: Array.isArray(problem.visibleTestCases) ? problem.visibleTestCases : [],
  hiddenTestCases: Array.isArray(problem.hiddenTestCases) ? problem.hiddenTestCases : [],
  tags: toStringArray(problem.tags),
  createdAt: problem.createdAt,
  updatedAt: problem.updatedAt,
  source: 'admin',
})

const logAdminActivity = async (
  req: Request,
  entry: {
    actionType: string
    entityType: string
    entityId?: string
    title: string
    description: string
    metadata?: Record<string, unknown>
  },
) => {
  await AdminActivityLog.create({
    adminUserId: req.user?.userId ?? null,
    actionType: entry.actionType,
    entityType: entry.entityType,
    entityId: entry.entityId ?? '',
    title: entry.title,
    description: entry.description,
    metadata: entry.metadata ?? {},
  })
}

export const getAdminOverview = async (_req: Request, res: Response): Promise<void> => {
  await ensurePlatformFields()
  await ensureAdminSettings()

  const [
    totalUsers,
    activeUsers,
    newRegistrations,
    resumesUploaded,
    totalReportsGenerated,
    totalMockInterviews,
    totalCodingTests,
    totalJobListings,
    unreadContactMessages,
    pendingNotifications,
    pendingRecruiterApprovals,
    flaggedUploads,
    users,
    reports,
    skillGapReports,
    recentResumes,
    contacts,
    mockSessions,
    codingSessions,
    notificationsSent,
    recruiterProfiles,
    recruiterUsers,
    activityLogs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ accountStatus: { $in: [null, 'active'] } }),
    User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } }),
    Resume.countDocuments(),
    Report.countDocuments(),
    MockInterviewSession.countDocuments(),
    CodingTestSession.countDocuments(),
    JobDescription.countDocuments(),
    ContactRequest.countDocuments({ status: 'unread' }),
    PlatformNotification.countDocuments({ active: true }),
    User.countDocuments({ role: 'recruiter', accountStatus: 'pending' }),
    Resume.countDocuments({
      $or: [
        { 'aiAnalysisResult.documentType': { $nin: ['resume', '', null] } },
        { extractedText: { $in: ['', null] } },
      ],
    }),
    User.find().sort({ createdAt: -1 }).limit(10).lean<Array<Record<string, unknown>>>(),
    Report.find().sort({ createdAt: -1 }).limit(25).lean<Array<Record<string, unknown>>>(),
    Report.find({ reportType: /skill gap/i }).sort({ createdAt: -1 }).limit(50).lean<Array<Record<string, unknown>>>(),
    Resume.find().sort({ createdAt: -1 }).limit(8).lean<Array<Record<string, unknown>>>(),
    ContactRequest.find().sort({ createdAt: -1 }).limit(8).lean<Array<Record<string, unknown>>>(),
    MockInterviewSession.find().sort({ createdAt: -1 }).limit(8).lean<Array<Record<string, unknown>>>(),
    CodingTestSession.find().sort({ createdAt: -1 }).limit(8).lean<Array<Record<string, unknown>>>(),
    EmailReminderLog.countDocuments(),
    RecruiterProfile.find().lean<Array<Record<string, unknown>>>(),
    User.find({ role: 'recruiter' }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    AdminActivityLog.find().sort({ createdAt: -1 }).limit(12).lean<Array<Record<string, unknown>>>(),
  ])

  const profiles = await Profile.find().lean<Array<Record<string, unknown>>>()
  const profileMap = new Map(profiles.map((profile) => [String(profile.userId ?? ''), profile]))

  const topActiveFields = Object.entries(
    profiles.reduce<Record<string, number>>((acc, profile) => {
      const key = fieldLabelFromProfile(profile)
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([field, count]) => ({ field, count }))

  const topCommonSkillGaps = Object.entries(
    skillGapReports.reduce<Record<string, number>>((acc, report) => {
      const payload = (report.payload ?? report.content ?? {}) as Record<string, unknown>
      const skills = [
        ...toStringArray(report.missingSkills),
        ...toStringArray(payload.weakSkills),
        ...toStringArray((payload.skillGapAnalysis as Record<string, unknown> | undefined)?.weakRequiredSkills),
      ]
      skills.forEach((skill) => {
        acc[skill] = (acc[skill] ?? 0) + 1
      })
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([skill, count]) => ({ skill, count }))

  const repeatedWeakAreas = Object.entries(
    [...skillGapReports, ...reports].reduce<Record<string, number>>((acc, report) => {
      const payload = (report.payload ?? report.content ?? {}) as Record<string, unknown>
      const weakAreas = [
        ...toStringArray(payload.weakAreas),
        ...toStringArray(payload.repeatedWeakAreas),
        ...toStringArray(payload.weakTopics),
      ]
      weakAreas.forEach((item) => {
        acc[item] = (acc[item] ?? 0) + 1
      })
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }))

  const mostAttemptedInterviewCategories = Object.entries(
    mockSessions.reduce<Record<string, number>>((acc, session) => {
      const key = String(session.interviewType ?? session.domain ?? 'general').trim() || 'general'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }))

  const reportGenerationTrend = Object.entries(
    reports.reduce<Record<string, number>>((acc, report) => {
      const date = new Date(String(report.createdAt ?? ''))
      const key = Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
  )
    .slice(-7)
    .map(([label, count]) => ({ label, count }))

  const recruiterMap = new Map(recruiterProfiles.map((profile) => [String(profile.userId ?? ''), profile]))
  const pendingRecruiters = recruiterUsers
    .filter((user) => String(user.role ?? '') === 'recruiter' && String(user.accountStatus ?? 'active') === 'pending')
    .map((user) => {
      const recruiterProfile = recruiterMap.get(String(user._id))
      return {
        id: String(user._id),
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        phone: String(recruiterProfile?.phone ?? ''),
        company: String(recruiterProfile?.company ?? ''),
        designation: String(recruiterProfile?.designation ?? ''),
        companyWebsite: String(recruiterProfile?.companyWebsite ?? ''),
        createdAt: user.createdAt,
      }
    })

  const activityFeed = [
    ...users.map((user) => ({
      id: `user-${String(user._id)}`,
      type: 'registration',
      title: `${String(user.name ?? 'New user')} joined the platform`,
      description: `${String(user.role ?? 'user')} account created`,
      createdAt: user.createdAt,
    })),
    ...recentResumes.map((resume) => ({
      id: `resume-${String(resume._id)}`,
      type: 'resume',
      title: `${String(resume.fileName ?? 'Resume')} uploaded`,
      description: 'A new resume was added to the system.',
      createdAt: resume.createdAt,
    })),
    ...reports.slice(0, 8).map((report) => ({
      id: `report-${String(report._id)}`,
      type: 'report',
      title: String(report.title ?? report.reportType ?? 'Report generated'),
      description: String(report.summary ?? 'A new report was generated.'),
      createdAt: report.createdAt,
    })),
    ...contacts.map((contact) => ({
      id: `contact-${String(contact._id)}`,
      type: 'contact',
      title: `Contact request from ${String(contact.fullName ?? 'visitor')}`,
      description: String(contact.subject ?? 'New message received'),
      createdAt: contact.createdAt,
    })),
  ]
    .sort((a, b) => new Date(String(b.createdAt ?? '')).getTime() - new Date(String(a.createdAt ?? '')).getTime())
    .slice(0, 12)

  res.json({
    success: true,
    data: {
      stats: {
        totalUsers,
        activeUsers,
        newRegistrations,
        resumesUploaded,
        totalReportsGenerated,
        totalMockInterviews,
        codingTestUsage: totalCodingTests,
        totalJobListings,
        unreadContactMessages,
        pendingNotifications,
        pendingRecruiterApprovals,
        flaggedUploads,
        sentNotifications: notificationsSent,
      },
      topActiveFields,
      topCommonSkillGaps,
      repeatedWeakAreas,
      mostAttemptedInterviewCategories,
      recentActivity: activityFeed,
      adminActivityLogs: activityLogs,
      pendingRecruiters,
      reportGenerationTrend,
      trend: {
        reports: reports.length,
        mockInterviews: mockSessions.length,
        codingTests: codingSessions.length,
        readinessScore: getLatestReadinessScore(reports),
      },
      userHighlights: users.map((user) => {
        const profile = profileMap.get(String(user._id))
        return {
          id: String(user._id),
          name: String(user.name ?? ''),
          role: String(user.role ?? ''),
          email: String(user.email ?? ''),
          field: fieldLabelFromProfile(profile ?? null),
          targetRole: roleLabelFromProfile(profile ?? null),
          accountStatus: String(user.accountStatus ?? 'active'),
          createdAt: user.createdAt,
        }
      }),
    },
  })
}

export const listAdminUsers = async (_req: Request, res: Response): Promise<void> => {
  const [users, studentProfiles, recruiterProfiles, resumes, reports] = await Promise.all([
    User.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    Profile.find().lean<Array<Record<string, unknown>>>(),
    RecruiterProfile.find().lean<Array<Record<string, unknown>>>(),
    Resume.find().lean<Array<Record<string, unknown>>>(),
    Report.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
  ])

  const studentMap = new Map(studentProfiles.map((profile) => [String(profile.userId ?? ''), profile]))
  const recruiterMap = new Map(recruiterProfiles.map((profile) => [String(profile.userId ?? ''), profile]))

  const groupedReports = reports.reduce<Record<string, Array<Record<string, unknown>>>>((acc, report) => {
    const userId = String(report.userId ?? '')
    acc[userId] = [...(acc[userId] ?? []), report]
    return acc
  }, {})

  const groupedResumes = resumes.reduce<Record<string, Array<Record<string, unknown>>>>((acc, resume) => {
    const userId = String(resume.userId ?? '')
    acc[userId] = [...(acc[userId] ?? []), resume]
    return acc
  }, {})

  res.json({
    success: true,
    data: users.map((user) => {
      const id = String(user._id)
      const studentProfile = studentMap.get(id)
      const recruiterProfile = recruiterMap.get(id)
      const userReports = groupedReports[id] ?? []
      const userResumes = groupedResumes[id] ?? []
      return {
        id,
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        role: String(user.role ?? ''),
        accountStatus: String(user.accountStatus ?? 'active'),
        createdManuallyByAdmin: Boolean(user.createdManuallyByAdmin),
        createdBy: String(user.createdBy ?? ''),
        createdByRole: String(user.createdByRole ?? ''),
        forcePasswordReset: Boolean(user.forcePasswordReset),
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        field: fieldLabelFromProfile(studentProfile ?? null),
        targetRole: roleLabelFromProfile(studentProfile ?? null),
        phone: String(studentProfile?.phone ?? user.phone ?? ''),
        completion: Number(studentProfile?.completion ?? 0),
        resumeCount: userResumes.length,
        latestResumeAt: userResumes.sort((a, b) => new Date(String(b.createdAt ?? '')).getTime() - new Date(String(a.createdAt ?? '')).getTime())[0]?.createdAt ?? null,
        reportCount: userReports.length,
        latestReadinessScore: getLatestReadinessScore(userReports),
        company: String(recruiterProfile?.company ?? ''),
        designation: String(recruiterProfile?.designation ?? ''),
        companyWebsite: String(recruiterProfile?.companyWebsite ?? ''),
        recruiterPhone: String(recruiterProfile?.phone ?? ''),
      }
    }),
  })
}

export const createAdminUser = async (req: Request, res: Response): Promise<void> => {
  const payload = adminCreateUserSchema.parse(req.body)
  const email = payload.email.trim().toLowerCase()
  const existing = await User.findOne({ email })
  if (existing) {
    throw new ApiError(409, 'Email already exists')
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10)
  const user = await User.create({
    name: payload.name.trim(),
    email,
    password: hashedPassword,
    role: payload.role,
    phone: 'phone' in payload ? String(payload.phone ?? '').trim() : '',
    accountStatus: 'active',
    createdBy: req.user?.userId ?? null,
    createdByRole: req.user?.role ?? 'admin',
    createdManuallyByAdmin: true,
    forcePasswordReset: Boolean(payload.forcePasswordReset),
  })

  if (payload.role === 'student') {
    await Profile.create({
      userId: user._id,
      phone: String(payload.phone ?? '').trim(),
    })
  }

  if (payload.role === 'recruiter') {
    await RecruiterProfile.create({
      userId: user._id,
      phone: payload.phone.trim(),
      company: payload.company.trim(),
      designation: payload.designation.trim(),
      companyWebsite: String(payload.companyWebsite ?? '').trim(),
    })
  }

  await logAdminActivity(req, {
    actionType: 'admin_created_account',
    entityType: 'user',
    entityId: String(user._id),
    title: `${payload.name.trim()} account created`,
    description: `${email} was created manually as an active ${payload.role} account by an admin.`,
    metadata: {
      createdRole: payload.role,
      accountStatus: 'active',
      createdManuallyByAdmin: true,
      forcePasswordReset: Boolean(payload.forcePasswordReset),
    },
  })

  res.status(201).json({
    success: true,
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus ?? 'active',
      createdManuallyByAdmin: true,
      forcePasswordReset: Boolean(user.forcePasswordReset),
    },
  })
}

export const listAdminStudents = async (_req: Request, res: Response): Promise<void> => {
  const [users, profiles, resumes, reports] = await Promise.all([
    User.find({ role: 'student' }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    Profile.find().lean<Array<Record<string, unknown>>>(),
    Resume.find().lean<Array<Record<string, unknown>>>(),
    Report.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
  ])

  const profileMap = new Map(profiles.map((profile) => [String(profile.userId ?? ''), profile]))
  const groupedResumes = resumes.reduce<Record<string, Array<Record<string, unknown>>>>((acc, resume) => {
    const userId = String(resume.userId ?? '')
    acc[userId] = [...(acc[userId] ?? []), resume]
    return acc
  }, {})
  const groupedReports = reports.reduce<Record<string, Array<Record<string, unknown>>>>((acc, report) => {
    const userId = String(report.userId ?? '')
    acc[userId] = [...(acc[userId] ?? []), report]
    return acc
  }, {})

  res.json({
    success: true,
    data: users.map((user) => {
      const id = String(user._id)
      const profile = profileMap.get(id)
      const userReports = groupedReports[id] ?? []
      const userResumes = groupedResumes[id] ?? []
      return {
        id,
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        accountStatus: String(user.accountStatus ?? 'active'),
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
        field: fieldLabelFromProfile(profile ?? null),
        targetRole: roleLabelFromProfile(profile ?? null),
        completion: Number(profile?.completion ?? 0),
        resumeCount: userResumes.length,
        reportCount: userReports.length,
        latestReadinessScore: getLatestReadinessScore(userReports),
        notificationPreferences: profile?.notificationPreferences ?? {},
      }
    }),
  })
}

export const getAdminStudentDetail = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.params.studentId ?? '')
  const user = await User.findOne({ _id: studentId, role: 'student' }).lean<Record<string, unknown> | null>()
  if (!user) throw new ApiError(404, 'Student not found')

  const [profile, resumes, reports, recommendationSnapshots, mockSessions, codingSessions, emailLogs, platformNotifications] = await Promise.all([
    Profile.findOne({ userId: studentId }).lean<Record<string, unknown> | null>(),
    Resume.find({ userId: studentId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    Report.find({ userId: studentId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    RecommendationSnapshot.find({ userId: studentId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    MockInterviewSession.find({ userId: studentId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    CodingTestSession.find({ userId: studentId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    EmailReminderLog.find({ userId: studentId }).sort({ sentAt: -1 }).lean<Array<Record<string, unknown>>>(),
    PlatformNotification.find({ audience: { $in: ['all', 'students'] }, active: true }).sort({ createdAt: -1 }).limit(12).lean<Array<Record<string, unknown>>>(),
  ])

  const roleRecommendationReports = reports.filter((report) => /recommendation/i.test(String(report.reportType ?? '')))
  const skillGapReports = reports.filter((report) => /skill gap/i.test(String(report.reportType ?? '')))
  const interviewReports = reports.filter((report) => /interview preparation/i.test(String(report.reportType ?? '')))
  const mockReports = reports.filter((report) => /mock interview/i.test(String(report.reportType ?? '')))
  const codingReports = reports.filter((report) => /coding test/i.test(String(report.reportType ?? '')))

  res.json({
    success: true,
    data: {
      student: {
        id: String(user._id ?? ''),
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        accountStatus: String(user.accountStatus ?? 'active'),
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      },
      profile: profile ?? {},
      detectedField: fieldLabelFromProfile(profile ?? null),
      suggestedRoles: unique([
        roleLabelFromProfile(profile ?? null),
        ...roleRecommendationReports.map((report) => String(((report.payload ?? {}) as Record<string, unknown>).targetRole ?? '')),
        ...recommendationSnapshots.flatMap((snapshot) => {
          const payload = (snapshot.payload ?? {}) as Record<string, unknown>
          return [
            String(payload.targetRole ?? ''),
            ...toStringArray(payload.recommendedRoles),
            ...toStringArray(payload.suggestedRoles),
          ]
        }),
      ]).filter(Boolean),
      resumes: resumes.map((resume) => ({
        id: String(resume._id ?? ''),
        fileName: String(resume.fileName ?? ''),
        fileType: String(resume.fileType ?? ''),
        uploadedAt: resume.uploadedDate ?? resume.createdAt,
        extractedSkills: toStringArray(resume.extractedSkills),
        extractedEducation: toStringArray(resume.extractedEducation),
        extractedProjects: toStringArray(resume.extractedProjects),
        extractedExperience: toStringArray(resume.extractedExperience),
        validationStatus: String(((resume.aiAnalysisResult ?? {}) as Record<string, unknown>).documentType ?? 'resume'),
        contentPreview: String(resume.extractedText ?? '').slice(0, 320),
      })),
      jobRecommendations: recommendationSnapshots.map((snapshot) => ({
        id: String(snapshot._id ?? ''),
        language: String(snapshot.language ?? 'both'),
        createdAt: snapshot.createdAt,
        payload: snapshot.payload ?? {},
      })),
      skillGapReports: skillGapReports.map((report) => ({
        id: String(report._id ?? ''),
        title: String(report.title ?? report.reportType ?? ''),
        summary: String(report.summary ?? ''),
        createdAt: report.createdAt,
        payload: report.payload ?? {},
        missingSkills: toStringArray(report.missingSkills),
      })),
      interviewPreparationProgress: interviewReports.map((report) => ({
        id: String(report._id ?? ''),
        title: String(report.title ?? report.reportType ?? ''),
        summary: String(report.summary ?? ''),
        createdAt: report.createdAt,
        payload: report.payload ?? {},
      })),
      mockInterviewHistory: mockSessions.map((session) => ({
        id: String(session._id ?? ''),
        domain: String(session.domain ?? ''),
        targetRole: String(session.targetRole ?? ''),
        interviewType: String(session.interviewType ?? ''),
        difficulty: String(session.difficulty ?? ''),
        score: Number(session.score ?? 0),
        weakAreas: toStringArray(((session.evaluation ?? {}) as Record<string, unknown>).weakAreas),
        recommendedNextSteps: toStringArray(session.recommendedNextSteps),
        createdAt: session.createdAt,
      })),
      codingTestHistory: codingSessions.map((session) => ({
        id: String(session._id ?? ''),
        domain: String(session.domain ?? ''),
        role: String(session.role ?? ''),
        selectedLanguage: String(session.selectedLanguage ?? ''),
        status: String(session.status ?? ''),
        passPercentage: Number(session.passPercentage ?? 0),
        finalScore: Number(session.finalScore ?? 0),
        weakTopics: toStringArray(session.weakTopics),
        recommendedNextSteps: toStringArray(session.recommendedNextSteps),
        createdAt: session.createdAt,
      })),
      reportsHistory: reports.map((report) => ({
        id: String(report._id ?? ''),
        reportType: String(report.reportType ?? ''),
        title: String(report.title ?? ''),
        summary: String(report.summary ?? ''),
        createdAt: report.createdAt,
        payload: report.payload ?? {},
      })),
      notifications: [
        ...emailLogs.map((log) => ({
          id: `email-${String(log._id ?? '')}`,
          type: 'email_reminder',
          title: String(log.subject ?? ''),
          message: String(log.reminderType ?? ''),
          createdAt: log.sentAt,
        })),
        ...platformNotifications.map((notification) => ({
          id: `platform-${String(notification._id ?? '')}`,
          type: 'platform_notification',
          title: String(notification.title ?? ''),
          message: String(notification.message ?? ''),
          createdAt: notification.createdAt,
        })),
      ].sort((a, b) => new Date(String(b.createdAt ?? '')).getTime() - new Date(String(a.createdAt ?? '')).getTime()),
      summary: {
        totalResumes: resumes.length,
        totalReports: reports.length,
        totalMocks: mockSessions.length,
        totalCodingTests: codingSessions.length,
        latestReadinessScore: getLatestReadinessScore(reports),
        latestMockScore: Number(mockSessions[0]?.score ?? 0),
        latestCodingScore: Number(codingSessions[0]?.finalScore ?? 0),
      },
      groupedReports: {
        roleRecommendations: roleRecommendationReports.length,
        skillGap: skillGapReports.length,
        interviewPreparation: interviewReports.length,
        mockInterviews: mockReports.length,
        codingTests: codingReports.length,
      },
    },
  })
}

export const listRecruiterApprovalRequests = async (_req: Request, res: Response): Promise<void> => {
  const [users, recruiterProfiles] = await Promise.all([
    User.find({ role: 'recruiter' }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    RecruiterProfile.find().lean<Array<Record<string, unknown>>>(),
  ])
  const recruiterMap = new Map(recruiterProfiles.map((profile) => [String(profile.userId ?? ''), profile]))

  res.json({
    success: true,
    data: users.map((user) => {
      const recruiterProfile = recruiterMap.get(String(user._id))
      return {
        id: String(user._id),
        fullName: String(user.name ?? ''),
        email: String(user.email ?? ''),
        phone: String(recruiterProfile?.phone ?? ''),
        companyName: String(recruiterProfile?.company ?? ''),
        designation: String(recruiterProfile?.designation ?? ''),
        companyWebsite: String(recruiterProfile?.companyWebsite ?? ''),
        status: String(user.accountStatus ?? 'active'),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        decisionDate: ['active', 'rejected', 'blocked', 'deactivated'].includes(String(user.accountStatus ?? ''))
          ? user.updatedAt
          : null,
      }
    }),
  })
}

export const listAdminRecruiters = async (_req: Request, res: Response): Promise<void> => {
  const [users, recruiterProfiles, jobs] = await Promise.all([
    User.find({ role: 'recruiter' }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    RecruiterProfile.find().lean<Array<Record<string, unknown>>>(),
    JobDescription.find().lean<Array<Record<string, unknown>>>(),
  ])
  const recruiterMap = new Map(recruiterProfiles.map((profile) => [String(profile.userId ?? ''), profile]))
  const jobCounts = jobs.reduce<Record<string, number>>((acc, job) => {
    const userId = String(job.userId ?? '')
    acc[userId] = (acc[userId] ?? 0) + 1
    return acc
  }, {})

  res.json({
    success: true,
    data: users.map((user) => {
      const recruiterProfile = recruiterMap.get(String(user._id))
      return {
        id: String(user._id),
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        phone: String(recruiterProfile?.phone ?? ''),
        companyName: String(recruiterProfile?.company ?? ''),
        designation: String(recruiterProfile?.designation ?? ''),
        companyWebsite: String(recruiterProfile?.companyWebsite ?? ''),
        accountStatus: String(user.accountStatus ?? 'active'),
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
        postedJobsCount: jobCounts[String(user._id)] ?? 0,
      }
    }),
  })
}

export const getAdminRecruiterDetail = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.params.recruiterId ?? '')
  const user = await User.findOne({ _id: recruiterId, role: 'recruiter' }).lean<Record<string, unknown> | null>()
  if (!user) throw new ApiError(404, 'Recruiter not found')

  const [profile, jobs, activityLogs] = await Promise.all([
    RecruiterProfile.findOne({ userId: recruiterId }).lean<Record<string, unknown> | null>(),
    JobDescription.find({ userId: recruiterId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    AdminActivityLog.find({
      $or: [
        { entityType: 'user', entityId: recruiterId },
        { entityType: 'job', metadata: { $exists: true } },
      ],
    }).sort({ createdAt: -1 }).limit(30).lean<Array<Record<string, unknown>>>(),
  ])

  const recruiterLogs = activityLogs.filter((item) => {
    if (String(item.entityType ?? '') === 'user' && String(item.entityId ?? '') === recruiterId) return true
    const metadata = (item.metadata ?? {}) as Record<string, unknown>
    return String(metadata.recruiterId ?? '') === recruiterId
  })

  res.json({
    success: true,
    data: {
      recruiter: {
        id: String(user._id ?? ''),
        name: String(user.name ?? ''),
        email: String(user.email ?? ''),
        accountStatus: String(user.accountStatus ?? 'active'),
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt,
      },
      profile: {
        phone: String(profile?.phone ?? ''),
        companyName: String(profile?.company ?? ''),
        designation: String(profile?.designation ?? ''),
        companyWebsite: String(profile?.companyWebsite ?? ''),
        hiringFor: toStringArray(profile?.hiringFor),
      },
      postedJobs: jobs.map((job) => ({
        id: String(job._id ?? ''),
        title: String(job.title ?? ''),
        company: String(job.company ?? ''),
        field: String(job.domain ?? ''),
        targetRole: String(job.roleLabel ?? ''),
        status: String(job.status ?? 'active'),
        location: String(job.location ?? ''),
        employmentType: String(job.employmentType ?? 'full-time'),
        createdAt: job.createdAt,
      })),
      summary: {
        postedJobs: jobs.length,
        activeJobs: jobs.filter((job) => String(job.status ?? 'active') === 'active').length,
      },
      activityLogs: recruiterLogs,
    },
  })
}

export const listAdminActivityLogs = async (_req: Request, res: Response): Promise<void> => {
  const logs = await AdminActivityLog.find().sort({ createdAt: -1 }).limit(250).lean<Array<Record<string, unknown>>>()
  res.json({ success: true, data: logs })
}

export const updateAdminUser = async (req: Request, res: Response): Promise<void> => {
  const { name, email, role, accountStatus } = req.body as Record<string, unknown>
  const user = await User.findById(req.params.userId)
  if (!user) throw new ApiError(404, 'User not found')
  const previousRole = user.role
  const previousStatus = user.accountStatus ?? 'active'

  if (email && String(email).trim() !== user.email) {
    const existing = await User.findOne({ email: String(email).trim().toLowerCase(), _id: { $ne: user._id } })
    if (existing) throw new ApiError(409, 'Email already exists')
    user.email = String(email).trim().toLowerCase()
  }
  if (name) user.name = String(name).trim()
  if (role) user.role = String(role) as typeof user.role
  if (accountStatus) user.accountStatus = String(accountStatus) as typeof user.accountStatus
  await user.save()

  if (previousRole !== user.role || previousStatus !== (user.accountStatus ?? 'active')) {
    const newStatus = user.accountStatus ?? 'active'
    const actionType =
      previousStatus === 'pending' && newStatus === 'active'
        ? 'recruiter_approved'
        : previousStatus === 'pending' && newStatus === 'rejected'
          ? 'recruiter_rejected'
          : newStatus === 'blocked'
            ? 'user_blocked'
            : 'user_updated'

    await logAdminActivity(req, {
      actionType,
      entityType: 'user',
      entityId: String(user._id),
      title: `${user.name} updated`,
      description: `${user.email} changed from ${previousRole}/${previousStatus} to ${user.role}/${newStatus}.`,
      metadata: { previousRole, previousStatus, currentRole: user.role, currentStatus: newStatus },
    })
  }

  res.json({ success: true, data: { id: String(user._id), accountStatus: user.accountStatus, role: user.role, name: user.name, email: user.email } })
}

export const deleteAdminUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId
  const user = await User.findById(userId)
  if (!user) throw new ApiError(404, 'User not found')

  await Promise.all([
    User.deleteOne({ _id: userId }),
    Profile.deleteOne({ userId }),
    RecruiterProfile.deleteOne({ userId }),
    Resume.deleteMany({ userId }),
    Report.deleteMany({ userId }),
    MockInterviewSession.deleteMany({ userId }),
    CodingTestSession.deleteMany({ userId }),
    EmailReminderLog.deleteMany({ userId }),
  ])

  await logAdminActivity(req, {
    actionType: 'user_deleted',
    entityType: 'user',
    entityId: String(userId),
    title: `${user.name} deleted`,
    description: `${user.email} and related records were removed from the platform.`,
    metadata: { role: user.role },
  })

  res.json({ success: true, data: { id: userId } })
}

export const listAdminResumes = async (_req: Request, res: Response): Promise<void> => {
  const [resumes, users, reports] = await Promise.all([
    Resume.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    User.find().select('name email').lean<Array<Record<string, unknown>>>(),
    Report.find({ reportType: /resume analysis/i }).lean<Array<Record<string, unknown>>>(),
  ])
  const userMap = new Map(users.map((user) => [String(user._id), user]))
  const reportMap = reports.reduce<Record<string, number>>((acc, report) => {
    const userId = String(report.userId ?? '')
    acc[userId] = (acc[userId] ?? 0) + 1
    return acc
  }, {})

  res.json({
    success: true,
    data: resumes.map((resume) => {
      const user = userMap.get(String(resume.userId ?? ''))
      const parserHints = (resume.aiAnalysisResult ?? {}) as Record<string, unknown>
      return {
        id: String(resume._id ?? ''),
        userId: String(resume.userId ?? ''),
        userName: String(user?.name ?? ''),
        userEmail: String(user?.email ?? ''),
        fileName: String(resume.fileName ?? ''),
        fileType: String(resume.fileType ?? ''),
        uploadDate: resume.uploadedDate ?? resume.createdAt,
        extractedSkills: toStringArray(resume.extractedSkills),
        extractedEducation: toStringArray(resume.extractedEducation),
        extractedProjects: toStringArray(resume.extractedProjects),
        extractedExperience: toStringArray(resume.extractedExperience),
        analysisCompleted: (reportMap[String(resume.userId ?? '')] ?? 0) > 0,
        contentPreview: String(resume.extractedText ?? '').slice(0, 240),
        validationStatus: String(parserHints.documentType ?? 'resume'),
      }
    }),
  })
}

export const deleteAdminResume = async (req: Request, res: Response): Promise<void> => {
  const resume = await Resume.findByIdAndDelete(req.params.resumeId)
  if (!resume) throw new ApiError(404, 'Resume not found')
  await logAdminActivity(req, {
    actionType: 'resume_deleted',
    entityType: 'resume',
    entityId: String(resume._id),
    title: 'Resume removed',
    description: `${String(resume.fileName ?? 'Resume')} was removed from the validation queue.`,
  })
  res.json({ success: true, data: { id: String(resume._id) } })
}

export const listPlatformFields = async (_req: Request, res: Response): Promise<void> => {
  await ensurePlatformFields()
  const fields = await PlatformField.find().sort({ label: 1 }).lean<Array<Record<string, unknown>>>()
  res.json({ success: true, data: fields })
}

export const createPlatformField = async (req: Request, res: Response): Promise<void> => {
  const created = await PlatformField.create(req.body)
  await logAdminActivity(req, {
    actionType: 'field_created',
    entityType: 'field',
    entityId: String(created.key ?? ''),
    title: `${String(created.label ?? 'Field')} created`,
    description: 'A new supported domain was added to the platform.',
  })
  res.status(201).json({ success: true, data: created })
}

export const updatePlatformField = async (req: Request, res: Response): Promise<void> => {
  const updated = await PlatformField.findOneAndUpdate({ key: req.params.fieldKey }, { $set: req.body }, { new: true })
  if (!updated) throw new ApiError(404, 'Field not found')
  await logAdminActivity(req, {
    actionType: 'field_updated',
    entityType: 'field',
    entityId: String(updated.key ?? ''),
    title: `${String(updated.label ?? 'Field')} updated`,
    description: 'Field labels, roles, or activation settings were changed.',
  })
  res.json({ success: true, data: updated })
}

export const listInterviewBank = async (_req: Request, res: Response): Promise<void> => {
  const [bundled, custom] = await Promise.all([
    interviewQuestionBankService.loadAll(),
    InterviewQuestion.find().sort({ updatedAt: -1 }).lean<Array<Record<string, unknown>>>(),
  ])
  const customBankIds = new Set(custom.map((question) => String(question.bankId ?? question._id ?? '')))
  const bundledOnly = bundled
    .filter((question) => !customBankIds.has(String(question.id)))
    .map((question) => ({ ...question, source: 'bundled' }))
  res.json({ success: true, data: [...custom.map(mapInterviewQuestionForAdmin), ...bundledOnly] })
}

export const createInterviewBankQuestion = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>
  const created = await InterviewQuestion.create({
    bankId: String(payload.bankId ?? `admin-${new mongoose.Types.ObjectId().toString()}`),
    field: String(payload.field ?? payload.domain ?? 'general_fresher'),
    domain: String(payload.field ?? payload.domain ?? 'general_fresher'),
    category: String(payload.category ?? 'General'),
    role: String(payload.role ?? ''),
    skill: String(payload.skill ?? ''),
    difficulty: String(payload.difficulty ?? 'Intermediate'),
    topic: String(payload.topic ?? ''),
    companyType: String(payload.companyType ?? 'general'),
    experienceLevel: String(payload.experienceLevel ?? 'fresher'),
    questionText: String(payload.questionText ?? ''),
    questions: [String(payload.questionText ?? '')],
    answerHint: String(payload.answerHint ?? ''),
    keyPoints: toStringArray(payload.keyPoints),
    commonMistakes: toStringArray(payload.commonMistakes),
    tags: toStringArray(payload.tags),
  })
  await logAdminActivity(req, {
    actionType: 'question_created',
    entityType: 'interview_question',
    entityId: String(created._id),
    title: 'Interview question added',
    description: `${String(created.field ?? '')} | ${String(created.role ?? '')} | ${String(created.topic ?? '')}`,
  })
  res.status(201).json({ success: true, data: created })
}

export const updateInterviewBankQuestion = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>
  const updated = await InterviewQuestion.findByIdAndUpdate(
    req.params.questionId,
    {
      $set: {
        bankId: payload.bankId,
        field: payload.field ?? payload.domain,
        domain: payload.field ?? payload.domain,
        category: payload.category,
        role: payload.role,
        skill: payload.skill ?? '',
        difficulty: payload.difficulty,
        topic: payload.topic,
        companyType: payload.companyType,
        experienceLevel: payload.experienceLevel,
        questionText: payload.questionText,
        questions: [String(payload.questionText ?? '')],
        answerHint: payload.answerHint,
        keyPoints: toStringArray(payload.keyPoints),
        commonMistakes: toStringArray(payload.commonMistakes),
        tags: toStringArray(payload.tags),
      },
    },
    { new: true },
  )
  if (!updated) throw new ApiError(404, 'Interview question not found')
  await logAdminActivity(req, {
    actionType: 'question_updated',
    entityType: 'interview_question',
    entityId: String(updated._id),
    title: 'Interview question updated',
    description: `${String(updated.field ?? '')} | ${String(updated.role ?? '')} | ${String(updated.topic ?? '')}`,
  })
  res.json({ success: true, data: updated })
}

export const deleteInterviewBankQuestion = async (req: Request, res: Response): Promise<void> => {
  const deleted = await InterviewQuestion.findByIdAndDelete(req.params.questionId)
  if (!deleted) throw new ApiError(404, 'Interview question not found')
  await logAdminActivity(req, {
    actionType: 'question_deleted',
    entityType: 'interview_question',
    entityId: String(deleted._id),
    title: 'Interview question deleted',
    description: `${String(deleted.field ?? '')} | ${String(deleted.role ?? '')} | ${String(deleted.topic ?? '')}`,
  })
  res.json({ success: true, data: { id: String(deleted._id) } })
}

export const bulkImportInterviewBankQuestions = async (req: Request, res: Response): Promise<void> => {
  const questions = Array.isArray(req.body.questions) ? req.body.questions as Array<Record<string, unknown>> : []
  if (!questions.length) throw new ApiError(400, 'No questions were provided for import')
  const docs = await InterviewQuestion.insertMany(
    questions.map((payload) => ({
      bankId: String(payload.bankId ?? `import-${new mongoose.Types.ObjectId().toString()}`),
      field: String(payload.field ?? payload.domain ?? 'general_fresher'),
      domain: String(payload.field ?? payload.domain ?? 'general_fresher'),
      category: String(payload.category ?? 'General'),
      role: String(payload.role ?? ''),
      skill: String(payload.skill ?? ''),
      difficulty: String(payload.difficulty ?? 'Intermediate'),
      topic: String(payload.topic ?? ''),
      companyType: String(payload.companyType ?? 'general'),
      experienceLevel: String(payload.experienceLevel ?? 'fresher'),
      questionText: String(payload.questionText ?? ''),
      questions: [String(payload.questionText ?? '')],
      answerHint: String(payload.answerHint ?? ''),
      keyPoints: toStringArray(payload.keyPoints),
      commonMistakes: toStringArray(payload.commonMistakes),
      tags: toStringArray(payload.tags),
    })),
  )
  await logAdminActivity(req, {
    actionType: 'question_imported',
    entityType: 'interview_question',
    title: 'Interview bank imported',
    description: `${docs.length} interview questions were imported from JSON.`,
    metadata: { count: docs.length },
  })
  res.status(201).json({ success: true, data: { imported: docs.length } })
}

export const listCodingProblemsAdmin = async (_req: Request, res: Response): Promise<void> => {
  const [bundled, custom] = await Promise.all([
    codingQuestionBankService.loadAll(),
    CodingProblem.find().sort({ updatedAt: -1 }).lean<Array<Record<string, unknown>>>(),
  ])
  const customIds = new Set(custom.map((problem) => String(problem.problemId ?? problem._id ?? '')))
  const bundledOnly = bundled.filter((problem) => !customIds.has(String(problem.id))).map((problem) => ({ ...problem, source: 'bundled' }))
  res.json({ success: true, data: [...custom.map(mapCodingProblemForAdmin), ...bundledOnly] })
}

export const createCodingProblemAdmin = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>
  const created = await CodingProblem.create({
    problemId: String(payload.problemId ?? `cp-${new mongoose.Types.ObjectId().toString()}`),
    domain: String(payload.domain ?? 'it_software'),
    role: String(payload.role ?? ''),
    topic: String(payload.topic ?? ''),
    difficulty: String(payload.difficulty ?? 'Intermediate'),
    title: String(payload.title ?? ''),
    problemStatement: String(payload.problemStatement ?? ''),
    inputFormat: String(payload.inputFormat ?? ''),
    outputFormat: String(payload.outputFormat ?? ''),
    constraints: toStringArray(payload.constraints),
    sampleInput: String(payload.sampleInput ?? ''),
    sampleOutput: String(payload.sampleOutput ?? ''),
    explanation: String(payload.explanation ?? ''),
    supportedLanguages: toStringArray(payload.supportedLanguages),
    timeLimit: Number(payload.timeLimit ?? 2),
    memoryLimit: Number(payload.memoryLimit ?? 256),
    visibleTestCases: Array.isArray(payload.visibleTestCases) ? payload.visibleTestCases : [],
    hiddenTestCases: Array.isArray(payload.hiddenTestCases) ? payload.hiddenTestCases : [],
    tags: toStringArray(payload.tags),
  })
  await logAdminActivity(req, {
    actionType: 'coding_question_created',
    entityType: 'coding_problem',
    entityId: String(created._id),
    title: 'Coding question added',
    description: `${String(created.domain ?? '')} | ${String(created.role ?? '')} | ${String(created.title ?? '')}`,
  })
  res.status(201).json({ success: true, data: created })
}

export const updateCodingProblemAdmin = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>
  const updated = await CodingProblem.findByIdAndUpdate(
    req.params.problemId,
    {
      $set: {
        problemId: payload.problemId,
        domain: payload.domain,
        role: payload.role,
        topic: payload.topic,
        difficulty: payload.difficulty,
        title: payload.title,
        problemStatement: payload.problemStatement,
        inputFormat: payload.inputFormat,
        outputFormat: payload.outputFormat,
        constraints: toStringArray(payload.constraints),
        sampleInput: payload.sampleInput,
        sampleOutput: payload.sampleOutput,
        explanation: payload.explanation,
        supportedLanguages: toStringArray(payload.supportedLanguages),
        timeLimit: Number(payload.timeLimit ?? 2),
        memoryLimit: Number(payload.memoryLimit ?? 256),
        visibleTestCases: Array.isArray(payload.visibleTestCases) ? payload.visibleTestCases : [],
        hiddenTestCases: Array.isArray(payload.hiddenTestCases) ? payload.hiddenTestCases : [],
        tags: toStringArray(payload.tags),
      },
    },
    { new: true },
  )
  if (!updated) throw new ApiError(404, 'Coding problem not found')
  await logAdminActivity(req, {
    actionType: 'coding_question_updated',
    entityType: 'coding_problem',
    entityId: String(updated._id),
    title: 'Coding question updated',
    description: `${String(updated.domain ?? '')} | ${String(updated.role ?? '')} | ${String(updated.title ?? '')}`,
  })
  res.json({ success: true, data: updated })
}

export const deleteCodingProblemAdmin = async (req: Request, res: Response): Promise<void> => {
  const deleted = await CodingProblem.findByIdAndDelete(req.params.problemId)
  if (!deleted) throw new ApiError(404, 'Coding problem not found')
  await logAdminActivity(req, {
    actionType: 'coding_question_deleted',
    entityType: 'coding_problem',
    entityId: String(deleted._id),
    title: 'Coding question deleted',
    description: `${String(deleted.domain ?? '')} | ${String(deleted.role ?? '')} | ${String(deleted.title ?? '')}`,
  })
  res.json({ success: true, data: { id: String(deleted._id) } })
}

export const listAdminJobs = async (_req: Request, res: Response): Promise<void> => {
  const [jobs, users] = await Promise.all([
    JobDescription.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    User.find().select('name email').lean<Array<Record<string, unknown>>>(),
  ])
  const userMap = new Map(users.map((user) => [String(user._id), user]))
  res.json({
    success: true,
    data: jobs.map((job) => {
      const recruiter = userMap.get(String(job.userId ?? ''))
      return {
        id: String(job._id ?? ''),
        title: String(job.title ?? ''),
        company: String(job.company ?? ''),
        description: String(job.descriptionText ?? ''),
        requiredSkills: toStringArray(job.extractedSkills),
        field: String(job.domain ?? ''),
        targetRole: String(job.roleLabel ?? ''),
        location: String(job.location ?? ''),
        applyLink: String(job.applyLink ?? ''),
        employmentType: String(job.employmentType ?? 'full-time'),
        status: String(job.status ?? 'active'),
        recruiterName: String(recruiter?.name ?? ''),
        recruiterEmail: String(recruiter?.email ?? ''),
        createdAt: job.createdAt,
      }
    }),
  })
}

export const createAdminJob = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>
  const created = await JobDescription.create({
    userId: req.user?.userId,
    title: String(payload.title ?? ''),
    company: String(payload.company ?? ''),
    descriptionText: String(payload.description ?? payload.descriptionText ?? ''),
    extractedSkills: toStringArray(payload.requiredSkills ?? payload.extractedSkills),
    domain: String(payload.field ?? payload.domain ?? ''),
    roleLabel: String(payload.targetRole ?? payload.roleLabel ?? ''),
    location: String(payload.location ?? ''),
    applyLink: String(payload.applyLink ?? ''),
    employmentType: String(payload.employmentType ?? 'full-time'),
    status: String(payload.status ?? 'active'),
  })
  await logAdminActivity(req, {
    actionType: 'job_created',
    entityType: 'job',
    entityId: String(created._id),
    title: `${String(created.title ?? 'Job')} added`,
    description: `${String(created.company ?? '')} | ${String(created.domain ?? '')} | ${String(created.roleLabel ?? '')}`,
    metadata: { recruiterId: String(created.userId ?? '') },
  })
  res.status(201).json({ success: true, data: created })
}

export const updateAdminJob = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as Record<string, unknown>
  const updated = await JobDescription.findByIdAndUpdate(
    req.params.jobId,
    {
      $set: {
        title: payload.title,
        company: payload.company,
        descriptionText: payload.description ?? payload.descriptionText,
        extractedSkills: toStringArray(payload.requiredSkills ?? payload.extractedSkills),
        domain: payload.field ?? payload.domain ?? '',
        roleLabel: payload.targetRole ?? payload.roleLabel ?? '',
        location: payload.location ?? '',
        applyLink: payload.applyLink ?? '',
        employmentType: payload.employmentType ?? 'full-time',
        status: payload.status ?? 'active',
      },
    },
    { new: true },
  )
  if (!updated) throw new ApiError(404, 'Job not found')
  await logAdminActivity(req, {
    actionType: 'job_updated',
    entityType: 'job',
    entityId: String(updated._id),
    title: `${String(updated.title ?? 'Job')} updated`,
    description: `${String(updated.company ?? '')} | status ${String(updated.status ?? '')}`,
    metadata: { recruiterId: String(updated.userId ?? '') },
  })
  res.json({ success: true, data: updated })
}

export const deleteAdminJob = async (req: Request, res: Response): Promise<void> => {
  const deleted = await JobDescription.findByIdAndDelete(req.params.jobId)
  if (!deleted) throw new ApiError(404, 'Job not found')
  await logAdminActivity(req, {
    actionType: 'job_deleted',
    entityType: 'job',
    entityId: String(deleted._id),
    title: `${String(deleted.title ?? 'Job')} removed`,
    description: `${String(deleted.company ?? '')} job listing was deleted.`,
    metadata: { recruiterId: String(deleted.userId ?? '') },
  })
  res.json({ success: true, data: { id: String(deleted._id) } })
}

export const listAdminReports = async (_req: Request, res: Response): Promise<void> => {
  const [reports, users] = await Promise.all([
    Report.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    User.find().select('name email').lean<Array<Record<string, unknown>>>(),
  ])
  const userMap = new Map(users.map((user) => [String(user._id), user]))
  res.json({
    success: true,
    data: reports.map((report) => {
      const user = userMap.get(String(report.userId ?? ''))
      const payload = (report.payload ?? {}) as Record<string, unknown>
      return {
        id: String(report._id ?? ''),
        userId: String(report.userId ?? ''),
        userName: String(user?.name ?? ''),
        userEmail: String(user?.email ?? ''),
        reportType: String(report.reportType ?? ''),
        title: String(report.title ?? ''),
        summary: String(report.summary ?? ''),
        field: String(payload.domain ?? payload.field ?? ''),
        targetRole: String(payload.targetRole ?? payload.role ?? ''),
        score: Number(payload.score ?? payload.readinessScore ?? payload.finalScore ?? 0),
        createdAt: report.createdAt,
      }
    }),
  })
}

export const deleteAdminReport = async (req: Request, res: Response): Promise<void> => {
  const deleted = await Report.findByIdAndDelete(req.params.reportId)
  if (!deleted) throw new ApiError(404, 'Report not found')
  await logAdminActivity(req, {
    actionType: 'report_deleted',
    entityType: 'report',
    entityId: String(deleted._id),
    title: 'Report deleted',
    description: `${String(deleted.title ?? deleted.reportType ?? 'Report')} was removed.`,
  })
  res.json({ success: true, data: { id: String(deleted._id) } })
}

export const listAdminMockInterviews = async (_req: Request, res: Response): Promise<void> => {
  const [sessions, users] = await Promise.all([
    MockInterviewSession.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    User.find().select('name email').lean<Array<Record<string, unknown>>>(),
  ])
  const userMap = new Map(users.map((user) => [String(user._id), user]))
  res.json({
    success: true,
    data: sessions.map((session) => {
      const user = userMap.get(String(session.userId ?? ''))
      const evaluation = (session.evaluation ?? {}) as Record<string, unknown>
      return {
        id: String(session._id ?? ''),
        userName: String(user?.name ?? ''),
        userEmail: String(user?.email ?? ''),
        domain: String(session.domain ?? ''),
        targetRole: String(session.targetRole ?? ''),
        interviewType: String(session.interviewType ?? ''),
        difficulty: String(session.difficulty ?? ''),
        status: String(session.status ?? ''),
        score: Number(session.score ?? evaluation.overallScore ?? 0),
        weakAreas: toStringArray(evaluation.weakAreas),
        createdAt: session.createdAt,
      }
    }),
  })
}

export const listAdminCodingSessions = async (_req: Request, res: Response): Promise<void> => {
  const [sessions, users] = await Promise.all([
    CodingTestSession.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    User.find().select('name email').lean<Array<Record<string, unknown>>>(),
  ])
  const userMap = new Map(users.map((user) => [String(user._id), user]))
  res.json({
    success: true,
    data: sessions.map((session) => {
      const user = userMap.get(String(session.userId ?? ''))
      return {
        id: String(session._id ?? ''),
        userName: String(user?.name ?? ''),
        userEmail: String(user?.email ?? ''),
        domain: String(session.domain ?? ''),
        role: String(session.role ?? ''),
        selectedLanguage: String(session.selectedLanguage ?? ''),
        status: String(session.status ?? ''),
        passPercentage: Number(session.passPercentage ?? 0),
        finalScore: Number(session.finalScore ?? 0),
        weakTopics: toStringArray(session.weakTopics),
        createdAt: session.createdAt,
      }
    }),
  })
}

export const listAdminNotifications = async (_req: Request, res: Response): Promise<void> => {
  const [notifications, emailLogs] = await Promise.all([
    PlatformNotification.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>(),
    EmailReminderLog.find().sort({ sentAt: -1 }).limit(50).lean<Array<Record<string, unknown>>>(),
  ])
  res.json({
    success: true,
    data: {
      notifications,
      reminderHistory: emailLogs,
    },
  })
}

export const createAdminNotification = async (req: Request, res: Response): Promise<void> => {
  const created = await PlatformNotification.create({
    ...req.body,
    createdBy: req.user?.userId ?? null,
  })
  await logAdminActivity(req, {
    actionType: 'notification_created',
    entityType: 'notification',
    entityId: String(created._id),
    title: `${String(created.title ?? 'Notification')} created`,
    description: `Audience: ${String(created.audience ?? 'all')} | tone: ${String(created.tone ?? 'info')}`,
  })
  res.status(201).json({ success: true, data: created })
}

export const deleteAdminNotification = async (req: Request, res: Response): Promise<void> => {
  const deleted = await PlatformNotification.findByIdAndDelete(req.params.notificationId)
  if (!deleted) throw new ApiError(404, 'Notification not found')
  await logAdminActivity(req, {
    actionType: 'notification_deleted',
    entityType: 'notification',
    entityId: String(deleted._id),
    title: `${String(deleted.title ?? 'Notification')} deleted`,
    description: 'A stored platform notification was removed.',
  })
  res.json({ success: true, data: { id: String(deleted._id) } })
}

export const listAdminContactMessages = async (_req: Request, res: Response): Promise<void> => {
  const contacts = await ContactRequest.find().sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>()
  res.json({ success: true, data: contacts })
}

export const updateAdminContactMessage = async (req: Request, res: Response): Promise<void> => {
  const status = String(req.body.status ?? 'read')
  const updated = await ContactRequest.findByIdAndUpdate(
    req.params.contactId,
    {
      $set: {
        status,
        readAt: status === 'read' ? new Date() : null,
      },
    },
    { new: true },
  )
  if (!updated) throw new ApiError(404, 'Contact request not found')
  await logAdminActivity(req, {
    actionType: 'contact_updated',
    entityType: 'contact',
    entityId: String(updated._id),
    title: `Contact message marked ${status}`,
    description: `${String(updated.fullName ?? 'Contact sender')} | ${String(updated.subject ?? '')}`,
  })
  res.json({ success: true, data: updated })
}

export const deleteAdminContactMessage = async (req: Request, res: Response): Promise<void> => {
  const deleted = await ContactRequest.findByIdAndDelete(req.params.contactId)
  if (!deleted) throw new ApiError(404, 'Contact request not found')
  await logAdminActivity(req, {
    actionType: 'contact_deleted',
    entityType: 'contact',
    entityId: String(deleted._id),
    title: 'Contact message deleted',
    description: `${String(deleted.fullName ?? 'Contact sender')} | ${String(deleted.subject ?? '')}`,
  })
  res.json({ success: true, data: { id: String(deleted._id) } })
}

export const getAdminSettings = async (_req: Request, res: Response): Promise<void> => {
  const settings = await ensureAdminSettings()
  res.json({ success: true, data: settings.value ?? defaultAdminSettings })
}

export const updateAdminSettings = async (req: Request, res: Response): Promise<void> => {
  const updated = await AdminSetting.findOneAndUpdate(
    { key: 'platform' },
    { $set: { value: req.body } },
    { upsert: true, new: true },
  )
  await logAdminActivity(req, {
    actionType: 'settings_updated',
    entityType: 'settings',
    entityId: 'platform',
    title: 'Admin settings updated',
    description: 'Mail, reminders, branding, or feature toggle settings were updated.',
  })
  res.json({ success: true, data: updated?.value ?? req.body })
}
