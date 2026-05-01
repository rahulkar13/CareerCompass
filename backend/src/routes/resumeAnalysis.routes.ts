import { Router } from 'express'
import { analyzeResume } from '../controllers/resume.controller'
import { requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
router.post('/:resumeId', requireAuth, asyncHandler(analyzeResume))
export default router
