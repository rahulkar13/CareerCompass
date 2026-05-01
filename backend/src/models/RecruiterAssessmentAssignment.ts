import { Schema, model, type Types } from 'mongoose'

export interface IRecruiterAssessmentAssignment {
  applicationId: Types.ObjectId
  studentId: Types.ObjectId
  recruiterId: Types.ObjectId
  jobId: Types.ObjectId
  roundCategory: 'interview' | 'coding'
  roundType: string
  difficulty: string
  questionCount: number
  topics: string[]
  questionSource?: 'platform' | 'recruiter_custom'
  customInterviewQuestionIds?: Types.ObjectId[]
  customCodingQuestionIds?: Types.ObjectId[]
  deadline?: Date | null
  timeLimitSec?: number
  status: 'assigned' | 'started' | 'completed' | 'reviewed'
  sessionId?: Types.ObjectId | null
  resultSummary?: Record<string, unknown>
  completedAt?: Date | null
  reviewedAt?: Date | null
}

const recruiterAssessmentAssignmentSchema = new Schema<IRecruiterAssessmentAssignment>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'JobApplication', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', required: true, index: true },
    roundCategory: { type: String, enum: ['interview', 'coding'], required: true, index: true },
    roundType: { type: String, default: '', trim: true },
    difficulty: { type: String, default: 'Intermediate', trim: true },
    questionCount: { type: Number, default: 0, min: 0, max: 30 },
    topics: { type: [String], default: [] },
    questionSource: { type: String, enum: ['platform', 'recruiter_custom'], default: 'platform', index: true },
    customInterviewQuestionIds: { type: [Schema.Types.ObjectId], default: [] },
    customCodingQuestionIds: { type: [Schema.Types.ObjectId], default: [] },
    deadline: { type: Date, default: null },
    timeLimitSec: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['assigned', 'started', 'completed', 'reviewed'], default: 'assigned', index: true },
    sessionId: { type: Schema.Types.ObjectId, default: null, index: true },
    resultSummary: { type: Schema.Types.Mixed, default: {} },
    completedAt: { type: Date, default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const RecruiterAssessmentAssignment = model<IRecruiterAssessmentAssignment>('RecruiterAssessmentAssignment', recruiterAssessmentAssignmentSchema)
