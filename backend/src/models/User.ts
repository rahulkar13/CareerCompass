import { Schema, model, type Types } from 'mongoose'

export type UserRole = 'student' | 'recruiter' | 'admin'
export type UserAccountStatus = 'active' | 'pending' | 'rejected' | 'blocked' | 'deactivated'

export interface IUser {
  name: string
  email: string
  password: string
  role: UserRole
  accountStatus?: UserAccountStatus
  lastActiveAt?: Date | null
  phone?: string
  createdBy?: Types.ObjectId | null
  createdByRole?: UserRole | null
  createdManuallyByAdmin?: boolean
  forcePasswordReset?: boolean
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'recruiter', 'admin'], required: true },
    phone: { type: String, default: '' },
    accountStatus: { type: String, enum: ['active', 'pending', 'rejected', 'blocked', 'deactivated'], default: 'active', index: true },
    lastActiveAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdByRole: { type: String, enum: ['student', 'recruiter', 'admin'], default: null },
    createdManuallyByAdmin: { type: Boolean, default: false, index: true },
    forcePasswordReset: { type: Boolean, default: false },
  },
  { timestamps: true },
)

export const User = model<IUser>('User', userSchema)
