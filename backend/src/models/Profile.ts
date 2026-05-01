import { Schema, model, type Types } from 'mongoose'
import type { DomainKey } from '../services/domainService'

interface IDetectedDomain {
  key: DomainKey
  label: string
  confidence: number
  band: 'high' | 'medium' | 'low'
  score: number
  reasons: string[]
}

export interface INotificationPreferences {
  emailRemindersEnabled: boolean
  profileCompletionReminder: boolean
  resumeUploadReminder: boolean
  skillImprovementReminder: boolean
  interviewPreparationReminder: boolean
  mockInterviewReminder: boolean
  reportReadyNotification: boolean
  jobRecommendationReminder: boolean
  inactiveUserReminder: boolean
  frequency: 'daily' | 'every_3_days' | 'weekly'
}

export interface IProfile {
  userId: Types.ObjectId
  phone: string
  profilePhoto: string
  currentLocation: string
  professionalHeadline: string
  summary: string
  collegeName: string
  degree: string
  branch: string
  graduationYear?: number | null
  cgpaOrPercentage: string
  education: string
  skills: string[]
  technicalSkills: string[]
  softSkills: string[]
  certifications: string[]
  internshipExperience: string
  workExperience: string
  experience: string
  preferredJobRole: string
  preferredIndustry: string
  languagesKnown: string[]
  linkedInProfile: string
  githubProfile: string
  portfolioLink: string
  achievements: string[]
  areasOfInterest: string[]
  strengths: string[]
  location: string
  projects: string[]
  detectedDomains: IDetectedDomain[]
  confirmedDomain: DomainKey | ''
  domainDecisionSource: 'manual' | 'detected' | 'unconfirmed'
  domainDetectionUpdatedAt?: Date | null
  notificationPreferences: INotificationPreferences
}

const defaultNotificationPreferences: INotificationPreferences = {
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
}

const profileSchema = new Schema<IProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    phone: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },
    currentLocation: { type: String, default: '', alias: 'location' },
    professionalHeadline: { type: String, default: '' },
    summary: { type: String, default: '' },
    collegeName: { type: String, default: '' },
    degree: { type: String, default: '' },
    branch: { type: String, default: '' },
    graduationYear: { type: Number, default: null },
    cgpaOrPercentage: { type: String, default: '' },
    education: { type: String, default: '' },
    skills: { type: [String], default: [] },
    technicalSkills: { type: [String], default: [] },
    softSkills: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    internshipExperience: { type: String, default: '' },
    workExperience: { type: String, default: '' },
    experience: { type: String, default: '' },
    preferredJobRole: { type: String, default: '' },
    preferredIndustry: { type: String, default: '' },
    languagesKnown: { type: [String], default: [] },
    linkedInProfile: { type: String, default: '' },
    githubProfile: { type: String, default: '' },
    portfolioLink: { type: String, default: '' },
    achievements: { type: [String], default: [] },
    areasOfInterest: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    detectedDomains: {
      type: [
        new Schema<IDetectedDomain>(
          {
            key: { type: String, default: 'general_fresher' },
            label: { type: String, default: '' },
            confidence: { type: Number, default: 0 },
            band: { type: String, enum: ['high', 'medium', 'low'], default: 'low' },
            score: { type: Number, default: 0 },
            reasons: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    confirmedDomain: { type: String, default: '' },
    domainDecisionSource: { type: String, enum: ['manual', 'detected', 'unconfirmed'], default: 'unconfirmed' },
    domainDetectionUpdatedAt: { type: Date, default: null },
    notificationPreferences: {
      type: new Schema<INotificationPreferences>(
        {
          emailRemindersEnabled: { type: Boolean, default: defaultNotificationPreferences.emailRemindersEnabled },
          profileCompletionReminder: { type: Boolean, default: defaultNotificationPreferences.profileCompletionReminder },
          resumeUploadReminder: { type: Boolean, default: defaultNotificationPreferences.resumeUploadReminder },
          skillImprovementReminder: { type: Boolean, default: defaultNotificationPreferences.skillImprovementReminder },
          interviewPreparationReminder: { type: Boolean, default: defaultNotificationPreferences.interviewPreparationReminder },
          mockInterviewReminder: { type: Boolean, default: defaultNotificationPreferences.mockInterviewReminder },
          reportReadyNotification: { type: Boolean, default: defaultNotificationPreferences.reportReadyNotification },
          jobRecommendationReminder: { type: Boolean, default: defaultNotificationPreferences.jobRecommendationReminder },
          inactiveUserReminder: { type: Boolean, default: defaultNotificationPreferences.inactiveUserReminder },
          frequency: { type: String, enum: ['daily', 'every_3_days', 'weekly'], default: defaultNotificationPreferences.frequency },
        },
        { _id: false },
      ),
      default: () => ({ ...defaultNotificationPreferences }),
    },
  },
  { timestamps: true },
)

export const Profile = model<IProfile>('Profile', profileSchema)
