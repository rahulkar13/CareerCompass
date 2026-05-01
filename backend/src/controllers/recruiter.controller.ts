import type { Request, Response } from 'express'
import { JobDescription, MatchReport, ShortlistedCandidate } from '../models/CoreModels'
import { Profile } from '../models/Profile'
import { Resume } from '../models/Resume'
import { User } from '../models/User'
import { ApiError } from '../utils/ApiError'

export const createJob = async (req: Request, res: Response): Promise<void> => {
  const job = await JobDescription.create({
    userId: req.user?.userId,
    ...req.body,
  })
  res.status(201).json({ success: true, data: job })
}

export const listJobs = async (req: Request, res: Response): Promise<void> => {
  const query = req.user?.role === 'recruiter'
    ? { userId: req.user.userId }
    : req.user?.role === 'student'
      ? { status: 'active' }
      : {}
  const jobs = await JobDescription.find(query)
  res.json({ success: true, data: jobs })
}

export const updateJob = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = req.user?.userId
  const jobId = String(req.params.jobId ?? '')
  const job = await JobDescription.findOneAndUpdate(
    { _id: jobId, userId: recruiterId },
    { $set: req.body },
    { new: true },
  )
  if (!job) throw new ApiError(404, 'Job not found.')
  res.json({ success: true, data: job })
}

export const deleteJob = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = req.user?.userId
  const jobId = String(req.params.jobId ?? '')
  const deleted = await JobDescription.findOneAndDelete({ _id: jobId, userId: recruiterId })
  if (!deleted) throw new ApiError(404, 'Job not found.')
  await ShortlistedCandidate.deleteMany({ recruiterId, jobId })
  res.json({ success: true, data: deleted })
}

export const candidateRanking = async (req: Request, res: Response): Promise<void> => {
  const recruiterId = String(req.user?.userId ?? '')
  const jobs = await JobDescription.find({ userId: recruiterId }).lean<Array<Record<string, unknown>>>()
  const recruiterJobIds = jobs.map((job) => String(job._id ?? ''))
  const reportQuery = req.user?.role === 'recruiter' && recruiterJobIds.length
    ? { jobDescriptionId: { $in: recruiterJobIds } }
    : {}
  const reports = await MatchReport.find(reportQuery).sort({ score: -1, createdAt: -1 }).limit(50).lean<Array<Record<string, unknown>>>()
  const candidateIds = [...new Set(reports.map((report) => String(report.userId ?? '')).filter(Boolean))]
  const resumeIds = [...new Set(reports.map((report) => String(report.resumeId ?? '')).filter(Boolean))]
  const [users, profiles, resumes, shortlisted] = await Promise.all([
    User.find({ _id: { $in: candidateIds } }).lean<Array<Record<string, unknown>>>(),
    Profile.find({ userId: { $in: candidateIds } }).lean<Array<Record<string, unknown>>>(),
    Resume.find({ _id: { $in: resumeIds } }).lean<Array<Record<string, unknown>>>(),
    ShortlistedCandidate.find({ recruiterId }).lean<Array<Record<string, unknown>>>(),
  ])

  const userMap = new Map(users.map((user) => [String(user._id ?? ''), user]))
  const profileMap = new Map(profiles.map((profile) => [String(profile.userId ?? ''), profile]))
  const resumeMap = new Map(resumes.map((resume) => [String(resume._id ?? ''), resume]))
  const jobMap = new Map(jobs.map((job) => [String(job._id ?? ''), job]))
  const shortlistedMap = new Map(shortlisted.map((row) => [`${String(row.candidateId ?? '')}:${String(row.jobId ?? '')}`, row]))

  const data = reports.map((report) => {
    const candidateId = String(report.userId ?? '')
    const jobId = String(report.jobDescriptionId ?? '')
    const user = userMap.get(candidateId)
    const profile = profileMap.get(candidateId)
    const resume = resumeMap.get(String(report.resumeId ?? ''))
    const relatedJob = jobMap.get(jobId)
    const savedRecord = shortlistedMap.get(`${candidateId}:${jobId}`)
    const candidateName = String(user?.name ?? 'Candidate')
    const reportContent = (report.content ?? {}) as Record<string, unknown>
    const candidateField = String(
      profile?.confirmedDomain
      ?? profile?.preferredIndustry
      ?? profile?.branch
      ?? '',
    )
    const skills = Array.isArray(profile?.technicalSkills) && profile?.technicalSkills.length
      ? profile?.technicalSkills
      : Array.isArray(profile?.skills)
        ? profile?.skills
        : Array.isArray(resume?.extractedSkills)
          ? resume?.extractedSkills
          : []

    return {
      ...report,
      candidate: {
        id: candidateId,
        name: candidateName,
        field: candidateField,
        targetRole: String(profile?.preferredJobRole ?? ''),
        readinessScore: Number(report.readinessScore ?? report.score ?? 0),
        matchedSkills: Array.isArray(report.matchedSkills) ? report.matchedSkills : Array.isArray(reportContent.matchedSkills) ? reportContent.matchedSkills : [],
        missingSkills: Array.isArray(report.missingSkills) ? report.missingSkills : Array.isArray(reportContent.missingSkills) ? reportContent.missingSkills : [],
        skills,
        education: [
          String(profile?.degree ?? '').trim(),
          String(profile?.branch ?? '').trim(),
          String(profile?.collegeName ?? '').trim(),
        ].filter(Boolean).join(' | '),
        summary: String(profile?.summary ?? ''),
        projects: Array.isArray(profile?.projects) && profile.projects.length
          ? profile.projects
          : Array.isArray(resume?.extractedProjects)
            ? resume.extractedProjects
            : [],
        resumeAvailable: Boolean(resume),
        resumeSummary: Array.isArray(resume?.extractedExperience) ? resume.extractedExperience.slice(0, 3).join(' | ') : '',
      },
      job: relatedJob
        ? {
            id: String(relatedJob._id ?? ''),
            title: String(relatedJob.title ?? ''),
            company: String(relatedJob.company ?? ''),
          }
        : null,
      shortlist: savedRecord
        ? {
            id: String(savedRecord._id ?? ''),
            status: String(savedRecord.status ?? 'Shortlisted'),
            notes: String(savedRecord.notes ?? ''),
          }
        : null,
    }
  })

  res.json({ success: true, data })
}

export const shortlistCandidate = async (req: Request, res: Response): Promise<void> => {
  const { candidateId, jobId, notes } = req.body
  if (!jobId) throw new ApiError(400, 'A job selection is required before saving a candidate.')
  const shortlisted = await ShortlistedCandidate.findOneAndUpdate(
    { recruiterId: req.user?.userId, candidateId, jobId },
    {
      $set: {
        recruiterId: req.user?.userId,
        candidateId,
        jobId,
        notes: notes ?? '',
        status: 'Shortlisted',
      },
    },
    { new: true, upsert: true },
  )
  res.status(201).json({ success: true, data: shortlisted })
}

export const removeShortlistedCandidate = async (req: Request, res: Response): Promise<void> => {
  const shortlistedId = String(req.params.shortlistedId ?? '')
  const deleted = await ShortlistedCandidate.findOneAndDelete({
    recruiterId: req.user?.userId,
    _id: shortlistedId,
  })
  if (!deleted) throw new ApiError(404, 'Saved candidate not found.')
  res.json({ success: true, data: deleted })
}

export const listShortlisted = async (req: Request, res: Response): Promise<void> => {
  const rows = await ShortlistedCandidate.find({ recruiterId: req.user?.userId })
  res.json({ success: true, data: rows })
}
