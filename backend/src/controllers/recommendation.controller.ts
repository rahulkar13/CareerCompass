import type { Request, Response } from 'express'
import { RecommendationSnapshot, Report, SavedJobDescription } from '../models/CoreModels'
import { isDomainKey } from '../services/domainService'
import { reminderService } from '../services/reminderService'
import { ApiError } from '../utils/ApiError'
import { recommendationService } from '../services/recommendationService'

const normalizeLanguage = (value: unknown): 'english' | 'hindi' | 'both' => {
  const lower = String(value ?? 'both').trim().toLowerCase()
  if (lower === 'english' || lower === 'hindi' || lower === 'both') return lower
  return 'both'
}

export const generateStudentRecommendations = async (req: Request, res: Response): Promise<void> => {
  const resumeId = String(req.body.resumeId ?? '').trim()
  if (!resumeId) throw new ApiError(400, 'resumeId is required')

  const data = await recommendationService.generate({
    userId: String(req.user?.userId ?? ''),
    resumeId,
    language: normalizeLanguage(req.body.language),
    targetRole: String(req.body.targetRole ?? ''),
    preferredLocation: String(req.body.preferredLocation ?? ''),
    jobDescriptionText: String(req.body.jobDescriptionText ?? ''),
    jobDescriptionId: String(req.body.jobDescriptionId ?? ''),
    selectedDomain: isDomainKey(req.body.selectedDomain) ? req.body.selectedDomain : '',
  })

  const saveHistory = Boolean(req.body.saveHistory ?? true)
  if (data.resumeId) {
    await RecommendationSnapshot.create({
      userId: req.user?.userId,
      resumeId: data.resumeId,
      jobDescriptionId: data.jobDescriptionId || null,
      language: normalizeLanguage(req.body.language),
      payload: data,
    })
  }

  if (saveHistory) {
    const report = await Report.create({
      userId: req.user?.userId,
      reportType: 'Smart Recommendation',
      relatedId: resumeId,
      title: 'Smart Weakness Analysis and Job Recommendation',
      summary: `Generated recommendations for ${data.targetRole}.`,
      payload: data,
    })
    void reminderService.sendReportReadyNotification({
      userId: String(req.user?.userId ?? ''),
      reportType: 'Role Recommendation Report',
      title: String(report.title ?? 'Smart Recommendation'),
      summary: String(report.summary ?? `Generated recommendations for ${data.targetRole}.`),
      actionPath: '/student/reports',
      contextKey: `report:${String(report._id)}`,
    }).catch((error) => console.error('[reminders] failed to send recommendation email', error))
  }

  res.json({ success: true, data })
}

export const getLatestRecommendationsForResume = async (req: Request, res: Response): Promise<void> => {
  const resumeId = String(req.query.resumeId ?? '').trim()
  const jobDescriptionId = String(req.query.jobDescriptionId ?? '').trim()
  const language = normalizeLanguage(req.query.language)
  if (!resumeId) throw new ApiError(400, 'resumeId is required')
  const latestSnapshot = await RecommendationSnapshot.findOne({
    userId: req.user?.userId,
    resumeId,
    ...(jobDescriptionId ? { jobDescriptionId } : {}),
    language,
  }).sort({ createdAt: -1 }).lean()
  if (latestSnapshot?.payload) {
    res.json({ success: true, data: latestSnapshot.payload })
    return
  }
  const latestLegacy = await Report.findOne({
    userId: req.user?.userId,
    reportType: 'Smart Recommendation',
    relatedId: resumeId,
  }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: latestLegacy?.payload ?? null })
}

export const saveJobDescription = async (req: Request, res: Response): Promise<void> => {
  const resumeId = String(req.body.resumeId ?? '').trim()
  const jobDescriptionText = String(req.body.jobDescriptionText ?? '').trim()
  if (!resumeId) throw new ApiError(400, 'resumeId is required')
  if (!jobDescriptionText) throw new ApiError(400, 'jobDescriptionText is required')

  const saved = await SavedJobDescription.create({
    userId: req.user?.userId,
    resumeId,
    jobDescriptionText,
    targetRole: String(req.body.targetRole ?? ''),
    preferredLocation: String(req.body.preferredLocation ?? ''),
  })
  res.status(201).json({ success: true, data: saved })
}

export const getLatestJobDescription = async (req: Request, res: Response): Promise<void> => {
  const resumeId = String(req.query.resumeId ?? '').trim()
  if (!resumeId) throw new ApiError(400, 'resumeId is required')

  const saved = await SavedJobDescription.findOne({ userId: req.user?.userId, resumeId }).sort({ createdAt: -1 }).lean()
  res.json({ success: true, data: saved })
}
