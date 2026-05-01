import { z } from 'zod'

const optionalUrl = z.union([z.literal(''), z.url()])
const optionalStringArray = z.array(z.string().trim().min(1)).optional()
const notificationPreferencesSchema = z.object({
  emailRemindersEnabled: z.boolean().optional(),
  profileCompletionReminder: z.boolean().optional(),
  resumeUploadReminder: z.boolean().optional(),
  skillImprovementReminder: z.boolean().optional(),
  interviewPreparationReminder: z.boolean().optional(),
  mockInterviewReminder: z.boolean().optional(),
  reportReadyNotification: z.boolean().optional(),
  jobRecommendationReminder: z.boolean().optional(),
  inactiveUserReminder: z.boolean().optional(),
  frequency: z.enum(['daily', 'every_3_days', 'weekly']).optional(),
}).optional()

export const registerSchema = z.discriminatedUnion('role', [
  z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('student'),
  }),
  z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('recruiter'),
    phone: z.string().trim().min(8).max(20),
    company: z.string().trim().min(2),
    designation: z.string().trim().min(2),
    companyWebsite: optionalUrl.optional(),
  }),
])

export const adminCreateUserSchema = z.discriminatedUnion('role', [
  z.object({
    name: z.string().trim().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('student'),
    phone: z.string().trim().min(8).max(20).optional().or(z.literal('')),
    forcePasswordReset: z.boolean().optional(),
  }),
  z.object({
    name: z.string().trim().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('recruiter'),
    phone: z.string().trim().min(8).max(20),
    company: z.string().trim().min(2),
    designation: z.string().trim().min(2),
    companyWebsite: optionalUrl.optional(),
    forcePasswordReset: z.boolean().optional(),
  }),
  z.object({
    name: z.string().trim().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('admin'),
    phone: z.string().trim().min(8).max(20).optional().or(z.literal('')),
    forcePasswordReset: z.boolean().optional(),
  }),
])

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

export const requestRegistrationOtpSchema = z.discriminatedUnion('role', [
  z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('student'),
  }),
  z.object({
    name: z.string().min(2),
    email: z.email(),
    password: z.string().min(6),
    role: z.literal('recruiter'),
    phone: z.string().trim().min(8).max(20),
    company: z.string().trim().min(2),
    designation: z.string().trim().min(2),
    companyWebsite: optionalUrl.optional(),
  }),
])

export const verifyRegistrationOtpSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Please enter the 6-digit OTP.'),
})

export const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address.'),
})

export const resetPasswordSchema = z.object({
  email: z.email('Please enter a valid email address.'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Please enter the 6-digit OTP.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

export const studentProfileSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  profilePhoto: optionalUrl.optional(),
  currentLocation: z.string().trim().min(2).optional(),
  professionalHeadline: z.string().trim().min(2).optional(),
  summary: z.string().trim().min(10).optional(),
  collegeName: z.string().trim().min(2).optional(),
  degree: z.string().trim().min(2).optional(),
  branch: z.string().trim().min(2).optional(),
  graduationYear: z.number().int().min(2000).max(2100).nullable().optional(),
  cgpaOrPercentage: z.string().trim().min(1).optional(),
  education: z.string().trim().optional(),
  skills: optionalStringArray,
  technicalSkills: optionalStringArray,
  softSkills: optionalStringArray,
  certifications: optionalStringArray,
  projects: optionalStringArray,
  internshipExperience: z.string().trim().optional(),
  workExperience: z.string().trim().optional(),
  experience: z.string().trim().optional(),
  preferredJobRole: z.string().trim().min(2).optional(),
  preferredIndustry: z.string().trim().optional(),
  languagesKnown: optionalStringArray,
  linkedInProfile: optionalUrl.optional(),
  githubProfile: optionalUrl.optional(),
  portfolioLink: optionalUrl.optional(),
  achievements: optionalStringArray,
  areasOfInterest: optionalStringArray,
  strengths: optionalStringArray,
  confirmedDomain: z.string().trim().optional(),
  domainDecisionSource: z.enum(['manual', 'detected', 'unconfirmed']).optional(),
  notificationPreferences: notificationPreferencesSchema,
})

export const recruiterProfileSchema = z.object({
  phone: z.string().trim().min(8).max(20).optional().or(z.literal('')),
  company: z.string().trim().optional(),
  designation: z.string().trim().optional(),
  companyWebsite: optionalUrl.optional(),
  companyDescription: z.string().trim().optional(),
  companyLocation: z.string().trim().optional(),
  hiringDomains: optionalStringArray,
  companySize: z.string().trim().optional(),
  companyLogo: optionalUrl.optional(),
  hiringFor: z.array(z.string()).optional(),
})

export const jobSchema = z.object({
  title: z.string().min(2),
  company: z.string().min(2),
  description: z.string().min(10),
  requiredSkills: z.array(z.string()).default([]),
  domain: z.string().trim().optional(),
  roleLabel: z.string().trim().optional(),
  location: z.string().trim().optional(),
  applyLink: optionalUrl.optional(),
  employmentType: z.string().trim().optional(),
  opportunityType: z.string().trim().optional(),
  experienceLevel: z.string().trim().optional(),
  optionalSkills: z.array(z.string()).default([]),
  salaryRange: z.string().trim().optional(),
  deadline: z.coerce.date().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

export const jobApplicationSchema = z.object({
  jobId: z.string().trim().min(1),
  resumeId: z.string().trim().min(1),
})

export const recruiterAssignmentSchema = z.object({
  roundType: z.string().trim().min(2),
  difficulty: z.string().trim().optional(),
  questionCount: z.number().int().min(1).max(20).optional(),
  topics: z.array(z.string().trim().min(1)).optional(),
  questionSource: z.enum(['platform', 'recruiter_custom']).optional(),
  customInterviewQuestionIds: z.array(z.string().trim().min(1)).optional(),
  customCodingQuestionIds: z.array(z.string().trim().min(1)).optional(),
  deadline: z.coerce.date().nullable().optional(),
  timeLimitSec: z.number().int().min(0).max(7200).optional(),
})

export const recruiterApplicationDecisionSchema = z.object({
  status: z.enum(['under_review', 'completed', 'shortlisted', 'rejected', 'hired', 'next_round']),
  recruiterNotes: z.string().trim().optional(),
})

export const recruiterInterviewQuestionSchema = z.object({
  jobId: z.string().trim().optional(),
  role: z.string().trim().min(2),
  domain: z.string().trim().min(2),
  roundType: z.enum(['hr', 'technical', 'resume_based', 'mixed', 'role_based']).default('mixed'),
  difficulty: z.string().trim().optional(),
  topic: z.string().trim().min(2),
  questionText: z.string().trim().min(8),
  answerHint: z.string().trim().optional(),
  keyPoints: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
})

export const recruiterCodingQuestionSchema = z.object({
  jobId: z.string().trim().optional(),
  domain: z.string().trim().min(2),
  role: z.string().trim().min(2),
  topic: z.string().trim().min(2),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Intermediate'),
  title: z.string().trim().min(3),
  problemStatement: z.string().trim().min(10),
  inputFormat: z.string().trim().optional(),
  outputFormat: z.string().trim().optional(),
  constraints: z.array(z.string().trim().min(1)).optional(),
  sampleInput: z.string().trim().optional(),
  sampleOutput: z.string().trim().optional(),
  explanation: z.string().trim().optional(),
  supportedLanguages: z.array(z.string().trim().min(1)).min(1),
  timeLimit: z.number().int().min(1).max(60).optional(),
  visibleTestCases: z.array(z.object({
    input: z.string().trim().min(1),
    output: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
  })).min(1),
  hiddenTestCases: z.array(z.object({
    input: z.string().trim().min(1),
    output: z.string().trim().min(1),
    explanation: z.string().trim().optional(),
  })).optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
})

export const contactRequestSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required.'),
  email: z.email('Please enter a valid email address.'),
  subject: z.string().trim().min(3, 'Subject is required.').max(120, 'Subject must be 120 characters or less.'),
  message: z.string().trim().min(10, 'Message is required.').max(3000, 'Message must be 3000 characters or less.'),
})
