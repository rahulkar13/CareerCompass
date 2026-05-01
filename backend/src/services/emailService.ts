import nodemailer from 'nodemailer'
import { env } from '../config/env'

type SendEmailInput = {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

const isConfigured = Boolean(env.emailHost && env.emailPort && env.emailUser && env.emailPass)

const transporter = isConfigured
  ? nodemailer.createTransport({
      host: env.emailHost,
      port: env.emailPort,
      secure: env.emailSecure,
      auth: {
        user: env.emailUser,
        pass: env.emailPass,
      },
    })
  : null

export const emailService = {
  isConfigured,
  async send(input: SendEmailInput): Promise<{ delivered: boolean; skipped: boolean }> {
    if (!transporter) {
      console.warn(`[email] SMTP not configured. Skipping email to ${input.to}: ${input.subject}`)
      return { delivered: false, skipped: true }
    }

    await transporter.sendMail({
      from: `${env.emailFromName} <${env.emailFrom}>`,
      to: input.to,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })

    return { delivered: true, skipped: false }
  },
  async sendPasswordReset(input: { to: string; name: string; resetUrl: string }): Promise<{ delivered: boolean; skipped: boolean }> {
    const safeName = input.name.trim() || 'there'
    return this.send({
      to: input.to,
      subject: 'Reset your CareerCompass password',
      text: `Hi ${safeName},\n\nWe received a request to reset your CareerCompass password.\n\nUse this link to set a new password:\n${input.resetUrl}\n\nThis link will expire in 1 hour. If you did not request a password reset, you can ignore this email.\n`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1f2937">
          <p>Hi ${safeName},</p>
          <p>We received a request to reset your CareerCompass password.</p>
          <p>
            <a href="${input.resetUrl}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#dd6b20;color:#ffffff;text-decoration:none;font-weight:600">
              Reset password
            </a>
          </p>
          <p>If the button does not work, open this link:</p>
          <p><a href="${input.resetUrl}">${input.resetUrl}</a></p>
          <p>This link will expire in 1 hour. If you did not request a password reset, you can ignore this email.</p>
        </div>
      `,
    })
  },
  async sendOtp(input: { to: string; name: string; otp: string; purpose: 'signup' | 'forgot_password'; expiresInMinutes?: number }): Promise<{ delivered: boolean; skipped: boolean }> {
    const safeName = input.name.trim() || 'there'
    const expiresInMinutes = input.expiresInMinutes ?? 10
    const subject = input.purpose === 'signup' ? 'CareerCompass OTP Verification' : 'CareerCompass Password Reset OTP'
    const intro = input.purpose === 'signup'
      ? 'Use the OTP below to verify your email and continue creating your CareerCompass account.'
      : 'Use the OTP below to reset your CareerCompass password.'
    return this.send({
      to: input.to,
      subject,
      text: `Hi ${safeName},\n\n${intro}\n\nOTP: ${input.otp}\n\nThis OTP will expire in ${expiresInMinutes} minutes.\nDo not share this OTP with anyone.\n\nIf you did not request this, you can ignore this email.\n`,
      html: `
        <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.6;color:#1f2937">
          <p>Hi ${safeName},</p>
          <p>${intro}</p>
          <div style="margin:18px 0;padding:14px 18px;border-radius:14px;background:#fff3e8;border:1px solid #f4c18f;display:inline-block;font-size:28px;font-weight:700;letter-spacing:0.18em;color:#dd6b20">
            ${input.otp}
          </div>
          <p>This OTP will expire in ${expiresInMinutes} minutes.</p>
          <p><strong>Do not share this OTP with anyone.</strong></p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    })
  },
}
