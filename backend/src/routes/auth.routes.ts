import { Router } from 'express'
import { forgotPassword, getAuthenticatedUser, login, register, resetPassword, verifyRegistrationOtp } from '../controllers/auth.controller'
import { requireAuth } from '../middlewares/auth'
import { validateBody } from '../middlewares/validate'
import { forgotPasswordSchema, loginSchema, requestRegistrationOtpSchema, resetPasswordSchema, verifyRegistrationOtpSchema } from '../validators/schemas'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.post('/register', validateBody(requestRegistrationOtpSchema), asyncHandler(register))
router.post('/register/verify-otp', validateBody(verifyRegistrationOtpSchema), asyncHandler(verifyRegistrationOtp))
router.post('/login', validateBody(loginSchema), asyncHandler(login))
router.post('/forgot-password', validateBody(forgotPasswordSchema), asyncHandler(forgotPassword))
router.post('/reset-password', validateBody(resetPasswordSchema), asyncHandler(resetPassword))
router.get('/me', requireAuth, asyncHandler(getAuthenticatedUser))

export default router
