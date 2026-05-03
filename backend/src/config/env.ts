import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

const explicitEnvPath = path.resolve(__dirname, '../../.env')

if (fs.existsSync(explicitEnvPath)) {
  dotenv.config({ path: explicitEnvPath })
} else {
  dotenv.config()
}

const isProduction = process.env.NODE_ENV === 'production'
const configuredDbUrl = process.env.DB_URL ?? process.env.MONGO_URI ?? ''

if (isProduction && !configuredDbUrl) {
  throw new Error('Missing DB_URL (or MONGO_URI) environment variable in production. Add it in your hosting provider settings before starting the backend.')
}

const dbUrl = configuredDbUrl || 'mongodb://127.0.0.1:27017/interview-preparation-system'

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 5000),
  dbUrl,
  mongoUri: dbUrl,
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://127.0.0.1:5173',
  emailUser: process.env.EMAIL_USER ?? '',
  emailPass: process.env.EMAIL_PASS ?? '',
  emailHost: process.env.EMAIL_HOST ?? '',
  emailPort: Number(process.env.EMAIL_PORT ?? 587),
  emailSecure: String(process.env.EMAIL_SECURE ?? 'false').toLowerCase() === 'true',
  emailFromName: process.env.EMAIL_FROM_NAME ?? 'CareerCompass',
  emailFrom: process.env.EMAIL_FROM ?? process.env.EMAIL_USER ?? 'no-reply@careercompass.local',
  allowOtpFallback: String(process.env.ALLOW_OTP_FALLBACK ?? 'false').toLowerCase() === 'true',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
  codeExecutionBaseUrl: process.env.CODE_EXECUTION_BASE_URL ?? 'https://ce.judge0.com',
  codeExecutionApiKey: process.env.CODE_EXECUTION_API_KEY ?? '',
  codeExecutionApiHost: process.env.CODE_EXECUTION_API_HOST ?? '',
  codeExecutionTimeoutMs: Number(process.env.CODE_EXECUTION_TIMEOUT_MS ?? 12000),
  reminderSweepIntervalMs: Number(process.env.REMINDER_SWEEP_INTERVAL_MS ?? 1000 * 60 * 60 * 12),
}
