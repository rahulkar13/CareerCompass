import { Schema, model, type Types } from 'mongoose'

export interface IInterviewQuestion {
  bankId?: string
  userId?: Types.ObjectId
  field?: string
  domain?: string
  category: string
  role: string
  skill: string
  difficulty: string
  topic: string
  companyType: string
  experienceLevel: string
  questionText: string
  questions: string[]
  answerHint: string
  keyPoints: string[]
  commonMistakes: string[]
  tags: string[]
}

const interviewQuestionSchema = new Schema<IInterviewQuestion>(
  {
    bankId: { type: String, default: null, trim: true, index: true, sparse: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    field: { type: String, default: '', trim: true, index: true },
    domain: { type: String, default: 'general', trim: true, index: true },
    category: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    skill: { type: String, default: '', trim: true },
    difficulty: { type: String, required: true, trim: true },
    topic: { type: String, default: '', trim: true, index: true },
    companyType: { type: String, default: 'campus placement', trim: true, index: true },
    experienceLevel: { type: String, default: 'student', trim: true },
    questionText: { type: String, default: '' },
    questions: { type: [String], default: [] },
    answerHint: { type: String, default: '' },
    keyPoints: { type: [String], default: [] },
    commonMistakes: { type: [String], default: [] },
    tags: { type: [String], default: [], index: true },
  },
  { timestamps: true },
)

interviewQuestionSchema.index({ bankId: 1, userId: 1 }, { unique: true, partialFilterExpression: { bankId: { $type: 'string' }, userId: null } })

export const InterviewQuestion = model<IInterviewQuestion>('InterviewQuestion', interviewQuestionSchema)
