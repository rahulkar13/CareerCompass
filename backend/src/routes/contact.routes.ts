import { Router } from 'express'
import { submitContactRequest } from '../controllers/contact.controller'
import { validateBody } from '../middlewares/validate'
import { asyncHandler } from '../utils/asyncHandler'
import { contactRequestSchema } from '../validators/schemas'

const router = Router()

router.post('/', validateBody(contactRequestSchema), asyncHandler(submitContactRequest))

export default router
