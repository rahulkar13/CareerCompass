import { connectDb } from './config/db'
import { env } from './config/env'
import { app } from './app'
import { startReminderScheduler } from './services/reminderService'

const start = async (): Promise<void> => {
  await connectDb()
  startReminderScheduler()
  app.listen(env.port, () => {
    console.log(`API server listening on port ${env.port}`)
  })
}

start().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
