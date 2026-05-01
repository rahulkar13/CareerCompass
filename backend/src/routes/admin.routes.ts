import { Router } from 'express'
import {
  bulkImportInterviewBankQuestions,
  createAdminUser,
  createAdminNotification,
  createAdminJob,
  createCodingProblemAdmin,
  createInterviewBankQuestion,
  createPlatformField,
  deleteAdminContactMessage,
  deleteAdminJob,
  deleteAdminNotification,
  deleteAdminReport,
  deleteAdminResume,
  deleteAdminUser,
  deleteCodingProblemAdmin,
  deleteInterviewBankQuestion,
  getAdminOverview,
  getAdminRecruiterDetail,
  getAdminSettings,
  listAdminActivityLogs,
  listAdminCodingSessions,
  listAdminContactMessages,
  listAdminRecruiters,
  listAdminStudents,
  listAdminJobs,
  listAdminMockInterviews,
  listAdminNotifications,
  listAdminReports,
  listAdminResumes,
  listAdminUsers,
  getAdminStudentDetail,
  listCodingProblemsAdmin,
  listInterviewBank,
  listPlatformFields,
  listRecruiterApprovalRequests,
  updateAdminContactMessage,
  updateAdminJob,
  updateAdminSettings,
  updateAdminUser,
  updateCodingProblemAdmin,
  updateInterviewBankQuestion,
  updatePlatformField,
} from '../controllers/admin.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.use(requireAuth, allowRoles('admin'))

router.get('/overview', asyncHandler(getAdminOverview))
router.get('/students', asyncHandler(listAdminStudents))
router.get('/students/:studentId', asyncHandler(getAdminStudentDetail))
router.get('/recruiters', asyncHandler(listAdminRecruiters))
router.get('/recruiters/:recruiterId', asyncHandler(getAdminRecruiterDetail))
router.get('/users', asyncHandler(listAdminUsers))
router.post('/users', asyncHandler(createAdminUser))
router.get('/recruiter-requests', asyncHandler(listRecruiterApprovalRequests))
router.get('/activity-logs', asyncHandler(listAdminActivityLogs))
router.patch('/users/:userId', asyncHandler(updateAdminUser))
router.delete('/users/:userId', asyncHandler(deleteAdminUser))

router.get('/resumes', asyncHandler(listAdminResumes))
router.delete('/resumes/:resumeId', asyncHandler(deleteAdminResume))

router.get('/fields', asyncHandler(listPlatformFields))
router.post('/fields', asyncHandler(createPlatformField))
router.put('/fields/:fieldKey', asyncHandler(updatePlatformField))

router.get('/question-bank/interview', asyncHandler(listInterviewBank))
router.post('/question-bank/interview', asyncHandler(createInterviewBankQuestion))
router.put('/question-bank/interview/:questionId', asyncHandler(updateInterviewBankQuestion))
router.delete('/question-bank/interview/:questionId', asyncHandler(deleteInterviewBankQuestion))
router.post('/question-bank/interview/import', asyncHandler(bulkImportInterviewBankQuestions))

router.get('/question-bank/coding', asyncHandler(listCodingProblemsAdmin))
router.post('/question-bank/coding', asyncHandler(createCodingProblemAdmin))
router.put('/question-bank/coding/:problemId', asyncHandler(updateCodingProblemAdmin))
router.delete('/question-bank/coding/:problemId', asyncHandler(deleteCodingProblemAdmin))

router.get('/jobs', asyncHandler(listAdminJobs))
router.post('/jobs', asyncHandler(createAdminJob))
router.put('/jobs/:jobId', asyncHandler(updateAdminJob))
router.delete('/jobs/:jobId', asyncHandler(deleteAdminJob))

router.get('/reports', asyncHandler(listAdminReports))
router.delete('/reports/:reportId', asyncHandler(deleteAdminReport))

router.get('/mock-interviews', asyncHandler(listAdminMockInterviews))
router.get('/coding-tests', asyncHandler(listAdminCodingSessions))

router.get('/notifications', asyncHandler(listAdminNotifications))
router.post('/notifications', asyncHandler(createAdminNotification))
router.delete('/notifications/:notificationId', asyncHandler(deleteAdminNotification))

router.get('/contacts', asyncHandler(listAdminContactMessages))
router.patch('/contacts/:contactId', asyncHandler(updateAdminContactMessage))
router.delete('/contacts/:contactId', asyncHandler(deleteAdminContactMessage))

router.get('/settings', asyncHandler(getAdminSettings))
router.put('/settings', asyncHandler(updateAdminSettings))

export default router
