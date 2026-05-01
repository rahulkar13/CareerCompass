import type { Request, Response } from 'express'
import {
  CodingTestSession,
  JobApplication,
  JobDescription,
  MockInterview,
  Profile,
  RecruiterCodingQuestion,
  RecruiterAssessmentAssignment,
  RecruiterInterviewQuestion,
  RecruiterProfile,
  Resume,
  SkillGapReport,
  User,
} from '../models/CoreModels'
import { ApiError } from '../utils/ApiError'

type ApiRow = Record<string, unknown>

const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const uniqueStrings = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))]

const isCodingRelevant = (domain: string, role: string): boolean => {
  const normalizedRole = normalize(role)
  if (domain === 'it_software') return true
  if (domain === 'data_analytics') return /sql|python|analyst|analytics|bi/.test(normalizedRole)
  return ['developer', 'engineer', 'software', 'frontend', 'backend', 'full stack', 'fullstack', 'automation', 'sdet', 'python', 'sql'].some((keyword) => normalizedRole.includes(keyword))
}

const computeApplicationStatus = (assignments: Array<Record<string, unknown>>, currentStatus?: string): string => {
  if (currentStatus === 'shortlisted' || currentStatus === 'rejected' || currentStatus === 'hired' || currentStatus === 'next_round') return currentStatus
  const hasPendingCoding = assignments.some((item) => String(item.roundCategory ?? '') === 'coding' && String(item.status ?? '') !== 'completed' && String(item.status ?? '') !== 'reviewed')
  const hasPendingInterview = assignments.some((item) => String(item.roundCategory ?? '') === 'interview' && String(item.status ?? '') !== 'completed' && String(item.status ?? '') !== 'reviewed')
  const hasAnyAssignments = assignments.length > 0
  const allCompleted = hasAnyAssignments && assignments.every((item) => ['completed', 'reviewed'].includes(String(item.status ?? '')))
  if (hasPendingCoding) return 'coding_round_assigned'
  if (hasPendingInterview) return 'interview_assigned'
  if (allCompleted) return 'completed'
  return currentStatus || 'applied'
}

const buildRoundSummary = async (assignment: ApiRow) => {
  const roundCategory = String(assignment.roundCategory ?? '')
  const sessionId = String(assignment.sessionId ?? '')
  const customInterviewQuestionIds = Array.isArray(assignment.customInterviewQuestionIds) ? assignment.customInterviewQuestionIds.map((item) => String(item)) : []
  const customCodingQuestionIds = Array.isArray(assignment.customCodingQuestionIds) ? assignment.customCodingQuestionIds.map((item) => String(item)) : []
  let sessionSummary: Record<string, unknown> | null = null
  if (roundCategory === 'interview' && sessionId) {
    const session = await MockInterview.findById(sessionId).lean<Record<string, unknown> | null>()
    if (session) {
      const evaluation = (session.evaluation ?? {}) as Record<string, unknown>
      sessionSummary = {
        sessionId,
        score: Number(session.score ?? 0),
        summary: String(evaluation.summary ?? ''),
        strongAreas: Array.isArray(evaluation.strongAreas) ? evaluation.strongAreas : [],
        weakAreas: Array.isArray(evaluation.weakAreas) ? evaluation.weakAreas : [],
        questionCount: Number(session.questionCount ?? 0),
        questions: Array.isArray(session.questions) ? session.questions : [],
        answers: Array.isArray(session.answerItems) ? session.answerItems : [],
      }
    }
  }
  if (roundCategory === 'coding' && sessionId) {
    const session = await CodingTestSession.findById(sessionId).lean<Record<string, unknown> | null>()
    if (session) {
      const finalAttempt = (session.finalAttempt ?? {}) as Record<string, unknown>
      sessionSummary = {
        sessionId,
        score: Number(session.finalScore ?? 0),
        status: String(finalAttempt.status ?? session.status ?? ''),
        language: String(session.selectedLanguage ?? ''),
        passedCount: Number(finalAttempt.passedCount ?? 0),
        totalCount: Number(finalAttempt.totalCount ?? 0),
        timeTakenSec: Number(session.timeTakenSec ?? 0),
        weakTopics: Array.isArray(session.weakTopics) ? session.weakTopics : [],
        solvedTopics: Array.isArray(session.solvedTopics) ? session.solvedTopics : [],
        problems: Array.isArray(session.problemIds) ? session.problemIds : [],
        submittedCode: String(session.submittedCode ?? ''),
        finalAttempt,
      }
    }
  }

  const [customInterviewQuestions, customCodingQuestions] = await Promise.all([
    customInterviewQuestionIds.length ? RecruiterInterviewQuestion.find({ _id: { $in: customInterviewQuestionIds } }).lean<Array<Record<string, unknown>>>() : Promise.resolve([]),
    customCodingQuestionIds.length ? RecruiterCodingQuestion.find({ _id: { $in: customCodingQuestionIds } }).lean<Array<Record<string, unknown>>>() : Promise.resolve([]),
  ])

  return {
    ...assignment,
    resultSummary: assignment.resultSummary ?? sessionSummary ?? {},
    sessionSummary,
    questionSource: String(assignment.questionSource ?? 'platform'),
    customInterviewQuestions: customInterviewQuestions.map((question) => ({
      id: String(question._id ?? ''),
      role: String(question.role ?? ''),
      domain: String(question.domain ?? ''),
      roundType: String(question.roundType ?? ''),
      topic: String(question.topic ?? ''),
      difficulty: String(question.difficulty ?? ''),
      questionText: String(question.questionText ?? ''),
      answerHint: String(question.answerHint ?? ''),
      keyPoints: Array.isArray(question.keyPoints) ? question.keyPoints : [],
      tags: Array.isArray(question.tags) ? question.tags : [],
    })),
    customCodingQuestions: customCodingQuestions.map((question) => ({
      id: String(question._id ?? ''),
      role: String(question.role ?? ''),
      domain: String(question.domain ?? ''),
      topic: String(question.topic ?? ''),
      difficulty: String(question.difficulty ?? ''),
      title: String(question.title ?? ''),
      problemStatement: String(question.problemStatement ?? ''),
      inputFormat: String(question.inputFormat ?? ''),
      outputFormat: String(question.outputFormat ?? ''),
      constraints: Array.isArray(question.constraints) ? question.constraints : [],
      sampleInput: String(question.sampleInput ?? ''),
      sampleOutput: String(question.sampleOutput ?? ''),
      explanation: String(question.explanation ?? ''),
      supportedLanguages: Array.isArray(question.supportedLanguages) ? question.supportedLanguages : [],
      timeLimit: Number(question.timeLimit ?? 0),
      visibleTestCases: Array.isArray(question.visibleTestCases) ? question.visibleTestCases : [],
      hiddenTestCasesCount: Array.isArray(question.hiddenTestCases) ? question.hiddenTestCases.length : 0,
    })),
  }
}

const buildApplicationView = async (application: ApiRow) => {
  const [student, recruiter, recruiterProfile, profile, resume, job, assignments, latestSkillGap] = await Promise.all([
    User.findById(application.studentId as any).lean<ApiRow | null>(),
    User.findById(application.recruiterId as any).lean<ApiRow | null>(),
    RecruiterProfile.findOne({ userId: application.recruiterId as any }).lean<ApiRow | null>(),
    Profile.findOne({ userId: application.studentId as any }).lean<ApiRow | null>(),
    Resume.findById(application.resumeId as any).lean<ApiRow | null>(),
    JobDescription.findById(application.jobId as any).lean<ApiRow | null>(),
    RecruiterAssessmentAssignment.find({ applicationId: application._id as any }).sort({ createdAt: -1 }).lean<ApiRow[]>(),
    SkillGapReport.findOne({ userId: application.studentId as any }).sort({ createdAt: -1 }).lean<ApiRow | null>(),
  ])

  const rounds = await Promise.all(assignments.map((assignment) => buildRoundSummary(assignment)))
  const nextStatus = computeApplicationStatus(rounds, String(application.status ?? 'applied'))

  if (nextStatus !== String(application.status ?? 'applied')) {
    await JobApplication.updateOne({ _id: application._id }, { $set: { status: nextStatus } })
  }

  return {
    ...application,
    status: nextStatus,
    student: student ? {
      id: String(student._id ?? ''),
      name: String(student.name ?? ''),
      email: String(student.email ?? ''),
      field: String(profile?.confirmedDomain ?? profile?.preferredIndustry ?? profile?.branch ?? ''),
      targetRole: String(profile?.preferredJobRole ?? ''),
      education: [String(profile?.degree ?? '').trim(), String(profile?.branch ?? '').trim(), String(profile?.collegeName ?? '').trim()].filter(Boolean).join(' | '),
      skills: uniqueStrings([
        ...(Array.isArray(profile?.technicalSkills) ? profile.technicalSkills.map((item) => String(item)) : []),
        ...(Array.isArray(profile?.skills) ? profile.skills.map((item) => String(item)) : []),
      ]),
      projects: Array.isArray(profile?.projects) ? profile.projects : [],
      summary: String(profile?.summary ?? ''),
      readinessSummary: latestSkillGap ? {
        readinessScore: Number(latestSkillGap.readinessScore ?? 0),
        missingSkills: Array.isArray(latestSkillGap.missingSkills) ? latestSkillGap.missingSkills : [],
        weakSkills: Array.isArray((latestSkillGap.content as Record<string, unknown> | undefined)?.weakSkills) ? (latestSkillGap.content as Record<string, unknown>).weakSkills as unknown[] : [],
      } : null,
    } : null,
    recruiter: recruiter ? {
      id: String(recruiter._id ?? ''),
      name: String(recruiter.name ?? ''),
      email: String(recruiter.email ?? ''),
      company: String(recruiterProfile?.company ?? ''),
    } : null,
    job: job ? {
      id: String(job._id ?? ''),
      title: String(job.title ?? ''),
      company: String(job.company ?? ''),
      domain: String(job.domain ?? ''),
      roleLabel: String(job.roleLabel ?? ''),
      location: String(job.location ?? ''),
      opportunityType: String(job.opportunityType ?? job.employmentType ?? ''),
    } : null,
    resume: resume ? {
      id: String(resume._id ?? ''),
      fileName: String(resume.fileName ?? ''),
      uploadedDate: resume.uploadedDate,
      extractedSkills: Array.isArray(resume.extractedSkills) ? resume.extractedSkills : [],
      extractedProjects: Array.isArray(resume.extractedProjects) ? resume.extractedProjects : [],
      extractedExperience: Array.isArray(resume.extractedExperience) ? resume.extractedExperience : [],
      extractedEducation: Array.isArray(resume.extractedEducation) ? resume.extractedEducation : [],
      extractedCertifications: Array.isArray(resume.extractedCertifications) ? resume.extractedCertifications : [],
      previewText: String(resume.extractedText ?? '').slice(0, 2500),
      htmlContent: String(resume.htmlContent ?? ''),
    } : null,
    assignedRounds: rounds,
    recruiterNotes: String(application.recruiterNotes ?? ''),
    recruiterReviewStatus: String(application.recruiterReviewStatus ?? ''),
  }
}

export const applyToJob = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.user?.userId ?? '')
  const { jobId, resumeId } = req.body as { jobId: string; resumeId: string }
  const [job, resume] = await Promise.all([
    JobDescription.findById(jobId).lean<Record<string, unknown> | null>(),
    Resume.findOne({ _id: resumeId, userId: studentId }).lean<Record<string, unknown> | null>(),
  ])
  if (!job) throw new ApiError(404, 'Job not found.')
  if (!resume) throw new ApiError(400, 'Selected resume was not found for this student.')

  const recruiterId = String(job.userId ?? '')
  const existing = await JobApplication.findOne({ studentId, jobId }).lean<Record<string, unknown> | null>()
  if (existing) throw new ApiError(400, 'You already applied to this job.')

  const application = await JobApplication.create({
    studentId,
    recruiterId,
    jobId,
    resumeId,
    appliedAt: new Date(),
    status: 'applied',
    recruiterReviewStatus: 'new',
    recruiterNotes: '',
  })
  res.status(201).json({ success: true, data: await buildApplicationView(application.toObject() as unknown as ApiRow) })
}

export const listStudentApplications = async (req: Request, res: Response): Promise<void> => {
  const studentId = String(req.user?.userId ?? '')
  const applications = await JobApplication.find({ studentId }).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>()
  const data = await Promise.all(applications.map((application) => buildApplicationView(application)))
  res.json({ success: true, data })
}

export const listRecruiterApplications = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const jobId = String(req.query.jobId ?? '').trim()
  const query = jobId ? { recruiterId, jobId } : { recruiterId }
  const applications = await JobApplication.find(query).sort({ createdAt: -1 }).lean<Array<Record<string, unknown>>>()
  const data = await Promise.all(applications.map((application) => buildApplicationView(application)))
  res.json({ success: true, data })
}

export const updateRecruiterApplicationDecision = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const applicationId = String(req.params.applicationId ?? '')
  const { status, recruiterNotes = '' } = req.body as { status: string; recruiterNotes?: string }
  const updated = await JobApplication.findOneAndUpdate(
    { _id: applicationId, recruiterId },
    { $set: { status, recruiterNotes, recruiterReviewStatus: status } },
    { new: true },
  ).lean<ApiRow | null>()
  if (!updated) throw new ApiError(404, 'Application not found.')
  res.json({ success: true, data: await buildApplicationView(updated) })
}

const createAssignment = async (
  applicationId: string,
  recruiterId: string,
  roundCategory: 'interview' | 'coding',
  payload: Record<string, unknown>,
) => {
  const application = await JobApplication.findOne({ _id: applicationId, recruiterId }).lean<ApiRow | null>()
  if (!application) throw new ApiError(404, 'Application not found.')
  const job = await JobDescription.findById(application.jobId).lean<Record<string, unknown> | null>()
  if (!job) throw new ApiError(404, 'Related job not found.')
  if (roundCategory === 'coding' && !isCodingRelevant(String(job.domain ?? ''), String(job.roleLabel ?? job.title ?? ''))) {
    throw new ApiError(400, 'Coding rounds are only available for coding-related jobs.')
  }
  const questionSource = String(payload.questionSource ?? 'platform') === 'recruiter_custom' ? 'recruiter_custom' : 'platform'
  const customInterviewQuestionIds = Array.isArray(payload.customInterviewQuestionIds) ? payload.customInterviewQuestionIds.map((item) => String(item)) : []
  const customCodingQuestionIds = Array.isArray(payload.customCodingQuestionIds) ? payload.customCodingQuestionIds.map((item) => String(item)) : []
  if (questionSource === 'recruiter_custom') {
    if (roundCategory === 'interview') {
      if (!customInterviewQuestionIds.length) throw new ApiError(400, 'Select at least one recruiter interview question.')
      const count = await RecruiterInterviewQuestion.countDocuments({ _id: { $in: customInterviewQuestionIds }, recruiterId })
      if (count !== customInterviewQuestionIds.length) throw new ApiError(403, 'One or more recruiter interview questions are not accessible.')
    }
    if (roundCategory === 'coding') {
      if (!customCodingQuestionIds.length) throw new ApiError(400, 'Select at least one recruiter coding question.')
      const count = await RecruiterCodingQuestion.countDocuments({ _id: { $in: customCodingQuestionIds }, recruiterId })
      if (count !== customCodingQuestionIds.length) throw new ApiError(403, 'One or more recruiter coding questions are not accessible.')
    }
  }

  const assignment = await RecruiterAssessmentAssignment.create({
    applicationId,
    studentId: application.studentId as any,
    recruiterId,
    jobId: application.jobId as any,
    roundCategory,
    roundType: String(payload.roundType ?? ''),
    difficulty: String(payload.difficulty ?? 'Intermediate'),
    questionCount: Number(payload.questionCount ?? (roundCategory === 'coding' ? 3 : 6)),
    topics: Array.isArray(payload.topics) ? payload.topics : [],
    questionSource,
    customInterviewQuestionIds: roundCategory === 'interview' ? customInterviewQuestionIds : [],
    customCodingQuestionIds: roundCategory === 'coding' ? customCodingQuestionIds : [],
    deadline: (payload.deadline as any) ?? null,
    timeLimitSec: Number(payload.timeLimitSec ?? 0),
    status: 'assigned',
  })

  const status = roundCategory === 'coding' ? 'coding_round_assigned' : 'interview_assigned'
  await JobApplication.updateOne({ _id: applicationId }, { $set: { status, recruiterReviewStatus: status } })
  return assignment
}

export const assignInterviewRound = async (req: Request, res: Response): Promise<void> => {
  const assignment = await createAssignment(String(req.params.applicationId ?? ''), String(req.user?.userId ?? ''), 'interview', req.body as Record<string, unknown>)
  res.status(201).json({ success: true, data: assignment })
}

export const assignCodingRound = async (req: Request, res: Response): Promise<void> => {
  const assignment = await createAssignment(String(req.params.applicationId ?? ''), String(req.user?.userId ?? ''), 'coding', req.body as Record<string, unknown>)
  res.status(201).json({ success: true, data: assignment })
}

export const getInterviewAssignmentForStudent = async (req: Request, res: Response): Promise<void> => {
  const assignment = await RecruiterAssessmentAssignment.findOne({
    _id: req.params.assignmentId,
    studentId: req.user?.userId,
    roundCategory: 'interview',
  }).lean<ApiRow | null>()
  if (!assignment) throw new ApiError(404, 'Interview assignment not found.')
  res.json({ success: true, data: assignment })
}

export const getCodingAssignmentForStudent = async (req: Request, res: Response): Promise<void> => {
  const assignment = await RecruiterAssessmentAssignment.findOne({
    _id: req.params.assignmentId,
    studentId: req.user?.userId,
    roundCategory: 'coding',
  }).lean<ApiRow | null>()
  if (!assignment) throw new ApiError(404, 'Coding assignment not found.')
  res.json({ success: true, data: assignment })
}

export const listRecruiterInterviewQuestions = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const questions = await RecruiterInterviewQuestion.find({ recruiterId }).sort({ updatedAt: -1 }).lean<Array<Record<string, unknown>>>()
  res.json({ success: true, data: questions })
}

export const createRecruiterInterviewQuestion = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const created = await RecruiterInterviewQuestion.create({
    recruiterId,
    ...req.body,
    keyPoints: Array.isArray(req.body.keyPoints) ? req.body.keyPoints : [],
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    jobId: req.body.jobId || null,
  })
  res.status(201).json({ success: true, data: created })
}

export const deleteRecruiterInterviewQuestion = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const deleted = await RecruiterInterviewQuestion.findOneAndDelete({ _id: req.params.questionId, recruiterId }).lean<Record<string, unknown> | null>()
  if (!deleted) throw new ApiError(404, 'Recruiter interview question not found.')
  res.json({ success: true, data: deleted })
}

export const listRecruiterCodingQuestions = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const questions = await RecruiterCodingQuestion.find({ recruiterId }).sort({ updatedAt: -1 }).lean<Array<Record<string, unknown>>>()
  res.json({ success: true, data: questions })
}

export const createRecruiterCodingQuestion = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const created = await RecruiterCodingQuestion.create({
    recruiterId,
    ...req.body,
    constraints: Array.isArray(req.body.constraints) ? req.body.constraints : [],
    visibleTestCases: Array.isArray(req.body.visibleTestCases) ? req.body.visibleTestCases : [],
    hiddenTestCases: Array.isArray(req.body.hiddenTestCases) ? req.body.hiddenTestCases : [],
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    jobId: req.body.jobId || null,
  })
  res.status(201).json({ success: true, data: created })
}

export const deleteRecruiterCodingQuestion = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const deleted = await RecruiterCodingQuestion.findOneAndDelete({ _id: req.params.questionId, recruiterId }).lean<Record<string, unknown> | null>()
  if (!deleted) throw new ApiError(404, 'Recruiter coding question not found.')
  res.json({ success: true, data: deleted })
}
