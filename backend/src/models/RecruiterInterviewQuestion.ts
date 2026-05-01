import { Schema, model, type Types } from 'mongoose'

export interface IRecruiterInterviewQuestion {
  recruiterId: Types.ObjectId
  jobId?: Types.ObjectId | null
  role: string
  domain: string
  roundType: string
  difficulty: string
  topic: string
  questionText: string
  answerHint: string
  keyPoints: string[]
  tags: string[]
}

const recruiterInterviewQuestionSchema = new Schema<IRecruiterInterviewQuestion>(
  {
    recruiterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'JobDescription', default: null, index: true },
    role: { type: String, default: '', trim: true, index: true },
    domain: { type: String, default: '', trim: true, index: true },
    roundType: { type: String, default: 'mixed', trim: true, index: true },
    difficulty: { type: String, default: 'Intermediate', trim: true },
    topic: { type: String, default: '', trim: true, index: true },
    questionText: { type: String, required: true, trim: true },
    answerHint: { type: String, default: '', trim: true },
    keyPoints: { type: [String], default: [] },
    tags: { type: [String], default: [], index: true },
  },
  { timestamps: true },
)

export const RecruiterInterviewQuestion = model<IRecruiterInterviewQuestion>('RecruiterInterviewQuestion', recruiterInterviewQuestionSchema)
