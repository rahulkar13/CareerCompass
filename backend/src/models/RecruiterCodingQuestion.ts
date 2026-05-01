import { Schema, model, type Types } from 'mongoose'

export interface IRecruiterCodingQuestionTestCase {
  input: string
  output: string
  explanation?: string
}

export interface IRecruiterCodingQuestion {
  recruiterId: Types.ObjectId
  jobId?: Types.ObjectId | null
  domain: string
  role: string
  topic: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  title: string
  problemStatement: string
  inputFormat: string
  outputFormat: string
  constraints: string[]
  sampleInput: string
  sampleOutput: string
  explanation: string
  supportedLanguages: string[]
  timeLimit: number
  visibleTestCases: IRecruiterCodingQuestionTestCase[]
  hiddenTestCases: IRecruiterCodingQuestionTestCase[]
  tags: string[]
}

const recruiterCodingTestCaseSchema = new Schema<IRecruiterCodingQuestionTestCase>(
  {
    input: { type: String, required: true, trim: true },
    output: { type: String, required: true, trim: true },
    explanation: { type: String, default: '', trim: true },
  },
  { _id: false },
)

const recruiterCodingQuestionSchema = new Schema<IRecruiterCodingQuestion>(
  {
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', default: null, index: true },
    domain: { type: String, default: '', trim: true, index: true },
    role: { type: String, default: '', trim: true, index: true },
    topic: { type: String, default: '', trim: true, index: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Intermediate' },
    title: { type: String, required: true, trim: true },
    problemStatement: { type: String, required: true, trim: true },
    inputFormat: { type: String, default: '', trim: true },
    outputFormat: { type: String, default: '', trim: true },
    constraints: { type: [String], default: [] },
    sampleInput: { type: String, default: '', trim: true },
    sampleOutput: { type: String, default: '', trim: true },
    explanation: { type: String, default: '', trim: true },
    supportedLanguages: { type: [String], default: ['python', 'javascript'] },
    timeLimit: { type: Number, default: 2, min: 1 },
    visibleTestCases: { type: [recruiterCodingTestCaseSchema], default: [] },
    hiddenTestCases: { type: [recruiterCodingTestCaseSchema], default: [] },
    tags: { type: [String], default: [], index: true },
  },
  { timestamps: true },
)

export const RecruiterCodingQuestion = model<IRecruiterCodingQuestion>('RecruiterCodingQuestion', recruiterCodingQuestionSchema)
