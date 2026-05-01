import type { Request, Response } from 'express'

export const testController = (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'Backend is running correctly',
    timestamp: new Date().toISOString(),
  })
}
