import { Schema, model, type Types } from 'mongoose'

export interface ISavedJobDescription {
  userId: Types.ObjectId
  resumeId: Types.ObjectId
  jobDescriptionText: string
  targetRole: string
  preferredLocation: string
}

const savedJobDescriptionSchema = new Schema<ISavedJobDescription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    jobDescriptionText: { type: String, required: true, trim: true },
    targetRole: { type: String, default: '', trim: true },
    preferredLocation: { type: String, default: '', trim: true },
  },
  { timestamps: true },
)

savedJobDescriptionSchema.index({ userId: 1, resumeId: 1, createdAt: -1 })

export const SavedJobDescription = model<ISavedJobDescription>('SavedJobDescription', savedJobDescriptionSchema)
