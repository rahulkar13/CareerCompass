import { Router } from 'express'
import {
  assignCodingRound,
  assignInterviewRound,
  createRecruiterCodingQuestion,
  createRecruiterInterviewQuestion,
  deleteRecruiterCodingQuestion,
  deleteRecruiterInterviewQuestion,
  listRecruiterApplications,
  listRecruiterCodingQuestions,
  listRecruiterInterviewQuestions,
  updateRecruiterApplicationDecision,
} from '../controllers/hiring.controller'
import { candidateRanking, createJob, deleteJob, listJobs, listShortlisted, removeShortlistedCandidate, shortlistCandidate, updateJob } from '../controllers/recruiter.controller'
import { getRecruiterProfile, upsertRecruiterProfile } from '../controllers/profiles.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { validateBody } from '../middlewares/validate'
import { asyncHandler } from '../utils/asyncHandler'
import {
  jobSchema,
  recruiterApplicationDecisionSchema,
  recruiterAssignmentSchema,
  recruiterCodingQuestionSchema,
  recruiterInterviewQuestionSchema,
  recruiterProfileSchema,
} from '../validators/schemas'

const router = Router()

router.get('/profile', requireAuth, allowRoles('recruiter', 'admin'), asyncHandler(getRecruiterProfile))
router.put('/profile', requireAuth, allowRoles('recruiter'), validateBody(recruiterProfileSchema), asyncHandler(upsertRecruiterProfile))
router.post('/jobs', requireAuth, allowRoles('recruiter', 'admin'), validateBody(jobSchema), asyncHandler(createJob))
router.get('/jobs', requireAuth, allowRoles('recruiter', 'admin', 'student'), asyncHandler(listJobs))
router.put('/jobs/:jobId', requireAuth, allowRoles('recruiter'), validateBody(jobSchema.partial()), asyncHandler(updateJob))
router.delete('/jobs/:jobId', requireAuth, allowRoles('recruiter'), asyncHandler(deleteJob))
router.get('/applications', requireAuth, allowRoles('recruiter'), asyncHandler(listRecruiterApplications))
router.patch('/applications/:applicationId', requireAuth, allowRoles('recruiter'), validateBody(recruiterApplicationDecisionSchema), asyncHandler(updateRecruiterApplicationDecision))
router.post('/applications/:applicationId/assign-interview', requireAuth, allowRoles('recruiter'), validateBody(recruiterAssignmentSchema), asyncHandler(assignInterviewRound))
router.post('/applications/:applicationId/assign-coding', requireAuth, allowRoles('recruiter'), validateBody(recruiterAssignmentSchema), asyncHandler(assignCodingRound))
router.get('/interview-questions', requireAuth, allowRoles('recruiter'), asyncHandler(listRecruiterInterviewQuestions))
router.post('/interview-questions', requireAuth, allowRoles('recruiter'), validateBody(recruiterInterviewQuestionSchema), asyncHandler(createRecruiterInterviewQuestion))
router.delete('/interview-questions/:questionId', requireAuth, allowRoles('recruiter'), asyncHandler(deleteRecruiterInterviewQuestion))
router.get('/coding-questions', requireAuth, allowRoles('recruiter'), asyncHandler(listRecruiterCodingQuestions))
router.post('/coding-questions', requireAuth, allowRoles('recruiter'), validateBody(recruiterCodingQuestionSchema), asyncHandler(createRecruiterCodingQuestion))
router.delete('/coding-questions/:questionId', requireAuth, allowRoles('recruiter'), asyncHandler(deleteRecruiterCodingQuestion))
router.get('/candidate-ranking', requireAuth, allowRoles('recruiter', 'admin'), asyncHandler(candidateRanking))
router.post('/shortlisted', requireAuth, allowRoles('recruiter', 'admin'), asyncHandler(shortlistCandidate))
router.get('/shortlisted', requireAuth, allowRoles('recruiter', 'admin'), asyncHandler(listShortlisted))
router.delete('/shortlisted/:shortlistedId', requireAuth, allowRoles('recruiter', 'admin'), asyncHandler(removeShortlistedCandidate))

export default router
