import jwt from 'jsonwebtoken'
import type { NextFunction, Request, Response } from 'express'
import { env } from '../config/env'
import { User } from '../models/User'
import { ApiError } from '../utils/ApiError'
import type { UserRole } from '../models/User'

interface JwtPayload {
  userId: string
  role: UserRole
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authorization token missing')
  }
  void (async () => {
    const token = authHeader.split(' ')[1]
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload
    const user = await User.findById(payload.userId).select('role accountStatus')
    if (!user) {
      throw new ApiError(401, 'Invalid or expired authorization token')
    }
    if (user.accountStatus && user.accountStatus !== 'active') {
      throw new ApiError(403, `This account is currently ${user.accountStatus}. Please contact the administrator.`)
    }
    req.user = { userId: payload.userId, role: user.role }
    void User.updateOne({ _id: payload.userId }, { $set: { lastActiveAt: new Date() } }).catch(() => undefined)
    next()
  })().catch((error) => {
    if (error instanceof ApiError) {
      next(error)
      return
    }
    next(new ApiError(401, 'Invalid or expired authorization token'))
  })
}

export const allowRoles = (...roles: UserRole[]) => (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || !roles.includes(req.user.role)) {
    throw new ApiError(403, 'Forbidden: role access denied')
  }
  next()
}
