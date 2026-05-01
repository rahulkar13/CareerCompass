import { Schema, model, type Types } from 'mongoose'

export interface IEmailReminderLog {
  userId: Types.ObjectId
  email: string
  reminderType: string
  subject: string
  contextKey: string
  metadata: Record<string, unknown>
  sentAt: Date
}

const emailReminderLogSchema = new Schema<IEmailReminderLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    reminderType: { type: String, required: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true },
    contextKey: { type: String, required: true, trim: true, default: 'default' },
    metadata: { type: Schema.Types.Mixed, default: {} },
    sentAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
)

emailReminderLogSchema.index({ userId: 1, reminderType: 1, contextKey: 1, sentAt: -1 })

export const EmailReminderLog = model<IEmailReminderLog>('EmailReminderLog', emailReminderLogSchema)
