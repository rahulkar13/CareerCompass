import type { Request, Response } from 'express'
import { CodingTestSession, JobApplication, MockInterview, Profile, RecruiterAssessmentAssignment, RecruiterCodingQuestion, Report, Resume, SkillGapReport } from '../models/CoreModels'
import { codingExecutionService } from '../services/codingExecutionService'
import { codingQuestionBankService, type CodingQuestion, type CodingQuestionTestCase } from '../services/codingQuestionBankService'
import { defaultRolesForDomain, domainLabel, isDomainKey, type DomainKey } from '../services/domainService'
import { reminderService } from '../services/reminderService'

const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []
const unique = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))]
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const codingRoleKeywords = [
  'developer',
  'engineer',
  'software',
  'frontend',
  'backend',
  'full stack',
  'fullstack',
  'qa automation',
  'automation',
  'sdet',
  'data analyst',
  'data analytics',
  'python',
  'sql',
]

const isCodingRelevant = (domain: string, role: string): boolean => {
  const normalizedRole = normalize(role)
  if (domain === 'it_software') return true
  if (domain === 'data_analytics') return /sql|python|analyst|analytics|bi/.test(normalizedRole)
  return codingRoleKeywords.some((keyword) => normalizedRole.includes(keyword))
}

const normalizeOutput = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()

const scoreStatus = (passPercentage: number): 'passed' | 'partial' | 'failed' => {
  if (passPercentage === 100) return 'passed'
  if (passPercentage >= 50) return 'partial'
  return 'failed'
}

const pickCodingProblems = (
  questions: CodingQuestion[],
  domain: string,
  role: string,
  difficulty: string,
  recentProblemIds: string[] = [],
  sessionOffset = 0,
): CodingQuestion[] => {
  const roleText = normalize(role)
  const ranked = questions
    .filter((question) => question.domain === domain)
    .map((question) => {
      const roleBoost = roleText.includes(normalize(question.role)) ? 12 : 0
      const difficultyBoost = question.difficulty === difficulty ? 8 : 0
      return { question, score: roleBoost + difficultyBoost + question.tags.length }
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.question)

  const fallback = ranked.length ? ranked : questions.filter((question) => question.domain === 'it_software')
  const unseen = fallback.filter((question) => !recentProblemIds.includes(question.id))
  const pool = unseen.length ? unseen : fallback

  if (!pool.length) return []
  const offset = sessionOffset % pool.length
  const rotated = [...pool.slice(offset), ...pool.slice(0, offset)]
  return rotated.slice(0, Math.min(3, rotated.length))
}

const serializeProblemForClient = (problem: CodingQuestion) => ({
  id: problem.id,
  domain: problem.domain,
  role: problem.role,
  topic: problem.topic,
  difficulty: problem.difficulty,
  title: problem.title,
  problemStatement: problem.problemStatement,
  inputFormat: problem.inputFormat,
  outputFormat: problem.outputFormat,
  constraints: problem.constraints,
  sampleInput: problem.sampleInput,
  sampleOutput: problem.sampleOutput,
  explanation: problem.explanation,
  supportedLanguages: problem.supportedLanguages,
  timeLimit: problem.timeLimit,
  memoryLimit: problem.memoryLimit,
  visibleTestCases: problem.visibleTestCases,
  tags: problem.tags,
})

const recruiterCodingQuestionToCodingQuestion = (question: Record<string, unknown>): CodingQuestion => ({
  id: String(question._id ?? ''),
  domain: String(question.domain ?? ''),
  role: String(question.role ?? ''),
  topic: String(question.topic ?? ''),
  difficulty: String(question.difficulty ?? 'Intermediate') as CodingQuestion['difficulty'],
  title: String(question.title ?? ''),
  problemStatement: String(question.problemStatement ?? ''),
  inputFormat: String(question.inputFormat ?? ''),
  outputFormat: String(question.outputFormat ?? ''),
  constraints: Array.isArray(question.constraints) ? question.constraints.map((item) => String(item)) : [],
  sampleInput: String(question.sampleInput ?? ''),
  sampleOutput: String(question.sampleOutput ?? ''),
  explanation: String(question.explanation ?? ''),
  supportedLanguages: Array.isArray(question.supportedLanguages) ? question.supportedLanguages.map((item) => String(item)) : ['python', 'javascript'],
  timeLimit: Number(question.timeLimit ?? 2),
  memoryLimit: 256,
  visibleTestCases: Array.isArray(question.visibleTestCases) ? question.visibleTestCases.map((item) => ({
    input: String((item as Record<string, unknown>).input ?? ''),
    output: String((item as Record<string, unknown>).output ?? ''),
    explanation: String((item as Record<string, unknown>).explanation ?? ''),
  })) : [],
  hiddenTestCases: Array.isArray(question.hiddenTestCases) ? question.hiddenTestCases.map((item) => ({
    input: String((item as Record<string, unknown>).input ?? ''),
    output: String((item as Record<string, unknown>).output ?? ''),
    explanation: String((item as Record<string, unknown>).explanation ?? ''),
  })) : [],
  tags: Array.isArray(question.tags) ? question.tags.map((item) => String(item)) : ['recruiter assigned'],
})

const loadProblemForSession = async (problemId: string, recruiterId?: unknown): Promise<CodingQuestion | null> => {
  const bundled = await codingQuestionBankService.loadAll()
  const foundBundled = bundled.find((item) => item.id === problemId)
  if (foundBundled) return foundBundled
  if (!recruiterId) return null
  const custom = await RecruiterCodingQuestion.findOne({ _id: problemId, recruiterId: recruiterId as any }).lean<Record<string, unknown> | null>()
  return custom ? recruiterCodingQuestionToCodingQuestion(custom) : null
}

const evaluateCodeAgainstCases = async (
  code: string,
  language: string,
  testCases: Array<CodingQuestionTestCase & { hidden: boolean }>,
) => {
  const results = await Promise.all(testCases.map(async (testCase) => {
    try {
      const execution = await codingExecutionService.executeCode(code, language, testCase.input)
      const actualOutput = execution.stdout || execution.stderr || execution.compileOutput || ''
      const passed = normalizeOutput(actualOutput) === normalizeOutput(testCase.output)
      return {
        input: testCase.input,
        expectedOutput: testCase.output,
        actualOutput,
        passed,
        hidden: testCase.hidden,
        error: execution.stderr || execution.compileOutput || '',
      }
    } catch (error) {
      return {
        input: testCase.input,
        expectedOutput: testCase.output,
        actualOutput: '',
        passed: false,
        hidden: testCase.hidden,
        error: error instanceof Error ? error.message : 'Execution failed.',
      }
    }
  }))

  const passedCount = results.filter((item) => item.passed).length
  const totalCount = results.length
  const passPercentage = totalCount ? Math.round((passedCount / totalCount) * 100) : 0
  return {
    results,
    passedCount,
    totalCount,
    passPercentage,
    status: scoreStatus(passPercentage),
  }
}

const resolveCodingContext = async (userId: string, payload: Record<string, unknown>) => {
  const resume = await Resume.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const profile = await Profile.findOne({ userId }).lean<Record<string, unknown>>()
  const latestGap = await SkillGapReport.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const latestMock = await MockInterview.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const requestedDomain = String(payload.domain ?? profile?.confirmedDomain ?? profile?.activeDomain ?? 'general_fresher').trim()
  const domain = isDomainKey(requestedDomain) ? requestedDomain : 'general_fresher'
  const role = String(payload.role ?? profile?.preferredJobRole ?? defaultRolesForDomain(domain as DomainKey)[0] ?? 'Graduate Trainee').trim()
  const difficulty = String(payload.difficulty ?? 'Intermediate').trim() || 'Intermediate'
  const codingRelevant = isCodingRelevant(domain, role)
  const gapContent = ((latestGap?.content ?? {}) as Record<string, unknown>)
  const skillGapAnalysis = ((gapContent.skillGapAnalysis ?? {}) as Record<string, unknown>)
  const weakSkills = unique([
    ...toStringArray(latestGap?.missingSkills),
    ...toStringArray(skillGapAnalysis.weakRequiredSkills),
  ])

  return {
    resume,
    profile,
    latestMock,
    domain,
    role,
    difficulty,
    codingRelevant,
    weakSkills,
  }
}

export const getCodingTestAvailability = async (req: Request, res: Response): Promise<void> => {
  const context = await resolveCodingContext(String(req.user?.userId ?? ''), req.query as Record<string, unknown>)
  const supported = context.codingRelevant
  res.json({
    success: true,
    data: {
      available: supported,
      domain: context.domain,
      domainLabel: domainLabel(context.domain as DomainKey),
      role: context.role,
      reason: supported
        ? 'Coding test is available because the selected field or role needs practical coding evaluation.'
        : 'Coding test is hidden because the selected field or role does not clearly require coding.',
      supportedLanguages: codingExecutionService.supportedLanguages,
      executionConfigured: codingExecutionService.isConfigured(),
    },
  })
}

export const startCodingTestSession = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.user?.userId ?? '')
  const assignmentId = String(req.body.assignmentId ?? '').trim()
  let assignment: Record<string, unknown> | null = null
  let lockedPayload = { ...(req.body as Record<string, unknown>) }
  if (assignmentId) {
    assignment = await RecruiterAssessmentAssignment.findOne({ _id: assignmentId, studentId: userId, roundCategory: 'coding' }).lean<Record<string, unknown> | null>()
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assigned coding round not found.' })
      return
    }
    if (['completed', 'reviewed'].includes(String(assignment.status ?? '').toLowerCase())) {
      res.status(409).json({ success: false, message: 'This recruiter-assigned coding round has already been completed.' })
      return
    }
    if (assignment.sessionId) {
      const existingSession = await CodingTestSession.findOne({ _id: assignment.sessionId, userId }).lean<Record<string, unknown> | null>()
      if (existingSession && String(existingSession.status ?? '') === 'in_progress') {
        const allProblems = await codingQuestionBankService.loadAll()
        const resumedProblems = allProblems
          .filter((problem) => toStringArray(existingSession.problemIds).includes(problem.id))
          .map(serializeProblemForClient)
        res.status(201).json({
          success: true,
          data: {
            sessionId: String(existingSession._id ?? ''),
            domain: String(existingSession.domain ?? ''),
            domainLabel: domainLabel(String(existingSession.domain ?? '') as DomainKey),
            role: String(existingSession.role ?? ''),
            supportedLanguages: resumedProblems[0]?.supportedLanguages ?? [],
            problems: resumedProblems,
            currentProblemIndex: Number(existingSession.currentProblemIndex ?? 0),
            executionConfigured: codingExecutionService.isConfigured(),
            weakTopics: toStringArray(existingSession.weakTopics),
            assessmentMode: String(existingSession.assessmentMode ?? 'recruiter_assigned'),
          },
        })
        return
      }
    }
    lockedPayload = {
      ...lockedPayload,
      domain: String(req.body.domain ?? 'it_software'),
      role: String(req.body.role ?? ''),
      difficulty: String(assignment.difficulty ?? 'Intermediate'),
    }
  }
  const context = await resolveCodingContext(userId, lockedPayload)
  if (!context.codingRelevant) {
    res.status(400).json({ success: false, message: 'Coding test is not enabled for this domain or role.' })
    return
  }

  const selectedLanguage = String(req.body.language ?? 'python').trim().toLowerCase()
  if (!codingExecutionService.isSupportedLanguage(selectedLanguage)) {
    res.status(400).json({ success: false, message: 'Selected language is not supported.' })
    return
  }

  const recentSessions = await CodingTestSession.find({ userId }).sort({ createdAt: -1 }).limit(6).lean<Array<Record<string, unknown>>>()
  const recentProblemIds = unique(recentSessions.flatMap((item) => toStringArray(item.problemIds).length ? toStringArray(item.problemIds) : [String(item.questionId ?? '')]))
  const selectedProblems = assignment && String(assignment.questionSource ?? 'platform') === 'recruiter_custom'
    ? (await RecruiterCodingQuestion.find({
      _id: { $in: Array.isArray(assignment.customCodingQuestionIds) ? assignment.customCodingQuestionIds : [] },
      recruiterId: assignment.recruiterId as any,
    }).lean<Array<Record<string, unknown>>>())
      .map((question) => recruiterCodingQuestionToCodingQuestion(question))
      .slice(0, Math.max(1, Number(assignment.questionCount ?? 1)))
    : pickCodingProblems(await codingQuestionBankService.loadAll(), context.domain, context.role, context.difficulty, recentProblemIds, recentSessions.length)
  const activeProblem = selectedProblems[0]

  if (!activeProblem) {
    res.status(404).json({ success: false, message: 'No coding problems are available for this context yet.' })
    return
  }

  const assignmentObjectId = assignment ? ((assignment as any)._id ?? null) : null
  const session = await CodingTestSession.create({
    userId,
    recruiterId: (assignment as any)?.recruiterId ?? req.body.recruiterId ?? null,
    jobId: (assignment as any)?.jobId ?? req.body.jobId ?? null,
    applicationId: (assignment as any)?.applicationId ?? req.body.applicationId ?? null,
    assignmentId: assignmentObjectId,
    mockInterviewSessionId: req.body.mockInterviewSessionId ?? null,
    domain: context.domain,
    role: context.role,
    questionId: activeProblem.id,
    problemIds: selectedProblems.map((problem) => problem.id),
    currentProblemIndex: 0,
    selectedLanguage,
    assessmentMode: assignmentObjectId ? 'recruiter_assigned' : 'practice',
    status: 'in_progress',
    submittedCode: '',
    runAttempts: [],
    finalAttempt: null,
    finalScore: 0,
    passPercentage: 0,
    weakTopics: context.weakSkills.slice(0, 4),
    solvedTopics: [],
    recommendedNextSteps: [],
    timeTakenSec: 0,
    startedAt: new Date(),
  })

  const linkedAssignmentId = assignmentObjectId
  if (linkedAssignmentId) {
    const sessionDoc = session as any
    await RecruiterAssessmentAssignment.updateOne(
      { _id: linkedAssignmentId },
      { $set: { sessionId: sessionDoc._id, status: 'started' } },
    )
  }

  res.status(201).json({
    success: true,
    data: {
      sessionId: String((session as any)._id),
      domain: context.domain,
      domainLabel: domainLabel(context.domain as DomainKey),
      role: context.role,
      supportedLanguages: activeProblem.supportedLanguages.filter((language) => codingExecutionService.isSupportedLanguage(language)),
      problems: selectedProblems.map(serializeProblemForClient),
      currentProblemIndex: 0,
      executionConfigured: codingExecutionService.isConfigured(),
      weakTopics: context.weakSkills.slice(0, 4),
      assessmentMode: assignmentObjectId ? 'recruiter_assigned' : 'practice',
    },
  })
}

export const runCodingTestCode = async (req: Request, res: Response): Promise<void> => {
  const session = await CodingTestSession.findOne({ _id: req.params.sessionId, userId: req.user?.userId })
  if (!session) {
    res.status(404).json({ success: false, message: 'Coding test session not found.' })
    return
  }
  if (String(session.status ?? '') !== 'in_progress') {
    res.status(409).json({ success: false, message: 'This coding round is already closed.' })
    return
  }

  const language = String(req.body.language ?? session.selectedLanguage).trim().toLowerCase()
  if (!codingExecutionService.isSupportedLanguage(language)) {
    res.status(400).json({ success: false, message: 'Selected language is not supported.' })
    return
  }
  if (!codingExecutionService.isConfigured()) {
    res.status(503).json({ success: false, message: 'Code execution service is not configured yet. Please connect the backend execution API first.' })
    return
  }

  const lockedAssessment = String(session.assessmentMode ?? 'practice') === 'recruiter_assigned'
  const problemId = lockedAssessment ? String(session.questionId ?? '') : String(req.body.problemId ?? session.questionId)
  const currentProblemIndex = lockedAssessment
    ? clamp(Number(session.currentProblemIndex ?? 0), 0, Math.max((session.problemIds ?? []).length - 1, 0))
    : clamp(Number(req.body.currentProblemIndex ?? session.currentProblemIndex ?? 0), 0, Math.max((session.problemIds ?? []).length - 1, 0))
  const code = String(req.body.code ?? '').trim()
  if (!code) {
    res.status(400).json({ success: false, message: 'Code is required.' })
    return
  }

  const problem = await loadProblemForSession(problemId, session.recruiterId)
  if (!problem) {
    res.status(404).json({ success: false, message: 'Coding problem not found.' })
    return
  }

  const execution = await evaluateCodeAgainstCases(
    code,
    language,
    problem.visibleTestCases.map((testCase) => ({ ...testCase, hidden: false })),
  )

  session.selectedLanguage = language
  session.questionId = problemId
  session.currentProblemIndex = currentProblemIndex
  session.submittedCode = code
  session.runAttempts.push({
    type: 'run',
    language,
    code,
    status: execution.status,
    passedCount: execution.passedCount,
    totalCount: execution.totalCount,
    score: execution.passPercentage,
    testCaseResults: execution.results,
    executionError: execution.results.find((item) => item.error)?.error ?? '',
    createdAt: new Date(),
  })
  await session.save()

  res.json({
    success: true,
    data: {
      status: execution.status,
      passedCount: execution.passedCount,
      totalCount: execution.totalCount,
      score: execution.passPercentage,
      testCaseResults: execution.results.filter((item) => !item.hidden),
      outputPreview: execution.results[0]?.actualOutput ?? '',
      executionConfigured: true,
    },
  })
}

export const submitCodingTestCode = async (req: Request, res: Response): Promise<void> => {
  const session = await CodingTestSession.findOne({ _id: req.params.sessionId, userId: req.user?.userId })
  if (!session) {
    res.status(404).json({ success: false, message: 'Coding test session not found.' })
    return
  }
  if (String(session.status ?? '') !== 'in_progress' || session.finalAttempt) {
    res.status(409).json({ success: false, message: 'This coding round has already been submitted.' })
    return
  }

  const language = String(req.body.language ?? session.selectedLanguage).trim().toLowerCase()
  if (!codingExecutionService.isSupportedLanguage(language)) {
    res.status(400).json({ success: false, message: 'Selected language is not supported.' })
    return
  }
  if (!codingExecutionService.isConfigured()) {
    res.status(503).json({ success: false, message: 'Code execution service is not configured yet. Please connect the backend execution API first.' })
    return
  }

  const lockedAssessment = String(session.assessmentMode ?? 'practice') === 'recruiter_assigned'
  const problemId = lockedAssessment ? String(session.questionId ?? '') : String(req.body.problemId ?? session.questionId)
  const currentProblemIndex = lockedAssessment
    ? clamp(Number(session.currentProblemIndex ?? 0), 0, Math.max((session.problemIds ?? []).length - 1, 0))
    : clamp(Number(req.body.currentProblemIndex ?? session.currentProblemIndex ?? 0), 0, Math.max((session.problemIds ?? []).length - 1, 0))
  const code = String(req.body.code ?? '').trim()
  if (!code) {
    res.status(400).json({ success: false, message: 'Code is required.' })
    return
  }

  const problem = await loadProblemForSession(problemId, session.recruiterId)
  if (!problem) {
    res.status(404).json({ success: false, message: 'Coding problem not found.' })
    return
  }

  const allCases = [
    ...problem.visibleTestCases.map((testCase) => ({ ...testCase, hidden: false })),
    ...problem.hiddenTestCases.map((testCase) => ({ ...testCase, hidden: true })),
  ]
  const execution = await evaluateCodeAgainstCases(code, language, allCases)
  const now = new Date()
  const timeTakenSec = session.startedAt ? Math.max(1, Math.round((now.getTime() - new Date(session.startedAt).getTime()) / 1000)) : 0
  const weakTopics = execution.status === 'passed' ? [] : [problem.topic]
  const solvedTopics = execution.status === 'passed' || execution.status === 'partial' ? [problem.topic] : []
  const recommendedNextSteps = execution.status === 'passed'
    ? [`Move to a harder ${problem.topic} problem next.`, 'Practice one debugging or optimization problem after this round.']
    : [`Retry ${problem.topic} after reviewing your failed test cases.`, 'Practice one more problem on the same topic before taking another coding round.']

  session.selectedLanguage = language
  session.questionId = problemId
  session.currentProblemIndex = currentProblemIndex
  session.submittedCode = code
  session.status = 'completed'
  session.finalAttempt = {
    type: 'submit',
    language,
    code,
    status: execution.status,
    passedCount: execution.passedCount,
    totalCount: execution.totalCount,
    score: execution.passPercentage,
    testCaseResults: execution.results,
    executionError: execution.results.find((item) => item.error)?.error ?? '',
    createdAt: now,
  }
  session.finalScore = execution.passPercentage
  session.passPercentage = execution.passPercentage
  session.weakTopics = weakTopics
  session.solvedTopics = solvedTopics
  session.recommendedNextSteps = recommendedNextSteps
  session.timeTakenSec = timeTakenSec
  session.completedAt = now
  await session.save()

  if (session.assignmentId) {
    await RecruiterAssessmentAssignment.updateOne(
      { _id: session.assignmentId as any },
      {
        $set: {
          status: 'completed',
          completedAt: now,
          resultSummary: {
            questionSet: session.problemIds,
            selectedLanguage: language,
            passedCount: execution.passedCount,
            totalCount: execution.totalCount,
            score: execution.passPercentage,
            timeTakenSec,
            status: execution.status,
            weakTopics,
            solvedTopics,
          },
        },
      },
    )
  }
  if (session.applicationId) {
    const relatedAssignments = await RecruiterAssessmentAssignment.find({ applicationId: session.applicationId as any }).lean<Array<Record<string, unknown>>>()
    const nextStatus = relatedAssignments.length && relatedAssignments.every((item) => ['completed', 'reviewed'].includes(String(item.status ?? '')))
      ? 'completed'
      : 'coding_round_assigned'
    await JobApplication.updateOne({ _id: session.applicationId }, { $set: { status: nextStatus, recruiterReviewStatus: nextStatus } })
  }

  const report = await Report.create({
    userId: req.user?.userId,
    reportType: 'Coding Test',
    title: `${problem.title} Coding Test Report`,
    summary: execution.status === 'passed'
      ? `Passed the coding test for ${problem.topic} with ${execution.passedCount}/${execution.totalCount} test cases.`
      : `Completed the coding test for ${problem.topic} with ${execution.passedCount}/${execution.totalCount} test cases.`,
    payload: {
      domain: session.domain,
      role: session.role,
      questionId: problem.id,
      problemTitle: problem.title,
      topic: problem.topic,
      selectedLanguage: language,
      passPercentage: execution.passPercentage,
      finalScore: execution.passPercentage,
      status: execution.status,
      testCasesPassed: execution.passedCount,
      totalTestCases: execution.totalCount,
      timeTakenSec,
      solvedTopics,
      weakTopics,
      recommendedNextSteps,
      assessmentMode: session.assessmentMode,
      createdAt: now.toISOString(),
    },
  })
  void reminderService.sendReportReadyNotification({
    userId: String(req.user?.userId ?? ''),
    reportType: 'Coding Test Report',
    title: String(report.title ?? `${problem.title} Coding Test Report`),
    summary: String(report.summary ?? ''),
    actionPath: '/student/reports',
    contextKey: `report:${String(report._id)}`,
  }).catch((error) => console.error('[reminders] failed to send coding report email', error))

  res.json({
    success: true,
    data: {
      status: execution.status,
      finalScore: execution.passPercentage,
      passPercentage: execution.passPercentage,
      passedCount: execution.passedCount,
      totalCount: execution.totalCount,
      timeTakenSec,
      weakTopics,
      solvedTopics,
      recommendedNextSteps,
      testCaseResults: execution.results.map((item) => item.hidden ? { ...item, input: 'Hidden test case', expectedOutput: 'Hidden', actualOutput: item.passed ? 'Passed' : item.actualOutput } : item),
    },
  })
}

export const getCodingTestSession = async (req: Request, res: Response): Promise<void> => {
  const session = await CodingTestSession.findOne({ _id: req.params.sessionId, userId: req.user?.userId }).lean<Record<string, unknown>>()
  if (!session) {
    res.status(404).json({ success: false, message: 'Coding test session not found.' })
    return
  }

  const problems = await Promise.all(toStringArray(session.problemIds).map((problemId) => loadProblemForSession(problemId, session.recruiterId)))

  res.json({
    success: true,
    data: {
      ...session,
      problems: problems.filter(Boolean).map((problem) => serializeProblemForClient(problem as CodingQuestion)),
    },
  })
}
