import { Schema, model } from 'mongoose'

export interface ICodingTestCase {
  input: string
  output: string
  explanation?: string
}

export interface ICodingProblem {
  problemId: string
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
  memoryLimit: number
  visibleTestCases: ICodingTestCase[]
  hiddenTestCases: ICodingTestCase[]
  tags: string[]
}

const codingTestCaseSchema = new Schema<ICodingTestCase>(
  {
    input: { type: String, required: true, trim: true },
    output: { type: String, required: true, trim: true },
    explanation: { type: String, default: '', trim: true },
  },
  { _id: false },
)

const codingProblemSchema = new Schema<ICodingProblem>(
  {
    problemId: { type: String, required: true, unique: true, trim: true, index: true },
    domain: { type: String, required: true, trim: true, index: true },
    role: { type: String, required: true, trim: true, index: true },
    topic: { type: String, required: true, trim: true },
    difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
    title: { type: String, required: true, trim: true },
    problemStatement: { type: String, required: true, trim: true },
    inputFormat: { type: String, required: true, trim: true },
    outputFormat: { type: String, required: true, trim: true },
    constraints: { type: [String], default: [] },
    sampleInput: { type: String, default: '', trim: true },
    sampleOutput: { type: String, default: '', trim: true },
    explanation: { type: String, default: '', trim: true },
    supportedLanguages: { type: [String], default: [] },
    timeLimit: { type: Number, default: 2, min: 1 },
    memoryLimit: { type: Number, default: 256, min: 32 },
    visibleTestCases: { type: [codingTestCaseSchema], default: [] },
    hiddenTestCases: { type: [codingTestCaseSchema], default: [] },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const CodingProblem = model<ICodingProblem>('CodingProblem', codingProblemSchema)
