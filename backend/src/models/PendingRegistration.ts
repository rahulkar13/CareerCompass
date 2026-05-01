import { Schema, model } from 'mongoose'

export interface IPendingRegistration {
  name: string
  email: string
  passwordHash: string
  role: 'student' | 'recruiter'
  phone?: string
  company?: string
  designation?: string
  companyWebsite?: string
  otpHash: string
  expiresAt: Date
}

const pendingRegistrationSchema = new Schema<IPendingRegistration>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['student', 'recruiter'], required: true },
    phone: { type: String, default: '' },
    company: { type: String, default: '' },
    designation: { type: String, default: '' },
    companyWebsite: { type: String, default: '' },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
)

export const PendingRegistration = model<IPendingRegistration>('PendingRegistration', pendingRegistrationSchema)
