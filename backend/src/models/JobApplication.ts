import { Schema, model, type Types } from 'mongoose'

export type JobApplicationStatus =
  | 'applied'
  | 'under_review'
  | 'interview_assigned'
  | 'coding_round_assigned'
  | 'completed'
  | 'shortlisted'
  | 'rejected'
  | 'hired'
  | 'next_round'

export interface IJobApplication {
  studentId: Types.ObjectId
  recruiterId: Types.ObjectId
  jobId: Types.ObjectId
  resumeId: Types.ObjectId
  appliedAt: Date
  status: JobApplicationStatus
  recruiterReviewStatus: string
  recruiterNotes: string
}

const jobApplicationSchema = new Schema<IJobApplication>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true, index: true },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['applied', 'under_review', 'interview_assigned', 'coding_round_assigned', 'completed', 'shortlisted', 'rejected', 'hired', 'next_round'],
      default: 'applied',
      index: true,
    },
    recruiterReviewStatus: { type: String, default: 'new', trim: true },
    recruiterNotes: { type: String, default: '' },
  },
  { timestamps: true },
)

jobApplicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true })

export const JobApplication = model<IJobApplication>('JobApplication', jobApplicationSchema)
