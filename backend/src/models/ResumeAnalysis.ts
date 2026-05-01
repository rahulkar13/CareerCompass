import { Schema, model, type Types } from 'mongoose'

export interface IResumeAnalysis {
  userId: Types.ObjectId
  resumeId: Types.ObjectId
  atsScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  content: Record<string, unknown>
}

const resumeAnalysisSchema = new Schema<IResumeAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    atsScore: { type: Number, required: true, min: 0, max: 100, alias: 'score' },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    suggestions: { type: [String], default: [] },
    content: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const ResumeAnalysis = model<IResumeAnalysis>('ResumeAnalysis', resumeAnalysisSchema)
