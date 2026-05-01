import type { StudentProfile, User, UserRole } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:5000'
const AUTH_STORAGE_KEY = 'interview-prep-auth'

interface ApiSuccess<T> {
  success: true
  data?: T
  token?: string
  user?: User
}

interface AuthSession {
  token: string
  user: User
}

interface LoginPayload {
  email: string
  password: string
}

interface RegisterPayload extends LoginPayload {
  name: string
  role: 'student' | 'recruiter'
  phone?: string
  company?: string
  designation?: string
  companyWebsite?: string
}

interface RegisterPendingResult {
  status: 'pending'
  role: 'recruiter'
  message: string
}

interface OtpSentResult {
  status: 'otp_sent'
  role: 'student' | 'recruiter'
  message: string
}

interface BasicMessageResult {
  message: string
}

interface UploadResumeResponse {
  resume: Record<string, unknown>
  analysis: Record<string, unknown>
}

interface ContactResponse {
  id: string
  emailDelivered: boolean
  message: string
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const session = authApi.getSession()
  const isFormData = options.body instanceof FormData
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.toLowerCase().includes('fetch')) {
      throw new Error('Cannot connect to the backend server. Make sure the backend is running on http://127.0.0.1:5000.')
    }
    throw error
  }
  const body = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401) {
      authApi.logout()
    }
    throw new Error(body?.details ?? body?.message ?? 'Request failed. Please try again.')
  }

  return body as T
}

const saveSession = (session: AuthSession): AuthSession => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  return session
}

const authFromResponse = (response: ApiSuccess<unknown>): AuthSession => {
  if (!response.token || !response.user) {
    throw new Error('Authentication response was incomplete.')
  }
  return saveSession({ token: response.token, user: response.user })
}

export const authApi = {
  login: async (payload: LoginPayload): Promise<AuthSession> => {
    const response = await request<ApiSuccess<unknown>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return authFromResponse(response)
  },
  register: async (payload: RegisterPayload): Promise<OtpSentResult> => {
    const response = await request<ApiSuccess<unknown>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return dataFromResponse(response as ApiSuccess<OtpSentResult>)
  },
  verifyRegistrationOtp: async (payload: { email: string; otp: string }): Promise<AuthSession | RegisterPendingResult> => {
    const response = await request<ApiSuccess<unknown>>('/api/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (response.data) return response.data as RegisterPendingResult
    return authFromResponse(response)
  },
  getCurrentUser: async (): Promise<User> =>
    dataFromResponse(await request<ApiSuccess<User>>('/api/auth/me')),
  forgotPassword: async (payload: { email: string }) =>
    dataFromResponse(
      await request<ApiSuccess<BasicMessageResult>>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
  resetPassword: async (payload: { email: string; otp: string; password: string }) =>
    dataFromResponse(
      await request<ApiSuccess<BasicMessageResult>>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
  refreshSession: async (): Promise<AuthSession> => {
    const session = authApi.getSession()
    if (!session) {
      throw new Error('No active session found.')
    }
    const user = await authApi.getCurrentUser()
    return saveSession({ token: session.token, user })
  },
  getSession: (): AuthSession | null => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AuthSession
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return null
    }
  },
  setSession: saveSession,
  logout: (): void => localStorage.removeItem(AUTH_STORAGE_KEY),
}

const dataFromResponse = <T>(response: ApiSuccess<T>): T => {
  if (response.data === undefined) throw new Error('API response did not include data.')
  return response.data
}

export const publicApi = {
  submitContactRequest: async (payload: { fullName: string; email: string; subject: string; message: string }) =>
    dataFromResponse(
      await request<ApiSuccess<ContactResponse>>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
}

export const studentApi = {
  getMyUser: async () => dataFromResponse(await request<ApiSuccess<User>>('/api/users/me')),
  getProfile: async () => dataFromResponse(await request<ApiSuccess<StudentProfile>>('/api/students/profile')),
  updateProfile: async (payload: Record<string, unknown>) =>
    dataFromResponse(
      await request<ApiSuccess<StudentProfile>>('/api/students/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    ),
  uploadResume: async (file: File, onProgress?: (progress: number) => void): Promise<UploadResumeResponse> => {
    const session = authApi.getSession()
    const formData = new FormData()
    formData.append('resume', file)

    return await new Promise<UploadResumeResponse>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE_URL}/api/resumes/upload`)
      if (session?.token) {
        xhr.setRequestHeader('Authorization', `Bearer ${session.token}`)
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress?.(Math.round((event.loaded / event.total) * 100))
        }
      }

      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText) as ApiSuccess<UploadResumeResponse>
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(dataFromResponse(body))
            return
          }
          if (xhr.status === 401) {
            authApi.logout()
          }
          reject(new Error((body as { details?: string; message?: string }).details ?? (body as { message?: string }).message ?? 'Resume upload failed.'))
        } catch {
          reject(new Error('Resume upload failed.'))
        }
      }

      xhr.onerror = () => reject(new Error('Resume upload failed.'))
      xhr.send(formData)
    })
  },
  listResumes: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/resumes')),
  listOpenJobs: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/jobs')),
  listApplications: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/students/applications')),
  applyToJob: async (payload: { jobId: string; resumeId: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/students/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  getInterviewAssignment: async (assignmentId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/students/applications/interview-assignment/${encodeURIComponent(assignmentId)}`)),
  getCodingAssignment: async (assignmentId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/students/applications/coding-assignment/${encodeURIComponent(assignmentId)}`)),
  analyzeResume: async (payload: { resumeText: string; htmlContent?: string; structuredData?: Record<string, unknown>; jobText?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/resumes/analysis/transient', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  matchResume: async (payload: { resumeId?: string; resumeText?: string; jobText: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/resumes/matching', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  skillGap: async (payload: { resumeId?: string; resumeText?: string; jobText?: string; targetRole?: string; selectedDomain?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/resumes/skills-gap', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  generateInterview: async (payload: { role: string; difficulty: string; resumeId?: string; resumeText?: string; jobDescriptionText?: string; companyType?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/interviews/questions/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  mockFeedback: async (payload: { question: string; answer: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/interviews/mock/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  startMockInterviewSession: async (payload: {
    role?: string
    selectedDomain?: string
    difficulty?: string
    interviewType?: string
    sessionMode?: string
    questionCount?: number
    timerEnabled?: boolean
    timerPerQuestionSec?: number
    resumeId?: string
    resumeText?: string
    jobDescriptionText?: string
    assignmentId?: string
    applicationId?: string
    recruiterId?: string
    jobId?: string
  }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/interviews/mock/session/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  submitMockInterviewAnswer: async (sessionId: string, payload: {
    questionId: string
    answer: string
    responseTimeSec?: number
    skipped?: boolean
  }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/mock/session/${encodeURIComponent(sessionId)}/answer`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  completeMockInterviewSession: async (sessionId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/mock/session/${encodeURIComponent(sessionId)}/complete`, {
      method: 'POST',
    })),
  listMockInterviewSessions: async () =>
    dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/interviews/mock/sessions')),
  getMockInterviewSession: async (sessionId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/mock/session/${encodeURIComponent(sessionId)}`)),
  getCodingTestAvailability: async (params: { domain?: string; role?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/coding/availability?domain=${encodeURIComponent(params.domain ?? '')}&role=${encodeURIComponent(params.role ?? '')}`)),
  startCodingTestSession: async (payload: {
    domain?: string
    role?: string
    difficulty?: string
    language?: string
    mockInterviewSessionId?: string
    assignmentId?: string
    applicationId?: string
    recruiterId?: string
    jobId?: string
  }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/interviews/coding/session/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  getCodingTestSession: async (sessionId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/coding/session/${encodeURIComponent(sessionId)}`)),
  runCodingTestCode: async (sessionId: string, payload: { problemId: string; language: string; code: string; currentProblemIndex?: number }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/coding/session/${encodeURIComponent(sessionId)}/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  submitCodingTestCode: async (sessionId: string, payload: { problemId: string; language: string; code: string; currentProblemIndex?: number }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/interviews/coding/session/${encodeURIComponent(sessionId)}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  smartRecommendations: async (payload: { resumeId: string; language: 'english' | 'hindi' | 'both'; targetRole?: string; preferredLocation?: string; jobDescriptionText?: string; jobDescriptionId?: string; saveHistory?: boolean; selectedDomain?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/students/recommendations', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  saveJobDescription: async (payload: { resumeId: string; jobDescriptionText: string; targetRole?: string; preferredLocation?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/students/recommendations/job-description', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  getLatestJobDescription: async (resumeId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown> | null>>(`/api/students/recommendations/job-description/latest?resumeId=${encodeURIComponent(resumeId)}`)),
  getLatestRecommendations: async (resumeId: string, options?: { jobDescriptionId?: string; language?: 'english' | 'hindi' | 'both' }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown> | null>>(`/api/students/recommendations/latest?resumeId=${encodeURIComponent(resumeId)}${options?.jobDescriptionId ? `&jobDescriptionId=${encodeURIComponent(options.jobDescriptionId)}` : ''}${options?.language ? `&language=${encodeURIComponent(options.language)}` : ''}`)),
  listReports: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/reports')),
  createReport: async (payload: { type: string; title: string; payload: unknown }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
}

export const recruiterApi = {
  getProfile: async () => dataFromResponse(await request<ApiSuccess<Record<string, unknown> | null>>('/api/recruiters/profile')),
  updateProfile: async (payload: Record<string, unknown>) =>
    dataFromResponse(
      await request<ApiSuccess<Record<string, unknown>>>('/api/recruiters/profile', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    ),
  createJob: async (payload: Record<string, unknown>) =>
    dataFromResponse(
      await request<ApiSuccess<Record<string, unknown>>>('/api/recruiters/jobs', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
  listJobs: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/recruiters/jobs')),
  listApplications: async (jobId?: string) =>
    dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>(`/api/recruiters/applications${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`)),
  updateApplicationDecision: async (applicationId: string, payload: { status: string; recruiterNotes?: string }) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/applications/${encodeURIComponent(applicationId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })),
  assignInterviewRound: async (applicationId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/applications/${encodeURIComponent(applicationId)}/assign-interview`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  assignCodingRound: async (applicationId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/applications/${encodeURIComponent(applicationId)}/assign-coding`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  listInterviewQuestions: async () =>
    dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/recruiters/interview-questions')),
  createInterviewQuestion: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/recruiters/interview-questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  deleteInterviewQuestion: async (questionId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/interview-questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    })),
  listCodingQuestions: async () =>
    dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/recruiters/coding-questions')),
  createCodingQuestion: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/recruiters/coding-questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  deleteCodingQuestion: async (questionId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/coding-questions/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    })),
  updateJob: async (jobId: string, payload: Record<string, unknown>) =>
    dataFromResponse(
      await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/jobs/${encodeURIComponent(jobId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    ),
  deleteJob: async (jobId: string) =>
    dataFromResponse(
      await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      }),
    ),
  candidateRanking: async () =>
    dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/recruiters/candidate-ranking')),
  shortlistCandidate: async (payload: { candidateId: string; jobId?: string; notes?: string }) =>
    dataFromResponse(
      await request<ApiSuccess<Record<string, unknown>>>('/api/recruiters/shortlisted', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    ),
  listShortlisted: async () =>
    dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/recruiters/shortlisted')),
  removeShortlisted: async (shortlistedId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/recruiters/shortlisted/${encodeURIComponent(shortlistedId)}`, {
      method: 'DELETE',
    })),
}

export const adminApi = {
  getOverview: async () => dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/overview')),
  listStudents: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/students')),
  getStudentDetail: async (studentId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/students/${encodeURIComponent(studentId)}`)),
  listRecruiters: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/recruiters')),
  getRecruiterDetail: async (recruiterId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/recruiters/${encodeURIComponent(recruiterId)}`)),
  listUsers: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/users')),
  listRecruiterRequests: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/recruiter-requests')),
  listActivityLogs: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/activity-logs')),
  updateUser: async (userId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })),
  createUser: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  deleteUser: async (userId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    })),
  listResumes: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/resumes')),
  deleteResume: async (resumeId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/resumes/${encodeURIComponent(resumeId)}`, {
      method: 'DELETE',
    })),
  listFields: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/fields')),
  createField: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/fields', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  updateField: async (fieldKey: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/fields/${encodeURIComponent(fieldKey)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })),
  listInterviewQuestions: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/question-bank/interview')),
  createInterviewQuestion: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/question-bank/interview', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  updateInterviewQuestion: async (questionId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/question-bank/interview/${encodeURIComponent(questionId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })),
  deleteInterviewQuestion: async (questionId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/question-bank/interview/${encodeURIComponent(questionId)}`, {
      method: 'DELETE',
    })),
  importInterviewQuestions: async (questions: Array<Record<string, unknown>>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/question-bank/interview/import', {
      method: 'POST',
      body: JSON.stringify({ questions }),
    })),
  listCodingQuestions: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/question-bank/coding')),
  createCodingQuestion: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/question-bank/coding', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  updateCodingQuestion: async (problemId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/question-bank/coding/${encodeURIComponent(problemId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })),
  deleteCodingQuestion: async (problemId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/question-bank/coding/${encodeURIComponent(problemId)}`, {
      method: 'DELETE',
    })),
  listJobs: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/jobs')),
  createJob: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  updateJob: async (jobId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })),
  deleteJob: async (jobId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    })),
  listReports: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/reports')),
  deleteReport: async (reportId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/reports/${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
    })),
  listMockInterviews: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/mock-interviews')),
  listCodingTests: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/coding-tests')),
  listNotifications: async () => dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/notifications')),
  createNotification: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/notifications', {
      method: 'POST',
      body: JSON.stringify(payload),
    })),
  deleteNotification: async (notificationId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'DELETE',
    })),
  listContacts: async () => dataFromResponse(await request<ApiSuccess<Array<Record<string, unknown>>>>('/api/admin/contacts')),
  updateContact: async (contactId: string, payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/contacts/${encodeURIComponent(contactId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })),
  deleteContact: async (contactId: string) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>(`/api/admin/contacts/${encodeURIComponent(contactId)}`, {
      method: 'DELETE',
    })),
  getSettings: async () => dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/settings')),
  updateSettings: async (payload: Record<string, unknown>) =>
    dataFromResponse(await request<ApiSuccess<Record<string, unknown>>>('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })),
}

export const dashboardPathByRole = (role: UserRole): string => {
  if (role === 'recruiter') return '/recruiter/dashboard'
  if (role === 'admin') return '/admin/dashboard'
  return '/student/dashboard'
}
