import { Router } from 'express'
import authRoutes from './auth.routes'
import adminRoutes from './admin.routes'
import contactRoutes from './contact.routes'
import interviewsRoutes from './interviews.routes'
import jobsRoutes from './jobs.routes'
import matchingRoutes from './matching.routes'
import recruitersRoutes from './recruiters.routes'
import recommendationsRoutes from './recommendations.routes'
import reportsRoutes from './reports.routes'
import resumeAnalysisRoutes from './resumeAnalysis.routes'
import resumesRoutes from './resumes.routes'
import skillsRoutes from './skills.routes'
import studentsRoutes from './students.routes'
import testRoutes from './test.routes'
import usersRoutes from './users.routes'

const router = Router()

router.use('/test', testRoutes)
router.use('/contact', contactRoutes)
router.use('/auth', authRoutes)
router.use('/admin', adminRoutes)
router.use('/users', usersRoutes)
router.use('/students', studentsRoutes)
router.use('/recruiters', recruitersRoutes)
router.use('/students/recommendations', recommendationsRoutes)
router.use('/resumes', resumesRoutes)
router.use('/jobs', jobsRoutes)
router.use('/resume-analysis', resumeAnalysisRoutes)
router.use('/matching', matchingRoutes)
router.use('/skills', skillsRoutes)
router.use('/interviews', interviewsRoutes)
router.use('/reports', reportsRoutes)
router.use('/admin-dashboard', reportsRoutes)

export default router
