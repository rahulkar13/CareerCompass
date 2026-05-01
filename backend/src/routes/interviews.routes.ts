import { Router } from 'express'
import {
  getCodingTestAvailability,
  getCodingTestSession,
  runCodingTestCode,
  startCodingTestSession,
  submitCodingTestCode,
} from '../controllers/coding.controller'
import {
  completeMockInterviewSession,
  generateQuestions,
  getMockInterviewSession,
  listMockInterviewSessions,
  mockInterviewFeedback,
  startMockInterviewSession,
  submitMockInterviewAnswer,
} from '../controllers/interview.controller'
import { requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/questions/generate', requireAuth, asyncHandler(generateQuestions))
router.post('/mock/feedback', requireAuth, asyncHandler(mockInterviewFeedback))
router.get('/coding/availability', requireAuth, asyncHandler(getCodingTestAvailability))
router.post('/coding/session/start', requireAuth, asyncHandler(startCodingTestSession))
router.get('/coding/session/:sessionId', requireAuth, asyncHandler(getCodingTestSession))
router.post('/coding/session/:sessionId/run', requireAuth, asyncHandler(runCodingTestCode))
router.post('/coding/session/:sessionId/submit', requireAuth, asyncHandler(submitCodingTestCode))
router.get('/mock/sessions', requireAuth, asyncHandler(listMockInterviewSessions))
router.get('/mock/session/:sessionId', requireAuth, asyncHandler(getMockInterviewSession))
router.post('/mock/session/start', requireAuth, asyncHandler(startMockInterviewSession))
router.post('/mock/session/:sessionId/answer', requireAuth, asyncHandler(submitMockInterviewAnswer))
router.post('/mock/session/:sessionId/complete', requireAuth, asyncHandler(completeMockInterviewSession))

export default router
