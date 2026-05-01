import { Schema, model, type Types } from 'mongoose'

export interface IAdminActivityLog {
  adminUserId?: Types.ObjectId | null
  actionType: string
  entityType: string
  entityId?: string
  title: string
  description: string
  metadata?: Record<string, unknown>
  createdAt?: Date
  updatedAt?: Date
}

const adminActivityLogSchema = new Schema<IAdminActivityLog>(
  {
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actionType: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, default: '' },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const AdminActivityLog = model<IAdminActivityLog>('AdminActivityLog', adminActivityLogSchema)
