import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import apiRoutes from './routes'
import { errorHandler, notFound } from './middlewares/errorHandler'

export const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '5mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Backend running' })
})

app.use('/api', apiRoutes)
app.use(notFound)
app.use(errorHandler)
