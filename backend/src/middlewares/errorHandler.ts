import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '../utils/ApiError'

export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, 'Route not found'))
}

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ success: false, message: error.message })
    return
  }
  res.status(500).json({ success: false, message: 'Internal server error', details: error.message })
}
