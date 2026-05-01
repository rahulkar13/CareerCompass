import { Router } from 'express'
import { createJob, listJobs } from '../controllers/recruiter.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { validateBody } from '../middlewares/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { jobSchema } from '../validators/schemas'

const router = Router()

router.post('/', requireAuth, allowRoles('recruiter', 'admin'), validateBody(jobSchema), asyncHandler(createJob))
router.get('/', requireAuth, allowRoles('student', 'recruiter', 'admin'), asyncHandler(listJobs))

export default router
