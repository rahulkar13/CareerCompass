import type { Request, Response } from 'express'
import { MatchReport, Report, Resume, ResumeAnalysisReport, SkillGapReport } from '../models/CoreModels'
import { User } from '../models/User'
import { reminderService } from '../services/reminderService'

export const listReports = async (req: Request, res: Response): Promise<void> => {
  const query = req.user?.role === 'admin' ? {} : { userId: req.user?.userId }
  const reports = await Report.find(query).sort({ createdAt: -1 })
  res.json({ success: true, data: reports })
}

export const createReport = async (req: Request, res: Response): Promise<void> => {
  const report = await Report.create({ userId: req.user?.userId, ...req.body })
  res.status(201).json({ success: true, data: report })
}

export const dashboardAnalytics = async (_req: Request, res: Response): Promise<void> => {
  const [users, resumes, analysis, matches, skills] = await Promise.all([
    User.countDocuments(),
    Resume.countDocuments(),
    ResumeAnalysisReport.countDocuments(),
    MatchReport.countDocuments(),
    SkillGapReport.countDocuments(),
  ])
  res.json({
    success: true,
    data: {
      totalUsers: users,
      totalResumes: resumes,
      totalResumeAnalyses: analysis,
      totalMatchReports: matches,
      totalSkillGapReports: skills,
      placementReadinessScore: 78,
    },
  })
}

export const runReminderSweep = async (_req: Request, res: Response): Promise<void> => {
  const result = await reminderService.runScheduledReminders()
  res.json({ success: true, data: result })
}
