import { Schema, model, type Types } from 'mongoose'

export interface ISkillGapReport {
  userId: Types.ObjectId
  resumeId?: Types.ObjectId | null
  jobDescriptionId?: Types.ObjectId | null
  matchedSkills: string[]
  missingSkills: string[]
  readinessScore: number
  content: Record<string, unknown>
}

const skillGapReportSchema = new Schema<ISkillGapReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', default: null, index: true },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'JobDescription', default: null, alias: 'jobId', index: true },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    readinessScore: { type: Number, required: true, min: 0, max: 100, alias: 'score' },
    content: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const SkillGapReport = model<ISkillGapReport>('SkillGapReport', skillGapReportSchema)
