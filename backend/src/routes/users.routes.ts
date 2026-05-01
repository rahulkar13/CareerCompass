import { Router } from 'express'
import { getCurrentUser, listUsers } from '../controllers/profiles.controller'
import { allowRoles, requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../utils/asyncHandler'

const router = Router()

router.get('/me', requireAuth, asyncHandler(getCurrentUser))
router.get('/', requireAuth, allowRoles('admin'), asyncHandler(listUsers))

export default router
