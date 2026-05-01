import fs from 'node:fs'
import path from 'node:path'
import multer from 'multer'
import { ApiError } from '../utils/ApiError'

const uploadDir = path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
})

const allowedExtensions = new Set(['.pdf', '.docx', '.txt', '.rtf'])
const allowedMimeTypes = new Set([
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'text/x-pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'application/rtf',
  'text/rtf',
  'application/octet-stream',
  '',
])

export const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    const isAllowedExtension = allowedExtensions.has(extension)
    const isAllowedMime = allowedMimeTypes.has((file.mimetype || '').toLowerCase())
    const isAllowed = isAllowedExtension && isAllowedMime
    if (!isAllowed) {
      callback(new ApiError(400, 'Supported file types: PDF, DOCX, TXT, RTF (up to 12 MB).'))
      return
    }
    callback(null, true)
  },
})
