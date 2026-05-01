export type UserRole = 'student' | 'recruiter' | 'admin'
export type DomainKey =
  | 'it_software'
  | 'data_analytics'
  | 'commerce_finance'
  | 'mechanical'
  | 'civil'
  | 'electrical'
  | 'electronics'
  | 'marketing'
  | 'hr'
  | 'design'
  | 'healthcare'
  | 'general_fresher'

export interface DetectedDomain {
  key: DomainKey
  label: string
  confidence: number
  reasons: string[]
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  accountStatus?: 'active' | 'pending' | 'rejected' | 'blocked' | 'deactivated'
  avatar?: string
}

export interface StudentProfile {
  name: string
  email: string
  userId: string
  phone: string
  profilePhoto: string
  currentLocation: string
  professionalHeadline: string
  summary: string
  collegeName: string
  degree: string
  branch: string
  graduationYear: number | null
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
  completion: number
  missingFields: string[]
  detectedDomains: DetectedDomain[]
  recommendedDomain?: DetectedDomain
  confirmedDomain: DomainKey | ''
  confirmedDomainLabel: string
  activeDomain: DomainKey
  activeDomainLabel: string
  needsDomainConfirmation: boolean
  notificationPreferences?: {
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
}

export interface RecruiterProfile {
  userId: string
  phone: string
  company: string
  designation: string
  companyWebsite: string
  companyDescription: string
  companyLocation: string
  hiringDomains: string[]
  companySize: string
  companyLogo: string
  hiringFor: string[]
}

export interface Resume {
  id: string
  fileName: string
  format: 'PDF' | 'DOCX'
  uploadedAt: string
  score: number
  atsScore: number
}

export interface JobDescription {
  id: string
  title: string
  company: string
  experienceRequired: string
  requiredSkills: string[]
  description: string
}

export interface ResumeAnalysisReport {
  id: string
  resumeId: string
  strengths: string[]
  weaknesses: string[]
  missingKeywords: string[]
  grammarTips: string[]
  sections: Record<string, number>
}

export interface SkillGap {
  skill: string
  priority: 'High' | 'Medium' | 'Low'
  resource: string
  progress: number
}

export interface CandidateRanking {
  id: string
  name: string
  email: string
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  status: 'Shortlisted' | 'Review' | 'Rejected'
}

export interface InterviewQuestion {
  id: string
  category: 'HR' | 'Technical' | 'Project' | 'Behavioral'
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  question: string
  sampleAnswer: string
}

export interface DashboardStats {
  label: string
  value: string
  trend?: string
}

export interface Report {
  id: string
  name: string
  type: string
  date: string
  status: 'Ready' | 'Processing' | 'Failed'
}

export interface MenuItem {
  label: string
  path: string
  icon: string
}

export interface ChartPoint {
  name: string
  value: number
  secondary?: number
}
