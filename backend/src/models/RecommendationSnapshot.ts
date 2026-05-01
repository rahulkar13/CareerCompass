import { Schema, model, type Types } from 'mongoose'

export interface IRecommendationSnapshot {
  userId: Types.ObjectId
  resumeId: Types.ObjectId
  jobDescriptionId?: Types.ObjectId | null
  language: 'english' | 'hindi' | 'both'
  payload: Record<string, unknown>
}

const recommendationSnapshotSchema = new Schema<IRecommendationSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'SavedJobDescription', default: null, index: true },
    language: { type: String, enum: ['english', 'hindi', 'both'], default: 'both', index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

recommendationSnapshotSchema.index({ userId: 1, resumeId: 1, jobDescriptionId: 1, language: 1, createdAt: -1 })

export const RecommendationSnapshot = model<IRecommendationSnapshot>('RecommendationSnapshot', recommendationSnapshotSchema)
