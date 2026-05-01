import { Schema, model } from 'mongoose'

export interface IContactRequest {
  fullName: string
  email: string
  subject: string
  message: string
  emailDelivered: boolean
  status: 'unread' | 'read'
  readAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

const contactRequestSchema = new Schema<IContactRequest>(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    emailDelivered: { type: Boolean, default: false },
    status: { type: String, enum: ['unread', 'read'], default: 'unread', index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const ContactRequest = model<IContactRequest>('ContactRequest', contactRequestSchema)
