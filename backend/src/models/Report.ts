import { Schema, model, type Types } from 'mongoose'

export interface IReport {
  userId: Types.ObjectId
  reportType: string
  relatedId?: Types.ObjectId | null
  generatedAt: Date
  summary: string
  title: string
  payload: Record<string, unknown>
}

const reportSchema = new Schema<IReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportType: { type: String, required: true, default: 'general', trim: true, alias: 'type' },
    relatedId: { type: Schema.Types.ObjectId, default: null, index: true },
    generatedAt: { type: Date, default: Date.now },
    summary: { type: String, default: '' },
    title: { type: String, default: '' },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const Report = model<IReport>('Report', reportSchema)
