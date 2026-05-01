import { Schema, model, type Types } from 'mongoose'

export interface IMockInterviewSession {
  userId: Types.ObjectId
  recruiterId?: Types.ObjectId | null
  jobId?: Types.ObjectId | null
  applicationId?: Types.ObjectId | null
  assignmentId?: Types.ObjectId | null
  domain?: string
  targetRole?: string
  interviewType?: string
  difficulty?: string
  status?: 'in_progress' | 'completed' | 'abandoned'
  questionCount?: number
  timerEnabled?: boolean
  timerPerQuestionSec?: number
  currentQuestionIndex?: number
  sessionMode?: string
  assessmentMode?: 'practice' | 'recruiter_assigned'
  contextSummary?: Record<string, unknown>
  questionItems?: Array<Record<string, unknown>>
  answerItems?: Array<Record<string, unknown>>
  evaluation?: Record<string, unknown>
  recommendedNextSteps?: string[]
  startedAt?: Date | null
  completedAt?: Date | null
  questions: string[]
  answers: string[]
  score: number
  feedback: Record<string, unknown>
  createdAt: Date
}

const mockInterviewSessionSchema = new Schema<IMockInterviewSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', default: null, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', default: null, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: 'RecruiterAssessmentAssignment', default: null, index: true },
    domain: { type: String, default: 'general', trim: true, index: true },
    targetRole: { type: String, default: '', trim: true },
    interviewType: { type: String, default: 'mixed', trim: true },
    difficulty: { type: String, default: 'Intermediate', trim: true },
    status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'completed', index: true },
    questionCount: { type: Number, default: 0, min: 0, max: 30 },
    timerEnabled: { type: Boolean, default: false },
    timerPerQuestionSec: { type: Number, default: 0, min: 0 },
    currentQuestionIndex: { type: Number, default: 0, min: 0 },
    sessionMode: { type: String, default: 'quick_practice', trim: true },
    assessmentMode: { type: String, enum: ['practice', 'recruiter_assigned'], default: 'practice', trim: true, index: true },
    contextSummary: { type: Schema.Types.Mixed, default: {} },
    questionItems: { type: [Schema.Types.Mixed], default: [] },
    answerItems: { type: [Schema.Types.Mixed], default: [] },
    evaluation: { type: Schema.Types.Mixed, default: {} },
    recommendedNextSteps: { type: [String], default: [] },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    questions: { type: [String], default: [] },
    answers: { type: [String], default: [] },
    score: { type: Number, default: 0, min: 0, max: 100 },
    feedback: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const MockInterviewSession = model<IMockInterviewSession>('MockInterviewSession', mockInterviewSessionSchema)
