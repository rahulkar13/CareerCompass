import { Router } from 'express'
import { analyzeResume, listResumes, matchResume, skillGapAnalysis, uploadResume } from '../controllers/resume.controller'
import { requireAuth } from '../middlewares/auth'
import { upload } from '../middlewares/upload'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/upload', requireAuth, upload.single('resume'), asyncHandler(uploadResume))
router.get('/', requireAuth, asyncHandler(listResumes))
router.post('/analysis/transient', requireAuth, asyncHandler(analyzeResume))
router.post('/analysis/:resumeId', requireAuth, asyncHandler(analyzeResume))
router.post('/matching', requireAuth, asyncHandler(matchResume))
router.post('/skills-gap', requireAuth, asyncHandler(skillGapAnalysis))

export default router
