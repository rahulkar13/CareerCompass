import { Router } from 'express'
import { createReport, dashboardAnalytics, listReports, runReminderSweep } from '../controllers/reports.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get('/', requireAuth, asyncHandler(listReports))
router.post('/', requireAuth, asyncHandler(createReport))
router.get('/analytics', requireAuth, allowRoles('admin', 'recruiter'), asyncHandler(dashboardAnalytics))
router.post('/reminders/run', requireAuth, allowRoles('admin'), asyncHandler(runReminderSweep))

export default router
