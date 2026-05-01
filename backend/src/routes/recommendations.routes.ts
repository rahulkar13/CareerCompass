import { Router } from 'express'
import {
  generateStudentRecommendations,
  getLatestJobDescription,
  getLatestRecommendationsForResume,
  saveJobDescription,
} from '../controllers/recommendation.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/', requireAuth, allowRoles('student', 'admin'), asyncHandler(generateStudentRecommendations))
router.post('/job-description', requireAuth, allowRoles('student', 'admin'), asyncHandler(saveJobDescription))
router.get('/job-description/latest', requireAuth, allowRoles('student', 'admin'), asyncHandler(getLatestJobDescription))
router.get('/latest', requireAuth, allowRoles('student', 'admin'), asyncHandler(getLatestRecommendationsForResume))

export default router
