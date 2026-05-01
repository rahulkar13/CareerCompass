import { Router } from 'express'
import { matchResume } from '../controllers/resume.controller'
import { requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()
router.post('/', requireAuth, asyncHandler(matchResume))
export default router
