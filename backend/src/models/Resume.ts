import { Schema, model, type Types } from 'mongoose'

export interface IResume {
  userId: Types.ObjectId
  fileName: string
  fileType: string
  filePath: string
  uploadedDate: Date
  rawText: string
  extractedText: string
  htmlContent: string
  version: number
  extractedPersonalDetails: Record<string, unknown>
  extractedSkills: string[]
  extractedEducation: string[]
  extractedProjects: string[]
  extractedExperience: string[]
  extractedCertifications: string[]
  aiAnalysisResult: Record<string, unknown>
}

const resumeSchema = new Schema<IResume>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    fileType: { type: String, required: true, trim: true },
    filePath: { type: String, required: true, trim: true },
    uploadedDate: { type: Date, default: Date.now },
    rawText: { type: String, default: '' },
    extractedText: { type: String, default: '', alias: 'textContent' },
    htmlContent: { type: String, default: '' },
    version: { type: Number, default: 1, min: 1 },
    extractedPersonalDetails: { type: Schema.Types.Mixed, default: {} },
    extractedSkills: { type: [String], default: [] },
    extractedEducation: { type: [String], default: [] },
    extractedProjects: { type: [String], default: [] },
    extractedExperience: { type: [String], default: [] },
    extractedCertifications: { type: [String], default: [] },
    aiAnalysisResult: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const Resume = model<IResume>('Resume', resumeSchema)
