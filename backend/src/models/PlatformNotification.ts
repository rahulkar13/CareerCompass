import { Schema, model, type Types } from 'mongoose'

export interface IPlatformNotification {
  title: string
  message: string
  tone: 'info' | 'warning' | 'success'
  audience: 'all' | 'students' | 'admins' | 'recruiters'
  actionLink?: string
  active: boolean
  createdBy?: Types.ObjectId | null
}

const platformNotificationSchema = new Schema<IPlatformNotification>(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    tone: { type: String, enum: ['info', 'warning', 'success'], default: 'info' },
    audience: { type: String, enum: ['all', 'students', 'admins', 'recruiters'], default: 'all', index: true },
    actionLink: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)

export const PlatformNotification = model<IPlatformNotification>('PlatformNotification', platformNotificationSchema)
