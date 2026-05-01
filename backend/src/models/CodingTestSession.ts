import { Schema, model, type Types } from 'mongoose'

export interface ICodingTestCaseResult {
  input: string
  expectedOutput: string
  actualOutput: string
  passed: boolean
  hidden: boolean
  error?: string
}

export interface ICodingTestAttempt {
  type: 'run' | 'submit'
  language: string
  code: string
  status: 'passed' | 'partial' | 'failed' | 'error'
  passedCount: number
  totalCount: number
  score: number
  testCaseResults: ICodingTestCaseResult[]
  executionError?: string
  createdAt: Date
}

export interface ICodingTestSession {
  userId: Types.ObjectId
  recruiterId?: Types.ObjectId | null
  jobId?: Types.ObjectId | null
  applicationId?: Types.ObjectId | null
  assignmentId?: Types.ObjectId | null
  mockInterviewSessionId?: Types.ObjectId | null
  domain: string
  role: string
  questionId: string
  problemIds: string[]
  currentProblemIndex: number
  selectedLanguage: string
  assessmentMode?: 'practice' | 'recruiter_assigned'
  status: 'in_progress' | 'completed' | 'abandoned'
  submittedCode: string
  runAttempts: ICodingTestAttempt[]
  finalAttempt?: ICodingTestAttempt | null
  finalScore: number
  passPercentage: number
  weakTopics: string[]
  solvedTopics: string[]
  recommendedNextSteps: string[]
  timeTakenSec: number
  startedAt?: Date | null
  completedAt?: Date | null
}

const codingTestCaseResultSchema = new Schema<ICodingTestCaseResult>(
  {
    input: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    actualOutput: { type: String, default: '' },
    passed: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    error: { type: String, default: '' },
  },
  { _id: false },
)

const codingTestAttemptSchema = new Schema<ICodingTestAttempt>(
  {
    type: { type: String, enum: ['run', 'submit'], required: true },
    language: { type: String, required: true, trim: true },
    code: { type: String, default: '' },
    status: { type: String, enum: ['passed', 'partial', 'failed', 'error'], required: true },
    passedCount: { type: Number, default: 0, min: 0 },
    totalCount: { type: Number, default: 0, min: 0 },
    score: { type: Number, default: 0, min: 0, max: 100 },
    testCaseResults: { type: [codingTestCaseResultSchema], default: [] },
    executionError: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const codingTestSessionSchema = new Schema<ICodingTestSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', default: null, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', default: null, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'RecruiterAssessmentAssignment', default: null, index: true },
    mockInterviewSessionId: { type: Schema.Types.ObjectId, ref: 'MockInterviewSession', default: null, index: true },
    domain: { type: String, required: true, trim: true, index: true },
    role: { type: String, required: true, trim: true },
    questionId: { type: String, required: true, trim: true },
    problemIds: { type: [String], default: [] },
    currentProblemIndex: { type: Number, default: 0, min: 0 },
    selectedLanguage: { type: String, required: true, trim: true },
    assessmentMode: { type: String, enum: ['practice', 'recruiter_assigned'], default: 'practice', trim: true, index: true },
    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress', index: true },
    submittedCode: { type: String, default: '' },
    runAttempts: { type: [codingTestAttemptSchema], default: [] },
    finalAttempt: { type: codingTestAttemptSchema, default: null },
    finalScore: { type: Number, default: 0, min: 0, max: 100 },
    passPercentage: { type: Number, default: 0, min: 0, max: 100 },
    weakTopics: { type: [String], default: [] },
    solvedTopics: { type: [String], default: [] },
    recommendedNextSteps: { type: [String], default: [] },
    timeTakenSec: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const CodingTestSession = model<ICodingTestSession>('CodingTestSession', codingTestSessionSchema)
