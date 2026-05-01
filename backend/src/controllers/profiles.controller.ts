import type { Request, Response } from 'express'
import { RecruiterProfile } from '../models/RecruiterProfile'
import { StudentProfile } from '../models/StudentProfile'
import { User } from '../models/User'
import { Resume } from '../models/Resume'
import { detectLikelyDomains, domainLabel, isDomainKey, selectRecommendedDomain, type DomainKey } from '../services/domainService'
import { ApiError } from '../utils/ApiError'

type StudentProfilePayload = {
  name?: string
  email?: string
  phone?: string
  profilePhoto?: string
  currentLocation?: string
  professionalHeadline?: string
  summary?: string
  collegeName?: string
  degree?: string
  branch?: string
  graduationYear?: number | null
  cgpaOrPercentage?: string
  education?: string
  skills?: string[]
  technicalSkills?: string[]
  softSkills?: string[]
  certifications?: string[]
  projects?: string[]
  internshipExperience?: string
  workExperience?: string
  experience?: string
  preferredJobRole?: string
  preferredIndustry?: string
  languagesKnown?: string[]
  linkedInProfile?: string
  githubProfile?: string
  portfolioLink?: string
  achievements?: string[]
  areasOfInterest?: string[]
  strengths?: string[]
  confirmedDomain?: string
  domainDecisionSource?: 'manual' | 'detected' | 'unconfirmed'
  notificationPreferences?: {
    emailRemindersEnabled?: boolean
    profileCompletionReminder?: boolean
    resumeUploadReminder?: boolean
    skillImprovementReminder?: boolean
    interviewPreparationReminder?: boolean
    mockInterviewReminder?: boolean
    reportReadyNotification?: boolean
    jobRecommendationReminder?: boolean
    inactiveUserReminder?: boolean
    frequency?: 'daily' | 'every_3_days' | 'weekly'
  }
}

const completionChecks = [
  (payload: Record<string, unknown>) => Boolean(payload.phone),
  (payload: Record<string, unknown>) => Boolean(payload.currentLocation),
  (payload: Record<string, unknown>) => Boolean(payload.professionalHeadline),
  (payload: Record<string, unknown>) => Boolean(payload.summary),
  (payload: Record<string, unknown>) => Boolean(payload.collegeName),
  (payload: Record<string, unknown>) => Boolean(payload.degree),
  (payload: Record<string, unknown>) => Boolean(payload.branch),
  (payload: Record<string, unknown>) => Boolean(payload.graduationYear),
  (payload: Record<string, unknown>) => Boolean(payload.cgpaOrPercentage),
  (payload: Record<string, unknown>) => Array.isArray(payload.skills) && payload.skills.length > 0,
  (payload: Record<string, unknown>) => Array.isArray(payload.technicalSkills) && payload.technicalSkills.length > 0,
  (payload: Record<string, unknown>) => Array.isArray(payload.softSkills) && payload.softSkills.length > 0,
  (payload: Record<string, unknown>) => Array.isArray(payload.projects) && payload.projects.length > 0,
  (payload: Record<string, unknown>) => Boolean(payload.preferredJobRole),
  (payload: Record<string, unknown>) => Array.isArray(payload.strengths) && payload.strengths.length > 0,
]

const normalizeList = (items?: string[]): string[] => items?.map((item) => item.trim()).filter(Boolean) ?? []

const buildDomainState = (profile: Record<string, unknown> | null, resume: Record<string, unknown> | null) => {
  const detectedDomains = detectLikelyDomains({ profile: profile ?? {}, resume: resume ?? {} })
  const recommendedDomain = selectRecommendedDomain(detectedDomains)
  const confirmedDomain = isDomainKey(profile?.confirmedDomain) ? profile.confirmedDomain : ''
  const activeDomain = confirmedDomain || recommendedDomain.key
  return {
    detectedDomains,
    recommendedDomain,
    confirmedDomain,
    activeDomain,
    activeDomainLabel: domainLabel(activeDomain as DomainKey),
    needsDomainConfirmation: !confirmedDomain,
  }
}

const buildProfileResponse = (
  user: { name: string; email: string; _id?: unknown },
  profile: Record<string, unknown> | null,
  domainState: ReturnType<typeof buildDomainState>,
) => {
  const merged: Record<string, unknown> = {
    userId: String(profile?.userId ?? user._id ?? ''),
    name: user.name,
    email: user.email,
    ...(profile ?? {}),
  }
  const completedCount = completionChecks.filter((check) => check(merged)).length
  const completion = Math.round((completedCount / completionChecks.length) * 100)
  const missingFields = [
    ['phone', merged.phone],
    ['currentLocation', merged.currentLocation ?? merged.location],
    ['professionalHeadline', merged.professionalHeadline],
    ['summary', merged.summary],
    ['collegeName', merged.collegeName],
    ['degree', merged.degree],
    ['branch', merged.branch],
    ['graduationYear', merged.graduationYear],
    ['cgpaOrPercentage', merged.cgpaOrPercentage],
    ['skills', Array.isArray(merged.skills) ? merged.skills.length : 0],
    ['technicalSkills', Array.isArray(merged.technicalSkills) ? merged.technicalSkills.length : 0],
    ['softSkills', Array.isArray(merged.softSkills) ? merged.softSkills.length : 0],
    ['projects', Array.isArray(merged.projects) ? merged.projects.length : 0],
    ['preferredJobRole', merged.preferredJobRole],
    ['strengths', Array.isArray(merged.strengths) ? merged.strengths.length : 0],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key)

  return {
    ...merged,
    completion,
    missingFields,
    detectedDomains: domainState.detectedDomains,
    recommendedDomain: {
      key: domainState.recommendedDomain.key,
      label: domainState.recommendedDomain.label,
      confidence: domainState.recommendedDomain.confidence,
      reasons: domainState.recommendedDomain.reasons,
    },
    confirmedDomain: domainState.confirmedDomain,
    confirmedDomainLabel: domainState.confirmedDomain ? domainLabel(domainState.confirmedDomain as DomainKey) : '',
    activeDomain: domainState.activeDomain,
    activeDomainLabel: domainState.activeDomainLabel,
    needsDomainConfirmation: domainState.needsDomainConfirmation,
  }
}

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.user?.userId).select('-password')
  res.json({ success: true, data: user })
}

export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find().select('-password')
  res.json({ success: true, data: users })
}

export const getStudentProfile = async (req: Request, res: Response): Promise<void> => {
  const [user, profile, latestResume] = await Promise.all([
    User.findById(req.user?.userId).select('name email'),
    StudentProfile.findOne({ userId: req.user?.userId }).lean<Record<string, unknown>>(),
    Resume.findOne({ userId: req.user?.userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>(),
  ])
  if (!user) {
    throw new ApiError(404, 'User not found')
  }
  const domainState = buildDomainState(profile, latestResume)
  await StudentProfile.findOneAndUpdate(
    { userId: req.user?.userId },
    {
      $set: {
        detectedDomains: domainState.detectedDomains,
        domainDetectionUpdatedAt: new Date(),
        ...(profile?.confirmedDomain
          ? {}
          : {
              domainDecisionSource: domainState.recommendedDomain.key === 'general_fresher' ? 'unconfirmed' : 'detected',
            }),
      },
      $setOnInsert: { userId: req.user?.userId },
    },
    { upsert: true },
  )
  const refreshedProfile = await StudentProfile.findOne({ userId: req.user?.userId }).lean<Record<string, unknown>>()
  res.json({ success: true, data: buildProfileResponse(user, refreshedProfile, buildDomainState(refreshedProfile, latestResume)) })
}

export const upsertStudentProfile = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as StudentProfilePayload
  const user = await User.findById(req.user?.userId)
  const existingProfile = await StudentProfile.findOne({ userId: req.user?.userId }).lean<Record<string, unknown>>()
  if (!user) {
    throw new ApiError(404, 'User not found')
  }

  if (payload.email && payload.email !== user.email) {
    const existing = await User.findOne({ email: payload.email, _id: { $ne: user._id } })
    if (existing) {
      throw new ApiError(409, 'Email already exists')
    }
    user.email = payload.email
  }

  if (payload.name) {
    user.name = payload.name
  }

  await user.save()

  const profileUpdate = {
    ...payload,
    skills: normalizeList(payload.skills),
    technicalSkills: normalizeList(payload.technicalSkills),
    softSkills: normalizeList(payload.softSkills),
    certifications: normalizeList(payload.certifications),
    projects: normalizeList(payload.projects),
    languagesKnown: normalizeList(payload.languagesKnown),
    achievements: normalizeList(payload.achievements),
    areasOfInterest: normalizeList(payload.areasOfInterest),
    strengths: normalizeList(payload.strengths),
    currentLocation: payload.currentLocation ?? payload.currentLocation,
    education: payload.education ?? [payload.degree, payload.branch, payload.collegeName].filter(Boolean).join(', '),
    experience: payload.experience ?? [payload.internshipExperience, payload.workExperience].filter(Boolean).join('\n\n'),
    ...(payload.confirmedDomain !== undefined
      ? {
          confirmedDomain: isDomainKey(payload.confirmedDomain) ? payload.confirmedDomain : '',
          domainDecisionSource: isDomainKey(payload.confirmedDomain)
            ? 'manual'
            : payload.domainDecisionSource ?? 'unconfirmed',
        }
      : {}),
    ...(payload.notificationPreferences
      ? {
          notificationPreferences: {
            ...((existingProfile?.notificationPreferences as Record<string, unknown> | undefined) ?? {}),
            ...payload.notificationPreferences,
          },
        }
      : {}),
  }

  const profile = await StudentProfile.findOneAndUpdate(
    { userId: req.user?.userId },
    { $set: profileUpdate },
    { new: true, upsert: true },
  ).lean<Record<string, unknown>>()
  const latestResume = await Resume.findOne({ userId: req.user?.userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const domainState = buildDomainState(profile, latestResume)
  const finalProfile = await StudentProfile.findOneAndUpdate(
    { userId: req.user?.userId },
    {
      $set: {
        detectedDomains: domainState.detectedDomains,
        domainDetectionUpdatedAt: new Date(),
      },
    },
    { new: true },
  ).lean<Record<string, unknown>>()
  res.json({ success: true, data: buildProfileResponse(user, finalProfile, buildDomainState(finalProfile, latestResume)) })
}

export const getRecruiterProfile = async (req: Request, res: Response): Promise<void> => {
  const profile = await RecruiterProfile.findOne({ userId: req.user?.userId })
  res.json({ success: true, data: profile })
}

export const upsertRecruiterProfile = async (req: Request, res: Response): Promise<void> => {
  const profile = await RecruiterProfile.findOneAndUpdate(
    { userId: req.user?.userId },
    { $set: req.body },
    { new: true, upsert: true },
  )
  res.json({ success: true, data: profile })
}
