import { Router } from 'express'
import { skillGapAnalysis } from '../controllers/resume.controller'
import { requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
router.post('/gap-analysis', requireAuth, asyncHandler(skillGapAnalysis))
export default router
