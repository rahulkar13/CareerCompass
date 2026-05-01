import { Schema, model, type Types } from 'mongoose'

export interface IPasswordResetOtp {
  userId: Types.ObjectId
  email: string
  otpHash: string
  expiresAt: Date
}

const passwordResetOtpSchema = new Schema<IPasswordResetOtp>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    otpHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
)

export const PasswordResetOtp = model<IPasswordResetOtp>('PasswordResetOtp', passwordResetOtpSchema)
