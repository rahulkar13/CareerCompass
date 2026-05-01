import { Schema, model } from 'mongoose'

export interface IAdminSetting {
  key: string
  value: Record<string, unknown>
}

const adminSettingSchema = new Schema<IAdminSetting>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    value: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

export const AdminSetting = model<IAdminSetting>('AdminSetting', adminSettingSchema)
