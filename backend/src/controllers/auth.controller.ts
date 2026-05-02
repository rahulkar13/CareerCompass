import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { Request, Response } from 'express'
import { env } from '../config/env'
import { PasswordResetOtp } from '../models/PasswordResetOtp'
import { PendingRegistration } from '../models/PendingRegistration'
import { RecruiterProfile } from '../models/RecruiterProfile'
import { StudentProfile } from '../models/StudentProfile'
import { User } from '../models/User'
import { emailService } from '../services/emailService'
import { ApiError } from '../utils/ApiError'

const signToken = (userId: string, role: string): string =>
  jwt.sign({ userId, role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'] })

const normalizeEmail = (email: string) => email.toLowerCase().trim()
const hashOtp = (otp: string) => crypto.createHash('sha256').update(otp).digest('hex')
const generateOtp = () => `${Math.floor(100000 + Math.random() * 900000)}`
const otpExpiry = () => new Date(Date.now() + 1000 * 60 * 10)
const isMailAuthFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Username and Password not accepted') || message.includes('BadCredentials')
}
const isMailNetworkFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('ENETUNREACH') || message.includes('ETIMEDOUT') || message.includes('ECONNREFUSED')
}

export const getAuthenticatedUser = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.user?.userId).select('-password')
  if (!user) {
    throw new ApiError(404, 'User not found')
  }
  res.json({ success: true, data: user })
}

export const requestRegistrationOtp = async (req: Request, res: Response): Promise<void> => {
  const payload = req.body as {
    name: string
    email: string
    password: string
    role: 'student' | 'recruiter'
    phone?: string
    company?: string
    designation?: string
    companyWebsite?: string
  }

  if (!emailService.isConfigured) {
    throw new ApiError(503, 'Email verification service is not configured yet.')
  }

  const email = normalizeEmail(payload.email)
  const existing = await User.findOne({ email })
  if (existing) {
    throw new ApiError(409, 'Email already exists')
  }

  const otp = generateOtp()
  const passwordHash = await bcrypt.hash(payload.password, 10)

  await PendingRegistration.findOneAndUpdate(
    { email },
    {
      name: payload.name.trim(),
      email,
      passwordHash,
      role: payload.role,
      phone: String(payload.phone ?? '').trim(),
      company: String(payload.company ?? '').trim(),
      designation: String(payload.designation ?? '').trim(),
      companyWebsite: String(payload.companyWebsite ?? '').trim(),
      otpHash: hashOtp(otp),
      expiresAt: otpExpiry(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  try {
    await emailService.sendOtp({
      to: email,
      name: payload.name,
      otp,
      purpose: 'signup',
      expiresInMinutes: 10,
    })
  } catch (error) {
    if (isMailAuthFailure(error)) {
      throw new ApiError(503, 'Gmail SMTP login failed. Update EMAIL_PASS in backend/.env with a valid Gmail App Password.')
    }
    if (isMailNetworkFailure(error)) {
      throw new ApiError(503, 'Email OTP service could not reach Gmail SMTP from the server. Check EMAIL_HOST/EMAIL_PORT settings and hosting network access, then try again.')
    }
    throw error
  }

  res.status(200).json({
    success: true,
    data: {
      status: 'otp_sent',
      role: payload.role,
      message: 'OTP sent successfully. Please check your email and enter the code to continue.',
    },
  })
}

export const verifyRegistrationOtp = async (req: Request, res: Response): Promise<void> => {
  const { email: rawEmail, otp } = req.body as { email: string; otp: string }
  const email = normalizeEmail(rawEmail)
  const pending = await PendingRegistration.findOne({ email })

  if (!pending || pending.expiresAt.getTime() < Date.now() || pending.otpHash !== hashOtp(otp)) {
    throw new ApiError(400, 'Invalid or expired OTP.')
  }

  const existing = await User.findOne({ email })
  if (existing) {
    await PendingRegistration.deleteOne({ _id: pending._id })
    throw new ApiError(409, 'Email already exists')
  }

  const accountStatus = pending.role === 'recruiter' ? 'pending' : 'active'
  const user = await User.create({
    name: pending.name,
    email: pending.email,
    password: pending.passwordHash,
    role: pending.role,
    accountStatus,
    phone: pending.phone ?? '',
  })

  if (pending.role === 'student') {
    await StudentProfile.create({ userId: user._id })
    await PendingRegistration.deleteOne({ _id: pending._id })
    const token = signToken(String(user._id), pending.role)
    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, accountStatus },
    })
    return
  }

  await RecruiterProfile.create({
    userId: user._id,
    phone: pending.phone ?? '',
    company: pending.company ?? '',
    designation: pending.designation ?? '',
    companyWebsite: pending.companyWebsite ?? '',
  })
  await PendingRegistration.deleteOne({ _id: pending._id })
  res.status(201).json({
    success: true,
    data: {
      status: 'pending',
      role: 'recruiter',
      message: 'Your recruiter account request has been submitted and is waiting for admin approval.',
    },
  })
}

export const register = requestRegistrationOtp

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string }
  const user = await User.findOne({ email: normalizeEmail(email) })
  if (!user) throw new ApiError(401, 'Invalid credentials')
  if (user.accountStatus && user.accountStatus !== 'active') {
    if (user.role === 'recruiter' && user.accountStatus === 'pending') {
      throw new ApiError(403, 'Your recruiter account request is still pending admin approval.')
    }
    if (user.role === 'recruiter' && user.accountStatus === 'rejected') {
      throw new ApiError(403, 'Your recruiter account request was rejected. Please contact the administrator for clarification.')
    }
    throw new ApiError(403, `This account is currently ${user.accountStatus}. Please contact the administrator.`)
  }
  const ok = await bcrypt.compare(password, user.password)
  if (!ok) throw new ApiError(401, 'Invalid credentials')
  const token = signToken(String(user._id), user.role)
  res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role } })
}

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email: rawEmail } = req.body as { email: string }
  const email = normalizeEmail(rawEmail)
  const user = await User.findOne({ email })

  if (!user) {
    res.json({
      success: true,
      data: {
        message: 'If an account with that email exists, a password reset OTP has been sent.',
      },
    })
    return
  }

  if (!emailService.isConfigured) {
    throw new ApiError(503, 'Password reset email service is not configured yet.')
  }

  const otp = generateOtp()
  await PasswordResetOtp.findOneAndUpdate(
    { email },
    {
      userId: user._id,
      email,
      otpHash: hashOtp(otp),
      expiresAt: otpExpiry(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  try {
    await emailService.sendOtp({
      to: user.email,
      name: user.name,
      otp,
      purpose: 'forgot_password',
      expiresInMinutes: 10,
    })
  } catch (error) {
    if (isMailAuthFailure(error)) {
      throw new ApiError(503, 'Gmail SMTP login failed. Update EMAIL_PASS in backend/.env with a valid Gmail App Password.')
    }
    if (isMailNetworkFailure(error)) {
      throw new ApiError(503, 'Password reset email service could not reach Gmail SMTP from the server. Check EMAIL_HOST/EMAIL_PORT settings and hosting network access, then try again.')
    }
    throw error
  }

  res.json({
    success: true,
    data: {
      message: 'If an account with that email exists, a password reset OTP has been sent.',
    },
  })
}

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { email: rawEmail, otp, password } = req.body as { email: string; otp: string; password: string }
  const email = normalizeEmail(rawEmail)
  const resetOtp = await PasswordResetOtp.findOne({ email })

  if (!resetOtp || resetOtp.expiresAt.getTime() < Date.now() || resetOtp.otpHash !== hashOtp(otp)) {
    throw new ApiError(400, 'Invalid or expired OTP.')
  }

  const user = await User.findById(resetOtp.userId)
  if (!user) {
    throw new ApiError(404, 'User account not found for this reset request.')
  }

  user.password = await bcrypt.hash(password, 10)
  user.forcePasswordReset = false
  await user.save()
  await PasswordResetOtp.deleteOne({ _id: resetOtp._id })

  res.json({
    success: true,
    data: {
      message: 'Password reset successful. You can now log in with your new password.',
    },
  })
}
