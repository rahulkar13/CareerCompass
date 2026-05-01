import bcrypt from 'bcryptjs'
import { connectDb } from '../config/db'
import { JobDescription, Report } from '../models/CoreModels'
import { RecruiterProfile } from '../models/RecruiterProfile'
import { StudentProfile } from '../models/StudentProfile'
import { User } from '../models/User'

const run = async (): Promise<void> => {
  await connectDb()
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    JobDescription.deleteMany({}),
    Report.deleteMany({}),
  ])

  const password = await bcrypt.hash('Password@123', 10)
  const [student, recruiter, admin] = await User.create([
    { name: 'Aman Verma', email: 'student@example.com', password, role: 'student' },
    { name: 'Priya HR', email: 'recruiter@example.com', password, role: 'recruiter' },
    { name: 'Placement Admin', email: 'admin@example.com', password, role: 'admin' },
  ])

  await StudentProfile.create({ userId: student._id, education: 'MCA', skills: ['React', 'Node.js'], experience: 'Internship' })
  await RecruiterProfile.create({ userId: recruiter._id, company: 'TechNova', designation: 'HR Manager', hiringFor: ['Frontend Developer'] })
  await JobDescription.create({
    userId: recruiter._id,
    title: 'Frontend Developer',
    company: 'TechNova',
    descriptionText: 'Build dashboard apps with React and TypeScript',
    extractedSkills: ['React', 'TypeScript', 'REST APIs'],
  })
  await Report.create({ userId: admin._id, reportType: 'Analytics', title: 'Monthly Placement Readiness', payload: { score: 78 } })

  console.log('Seed completed with demo users')
  process.exit(0)
}

run().catch((error) => {
  console.error('Seed failed', error)
  process.exit(1)
})
