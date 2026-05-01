import { Schema, model, Types } from 'mongoose'

interface IRecruiterProfile {
  userId: Types.ObjectId
  phone: string
  company: string
  designation: string
  companyWebsite: string
  companyDescription: string
  companyLocation: string
  hiringDomains: string[]
  companySize: string
  companyLogo: string
  hiringFor: string[]
}

const schema = new Schema<IRecruiterProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    phone: { type: String, default: '' },
    company: { type: String, default: '' },
    designation: { type: String, default: '' },
    companyWebsite: { type: String, default: '' },
    companyDescription: { type: String, default: '' },
    companyLocation: { type: String, default: '' },
    hiringDomains: { type: [String], default: [] },
    companySize: { type: String, default: '' },
    companyLogo: { type: String, default: '' },
    hiringFor: { type: [String], default: [] },
  },
  { timestamps: true },
)

export const RecruiterProfile = model<IRecruiterProfile>('RecruiterProfile', schema)
