import { Schema, model } from 'mongoose'

export interface IPlatformRoleOption {
  label: string
  active: boolean
}

export interface IPlatformField {
  key: string
  label: string
  description: string
  active: boolean
  roles: IPlatformRoleOption[]
}

const platformRoleOptionSchema = new Schema<IPlatformRoleOption>(
  {
    label: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { _id: false },
)

const platformFieldSchema = new Schema<IPlatformField>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    label: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    active: { type: Boolean, default: true, index: true },
    roles: { type: [platformRoleOptionSchema], default: [] },
  },
  { timestamps: true },
)

export const PlatformField = model<IPlatformField>('PlatformField', platformFieldSchema)
