import { Router } from 'express'
import { getStudentProfile, upsertStudentProfile } from '../controllers/profiles.controller'
import { applyToJob, getCodingAssignmentForStudent, getInterviewAssignmentForStudent, listStudentApplications } from '../controllers/hiring.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { validateBody } from '../middlewares/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { jobApplicationSchema, studentProfileSchema } from '../validators/schemas'

const router = Router()

router.get('/profile', requireAuth, allowRoles('student', 'admin'), asyncHandler(getStudentProfile))
router.put('/profile', requireAuth, allowRoles('student'), validateBody(studentProfileSchema), asyncHandler(upsertStudentProfile))
router.get('/applications', requireAuth, allowRoles('student'), asyncHandler(listStudentApplications))
router.post('/applications', requireAuth, allowRoles('student'), validateBody(jobApplicationSchema), asyncHandler(applyToJob))
router.get('/applications/interview-assignment/:assignmentId', requireAuth, allowRoles('student'), asyncHandler(getInterviewAssignmentForStudent))
router.get('/applications/coding-assignment/:assignmentId', requireAuth, allowRoles('student'), asyncHandler(getCodingAssignmentForStudent))

export default router
