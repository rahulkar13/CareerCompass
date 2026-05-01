import type { Request, Response } from 'express'
import { unlink } from 'node:fs/promises'
import { MatchReport, Profile, Report, Resume, ResumeAnalysisReport, SavedJobDescription, SkillGapReport } from '../models/CoreModels'
import { detectLikelyDomains } from '../services/domainService'
import { ApiError } from '../utils/ApiError'
import { aiService } from '../services/aiService'
import { classifyDocumentContent, extractResumeContent } from '../services/resumeParser'
import { reminderService } from '../services/reminderService'

const invalidResumeMessage = 'This file could not be analyzed as a resume.'
const assertResumeDocument = (
  text: string,
  structuredData: Parameters<typeof classifyDocumentContent>[1],
  options?: { allowUnknownAsResume?: boolean },
) => {
  const classification = classifyDocumentContent(text, structuredData)
  if (!classification.isResume && !options?.allowUnknownAsResume) {
    throw new ApiError(400, `${invalidResumeMessage} Detected document type: ${classification.type}.`)
  }
  if (!classification.isResume && options?.allowUnknownAsResume && classification.type === 'other') {
    return {
      ...classification,
      type: 'resume' as const,
      isResume: true,
      reasons: [...classification.reasons, 'accepted with lenient PDF fallback'],
    }
  }
  return classification
}

export const uploadResume = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) throw new ApiError(400, 'Resume file is required')
  try {
    const { text: rawText, html: htmlContent, structuredData } = await extractResumeContent(req.file.path)
    const documentClassification = assertResumeDocument(rawText, structuredData, {
      allowUnknownAsResume: req.file.mimetype === 'application/pdf',
    })
    const profile = req.user?.userId ? await Profile.findOne({ userId: req.user.userId }).lean() : null
    const aiAnalysis = await aiService.analyzeResumeHtml(htmlContent, rawText, structuredData, {
      targetRole: profile?.preferredJobRole ?? '',
      profileSkills: [...(profile?.skills ?? []), ...(profile?.technicalSkills ?? []), ...(profile?.softSkills ?? [])],
      profileProjects: profile?.projects ?? [],
      preferredIndustry: profile?.preferredIndustry ?? '',
    })
    const resumeDoc = await Resume.create({
      userId: req.user?.userId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      filePath: req.file.originalname,
      rawText,
      extractedText: rawText,
      htmlContent,
      extractedPersonalDetails: aiAnalysis.personalDetails ?? structuredData.personalDetails,
      extractedSkills: aiAnalysis.extractedSkills ?? structuredData.skills,
      extractedEducation: aiAnalysis.extractedEducation ?? structuredData.education,
      extractedProjects: aiAnalysis.extractedProjects ?? structuredData.projects,
      extractedExperience: aiAnalysis.extractedExperience ?? structuredData.experience,
      extractedCertifications: aiAnalysis.extractedCertifications ?? structuredData.certifications,
      aiAnalysisResult: { ...aiAnalysis, documentClassification },
    })
    if (profile?._id) {
      const detectedDomains = detectLikelyDomains({
        profile: profile as unknown as Record<string, unknown>,
        resume: {
          extractedText: rawText,
          extractedSkills: aiAnalysis.extractedSkills ?? structuredData.skills,
          extractedProjects: aiAnalysis.extractedProjects ?? structuredData.projects,
          extractedExperience: aiAnalysis.extractedExperience ?? structuredData.experience,
          extractedEducation: aiAnalysis.extractedEducation ?? structuredData.education,
          extractedCertifications: aiAnalysis.extractedCertifications ?? structuredData.certifications,
        },
        preferredRole: String(profile.preferredJobRole ?? ''),
      })
      await Profile.updateOne(
        { _id: profile._id },
        { $set: { detectedDomains, domainDetectionUpdatedAt: new Date() } },
      )
    }
    const analysisReport = await ResumeAnalysisReport.create({
      userId: req.user?.userId,
      resumeId: resumeDoc._id,
      atsScore: Number(aiAnalysis.score ?? 0),
      strengths: (aiAnalysis.strengths ?? []) as string[],
      weaknesses: (aiAnalysis.weaknesses ?? []) as string[],
      suggestions: (aiAnalysis.suggestions ?? []) as string[],
      content: { ...aiAnalysis, documentClassification, resumeId: String(resumeDoc._id) },
    })
    void reminderService.sendReportReadyNotification({
      userId: String(req.user?.userId ?? ''),
      reportType: 'Resume Analysis Report',
      title: 'Resume analysis is ready',
      summary: `Your latest resume analysis is ready with an ATS score of ${Number(aiAnalysis.score ?? 0)}.`,
      actionPath: '/student/upload-resume',
      contextKey: `resume-analysis:${String(analysisReport._id)}`,
    }).catch((error) => console.error('[reminders] failed to send resume analysis email', error))

    res.status(201).json({
      success: true,
      data: {
        resume: {
          _id: String(resumeDoc._id),
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          uploadedAt: new Date().toISOString(),
          extractedText: rawText,
          htmlContent,
          extractedPersonalDetails: aiAnalysis.personalDetails,
          extractedSkills: aiAnalysis.extractedSkills,
          extractedEducation: aiAnalysis.extractedEducation,
          extractedProjects: aiAnalysis.extractedProjects,
          extractedExperience: aiAnalysis.extractedExperience,
          extractedCertifications: aiAnalysis.extractedCertifications,
        },
        analysis: { ...aiAnalysis, documentClassification, resumeId: String(resumeDoc._id) },
      },
    })
  } finally {
    await unlink(req.file.path).catch(() => undefined)
  }
}

export const listResumes = async (req: Request, res: Response): Promise<void> => {
  const resumes = await Resume.find({ userId: req.user?.userId }).sort({ createdAt: -1 })
  res.json({ success: true, data: resumes })
}

export const analyzeResume = async (req: Request, res: Response): Promise<void> => {
  const profile = req.user?.userId ? await Profile.findOne({ userId: req.user.userId }).lean() : null
  const resume = req.params.resumeId ? await Resume.findById(req.params.resumeId) : null
  const resumeText = String(req.body.resumeText ?? resume?.extractedText ?? '').trim()
  if (!resumeText) throw new ApiError(400, 'Resume content is required for analysis')
  const structuredData = {
    personalDetails: ((req.body.structuredData?.personalDetails ?? resume?.extractedPersonalDetails ?? {}) as Record<string, string>),
    skills: (req.body.structuredData?.skills ?? resume?.extractedSkills ?? []) as string[],
    education: (req.body.structuredData?.education ?? resume?.extractedEducation ?? []) as string[],
    projects: (req.body.structuredData?.projects ?? resume?.extractedProjects ?? []) as string[],
    experience: (req.body.structuredData?.experience ?? resume?.extractedExperience ?? []) as string[],
    certifications: (req.body.structuredData?.certifications ?? resume?.extractedCertifications ?? []) as string[],
  }
  const documentClassification = assertResumeDocument(resumeText, structuredData)
  const analysis = await aiService.analyzeResume(resumeText, {
    htmlContent: String(req.body.htmlContent ?? resume?.htmlContent ?? ''),
    structuredData,
    context: {
      targetRole: profile?.preferredJobRole ?? '',
      profileSkills: [...(profile?.skills ?? []), ...(profile?.technicalSkills ?? []), ...(profile?.softSkills ?? [])],
      profileProjects: profile?.projects ?? [],
      preferredIndustry: profile?.preferredIndustry ?? '',
      jobText: String(req.body.jobText ?? ''),
    },
  })
  res.json({ success: true, data: { ...analysis, documentClassification, resumeId: String(resume?._id ?? '') } })
}

export const matchResume = async (req: Request, res: Response): Promise<void> => {
  const { resumeId, resumeText: bodyResumeText, jobText, jobId } = req.body
  const profile = req.user?.userId ? await Profile.findOne({ userId: req.user.userId }).lean() : null
  const resume = resumeId ? await Resume.findById(resumeId) : null
  const resumeText = String(bodyResumeText ?? resume?.extractedText ?? '').trim()
  if (!resumeText) throw new ApiError(400, 'Resume content is required for JD matching')
  assertResumeDocument(resumeText, {
    personalDetails: (resume?.extractedPersonalDetails ?? {}) as Record<string, string>,
    skills: resume?.extractedSkills ?? [],
    education: resume?.extractedEducation ?? [],
    projects: resume?.extractedProjects ?? [],
    experience: resume?.extractedExperience ?? [],
    certifications: resume?.extractedCertifications ?? [],
  })
  const match = await aiService.matchResumeToJob({ resumeText, jobText })
  if (resumeId && String(jobText ?? '').trim()) {
    await SavedJobDescription.create({
      userId: req.user?.userId,
      resumeId,
      jobDescriptionText: String(jobText),
      targetRole: profile?.preferredJobRole ?? '',
      preferredLocation: profile?.currentLocation ?? '',
    })
  }
  const report = resume
    ? await MatchReport.create({
        userId: req.user?.userId,
        resumeId: resume._id,
        jobDescriptionId: jobId,
        matchedSkills: match.keywordMatches ?? [],
        missingSkills: match.missingSkills ?? [],
        readinessScore: match.score,
        content: match,
      })
    : match
  if (resume && report && '_id' in report) {
    const matchReport = report as unknown as { _id?: unknown; readinessScore?: number }
    void reminderService.sendReportReadyNotification({
      userId: String(req.user?.userId ?? ''),
      reportType: 'Job Match Report',
      title: 'Job match report is ready',
      summary: `Your latest job match report scored ${Number(matchReport.readinessScore ?? match.score ?? 0)} for the selected role.`,
      actionPath: '/student/job-match',
      contextKey: `job-match:${String(matchReport._id ?? '')}`,
    }).catch((error) => console.error('[reminders] failed to send job match email', error))
  }
  res.json({ success: true, data: report })
}

export const skillGapAnalysis = async (req: Request, res: Response): Promise<void> => {
  const { resumeId, resumeText: bodyResumeText, jobId, jobText = '' } = req.body
  const profile = req.user?.userId ? await Profile.findOne({ userId: req.user.userId }).lean<Record<string, unknown>>() : null
  const resume = resumeId ? await Resume.findById(resumeId) : null
  const resumeText = String(bodyResumeText ?? resume?.extractedText ?? '').trim()
  if (!resumeText) throw new ApiError(400, 'Resume content is required for skill gap analysis')
  assertResumeDocument(resumeText, {
    personalDetails: (resume?.extractedPersonalDetails ?? {}) as Record<string, string>,
    skills: resume?.extractedSkills ?? [],
    education: resume?.extractedEducation ?? [],
    projects: resume?.extractedProjects ?? [],
    experience: resume?.extractedExperience ?? [],
    certifications: resume?.extractedCertifications ?? [],
  })
  const reportData = await aiService.generateSkillGap(resumeText, jobText, {
    targetRole: String(req.body.targetRole ?? profile?.preferredJobRole ?? ''),
    domain: String(req.body.selectedDomain ?? profile?.confirmedDomain ?? ''),
  })
  const report = resume
    ? await SkillGapReport.create({
        userId: req.user?.userId,
        resumeId,
        jobDescriptionId: jobId,
        matchedSkills: reportData.technicalSkills ?? [],
        missingSkills: (reportData.gaps ?? []).map((gap) => gap.skill),
        readinessScore: reportData.gaps.length ? Math.max(45, 90 - reportData.gaps.length * 8) : 92,
        content: reportData,
      })
    : reportData
  if (resume && report && '_id' in report) {
    const skillGapReport = report as unknown as { _id?: unknown }
    void reminderService.sendReportReadyNotification({
      userId: String(req.user?.userId ?? ''),
      reportType: 'Skill Gap Report',
      title: 'Skill gap report is ready',
      summary: `Your latest skill gap report highlights ${Math.max(((reportData.gaps ?? []) as unknown[]).length, 0)} priority areas to improve next.`,
      actionPath: '/student/skill-gap',
      contextKey: `skill-gap:${String(skillGapReport._id ?? '')}`,
    }).catch((error) => console.error('[reminders] failed to send skill gap email', error))
  }
  res.json({ success: true, data: report })
}
