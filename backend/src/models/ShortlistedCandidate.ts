import { Schema, model, type Types } from 'mongoose'

export interface IShortlistedCandidate {
  recruiterId: Types.ObjectId
  candidateId: Types.ObjectId
  jobId: Types.ObjectId
  status: string
  notes: string
}

const shortlistedCandidateSchema = new Schema<IShortlistedCandidate>(
  {
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    candidateId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', required: true, index: true },
    status: { type: String, default: 'Shortlisted', trim: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
)

export const ShortlistedCandidate = model<IShortlistedCandidate>('ShortlistedCandidate', shortlistedCandidateSchema)
