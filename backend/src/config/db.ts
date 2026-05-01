import mongoose from 'mongoose'
import { env } from './env'

export const connectDb = async (): Promise<void> => {
  await mongoose.connect(env.dbUrl)
  console.log('Database connected successfully')
}
