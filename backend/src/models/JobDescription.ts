import { Schema, model, type Types } from 'mongoose'

export interface IJobDescription {
  userId: Types.ObjectId
  title: string
  company: string
  descriptionText: string
  extractedSkills: string[]
  domain?: string
  roleLabel?: string
  location?: string
  applyLink?: string
  employmentType?: string
  opportunityType?: string
  experienceLevel?: string
  optionalSkills?: string[]
  salaryRange?: string
  deadline?: Date | null
  status?: 'active' | 'inactive'
}

const jobDescriptionSchema = new Schema<IJobDescription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, alias: 'recruiterId' },
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    descriptionText: { type: String, required: true, trim: true, alias: 'description' },
    extractedSkills: { type: [String], default: [], alias: 'requiredSkills' },
    domain: { type: String, default: '', trim: true, index: true },
    roleLabel: { type: String, default: '', trim: true },
    location: { type: String, default: '', trim: true },
    applyLink: { type: String, default: '', trim: true },
    employmentType: { type: String, default: 'full-time', trim: true },
    opportunityType: { type: String, default: 'full-time', trim: true },
    experienceLevel: { type: String, default: '', trim: true },
    optionalSkills: { type: [String], default: [] },
    salaryRange: { type: String, default: '', trim: true },
    deadline: { type: Date, default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true },
)

export const JobDescription = model<IJobDescription>('JobDescription', jobDescriptionSchema)
