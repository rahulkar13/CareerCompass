import fs from 'node:fs/promises'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { ApiError } from '../utils/ApiError'

type ResumeSectionKey = 'summary' | 'skills' | 'education' | 'projects' | 'experience' | 'certifications' | 'other'

interface ResumeStructuredData {
  personalDetails: Record<string, string>
  skills: string[]
  education: string[]
  projects: string[]
  experience: string[]
  certifications: string[]
}

interface ResumeContentResult {
  text: string
  html: string
  structuredData: ResumeStructuredData
}

type DocumentType = 'resume' | 'job_description' | 'payment_slip' | 'certificate' | 'other'

interface DocumentClassification {
  type: DocumentType
  isResume: boolean
  confidence: number
  reasons: string[]
}

const sectionHeadings: Array<{ key: ResumeSectionKey; pattern: RegExp; title: string }> = [
  { key: 'summary', pattern: /^(summary|objective|professional summary|career objective)$/i, title: 'Summary' },
  { key: 'skills', pattern: /^(skills|technical skills|core skills|competencies)$/i, title: 'Skills' },
  { key: 'education', pattern: /^(education|academic background|academics)$/i, title: 'Education' },
  { key: 'projects', pattern: /^(projects|academic projects|personal projects)$/i, title: 'Projects' },
  { key: 'experience', pattern: /^(experience|work experience|internship|internships|employment)$/i, title: 'Experience' },
  { key: 'certifications', pattern: /^(certifications|certificates|courses|training)$/i, title: 'Certifications' },
]

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const normalizeText = (value: string): string => value.replace(/\r/g, '').replace(/\t/g, ' ').replace(/[ ]{2,}/g, ' ').trim()
const stripRtf = (value: string): string =>
  value
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-fA-F]{2}/g, '')
    .replace(/\\[a-z]+-?\d* ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()

const normalizeLines = (value: string): string[] =>
  value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)

const dedupe = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))]
const decodePdfString = (value: string): string =>
  value
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (_m, oct) => String.fromCharCode(parseInt(oct, 8)))

const extractTextFromPdfBufferFallback = (buffer: Buffer): string => {
  const raw = buffer.toString('latin1')
  const chunks: string[] = []
  const parenthesized = /\(([^()]{1,400})\)/g
  let match: RegExpExecArray | null
  while ((match = parenthesized.exec(raw)) !== null) {
    const decoded = decodePdfString(match[1]).trim()
    if (decoded && /[A-Za-z0-9]/.test(decoded)) {
      chunks.push(decoded)
    }
  }

  const text = normalizeText(chunks.join('\n'))
  if (text.length >= 40) return text

  // Last-resort cleanup from raw content stream
  return normalizeText(
    raw
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
      .replace(/\/[A-Za-z0-9#]+/g, ' ')
      .replace(/[<>[\]{}]/g, ' ')
      .replace(/\s{2,}/g, ' '),
  )
}

const cleanHtml = (html: string): string =>
  html
    .replace(/\s(class|style|id|lang)="[^"]*"/gi, '')
    .replace(/<(span|font)[^>]*>/gi, '')
    .replace(/<\/(span|font)>/gi, '')
    .replace(/<div[^>]*>/gi, '<p>')
    .replace(/<\/div>/gi, '</p>')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/\n{2,}/g, '\n')
    .trim()

const findSectionKey = (line: string): ResumeSectionKey | null => {
  const match = sectionHeadings.find((section) => section.pattern.test(line.replace(/:$/, '')))
  return match?.key ?? null
}

const buildStructuredHtmlFromText = (text: string): string => {
  const lines = normalizeLines(text)
  const sections = new Map<ResumeSectionKey, string[]>()
  let currentSection: ResumeSectionKey = 'other'

  for (const line of lines) {
    const nextSection = findSectionKey(line)
    if (nextSection) {
      currentSection = nextSection
      if (!sections.has(currentSection)) sections.set(currentSection, [])
      continue
    }
    if (!sections.has(currentSection)) sections.set(currentSection, [])
    sections.get(currentSection)?.push(line)
  }

  const body = [...sections.entries()]
    .map(([sectionKey, values]) => {
      if (!values.length) return ''
      const title = sectionHeadings.find((section) => section.key === sectionKey)?.title ?? 'Details'
      const listItems = values.filter((line) => /^[-*•]/.test(line))
      const paragraphs = values.filter((line) => !/^[-*•]/.test(line))
      return `
        <section>
          <h2>${escapeHtml(title)}</h2>
          ${paragraphs.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
          ${listItems.length ? `<ul>${listItems.map((line) => `<li>${escapeHtml(line.replace(/^[-*•]\s*/, ''))}</li>`).join('')}</ul>` : ''}
        </section>
      `
    })
    .join('')

  return `<article>${body || `<section><pre>${escapeHtml(text)}</pre></section>`}</article>`
}

const extractPersonalDetails = (text: string): Record<string, string> => {
  const lines = normalizeLines(text)
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\d{10})/)?.[0] ?? ''
  const linkedIn = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+/i)?.[0] ?? ''
  const github = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s]+/i)?.[0] ?? ''
  const portfolio = text.match(/https?:\/\/(?!.*linkedin|.*github)[^\s]+/i)?.[0] ?? ''
  const name = lines[0] ?? ''
  return { name, email, phone, linkedIn, github, portfolio }
}

const extractSectionLines = (text: string, key: ResumeSectionKey): string[] => {
  const lines = normalizeLines(text)
  const collected: string[] = []
  let capture = false

  for (const line of lines) {
    const detected = findSectionKey(line)
    if (detected) {
      capture = detected === key
      continue
    }
    if (capture) {
      collected.push(line.replace(/^[-*•]\s*/, ''))
    }
  }

  return dedupe(collected)
}

const extractSkills = (text: string): string[] =>
  dedupe(
    extractSectionLines(text, 'skills')
      .flatMap((line) => line.split(/[,:|]/))
      .map((item) => item.trim()),
  )

export const classifyDocumentContent = (text: string, structuredData: ResumeStructuredData): DocumentClassification => {
  const normalized = normalizeText(text).toLowerCase()
  const reasons: string[] = []
  const resumeSignals = [
    { label: 'contact details', hit: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text) || /\b(?:\+?\d{1,3}[-.\s]?)?\d{10}\b/.test(text) },
    { label: 'education section', hit: /\b(education|academic|university|college|degree|b\.?tech|bachelor|master|cgpa|percentage)\b/.test(normalized) || structuredData.education.length > 0 },
    { label: 'skills section', hit: /\b(skills|technical skills|core skills|technologies|programming languages)\b/.test(normalized) || structuredData.skills.length > 0 },
    { label: 'project or experience section', hit: /\b(projects?|experience|internship|employment|work history|responsibilities|achievements)\b/.test(normalized) || structuredData.projects.length > 0 || structuredData.experience.length > 0 },
    { label: 'resume profile terms', hit: /\b(summary|objective|profile|portfolio|github|linkedin|certifications?)\b/.test(normalized) },
  ]
  const invalidSignals = [
    { type: 'payment_slip' as DocumentType, label: 'payment or salary terms', hit: /\b(payment slip|payslip|pay slip|salary slip|net pay|gross pay|basic pay|hra|provident fund|pf number|earnings|deductions|bank account|utr|transaction id|payment reference|invoice no|invoice number|amount paid|credited|debit|credit)\b/.test(normalized) },
    { type: 'certificate' as DocumentType, label: 'certificate terms', hit: /\b(certificate of|certifies that|awarded to|completion certificate|participation certificate)\b/.test(normalized) },
    { type: 'job_description' as DocumentType, label: 'job description terms', hit: /\b(job description|responsibilities include|required qualifications|preferred qualifications|about the role|we are hiring|apply now|job type|salary range)\b/.test(normalized) },
  ]

  const resumeScore = resumeSignals.reduce((score, signal) => {
    if (signal.hit) reasons.push(signal.label)
    return score + (signal.hit ? 1 : 0)
  }, 0)
  const invalid = invalidSignals.find((signal) => signal.hit)
  if (invalid) {
    reasons.push(invalid.label)
    return { type: invalid.type, isResume: false, confidence: Math.min(95, 60 + resumeScore * 5), reasons }
  }

  if (resumeScore >= 3 && normalized.length >= 120) {
    return { type: 'resume', isResume: true, confidence: Math.min(98, 45 + resumeScore * 10), reasons }
  }

  return { type: 'other', isResume: false, confidence: Math.max(35, 70 - resumeScore * 8), reasons: reasons.length ? reasons : ['resume sections not detected'] }
}

export const extractResumeContent = async (filePath: string): Promise<ResumeContentResult> => {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.pdf') {
    const data = await fs.readFile(filePath)
    try {
      const parser = new PDFParse({ data })
      const result = await parser.getText()
      await parser.destroy()
      const text = normalizeText(result.text || '')
      const html = buildStructuredHtmlFromText(text)
      return {
        text,
        html,
        structuredData: {
          personalDetails: extractPersonalDetails(text),
          skills: extractSkills(text),
          education: extractSectionLines(text, 'education'),
          projects: extractSectionLines(text, 'projects'),
          experience: extractSectionLines(text, 'experience'),
          certifications: extractSectionLines(text, 'certifications'),
        },
      }
    } catch (error) {
      const fallbackText = extractTextFromPdfBufferFallback(data)
      const text = normalizeText(fallbackText || '')
      if (!text) {
        const reason = error instanceof Error ? error.message : 'Unknown PDF parsing error'
        throw new ApiError(
          400,
          `Could not read this PDF content. Please upload a text-based PDF or DOCX/TXT/RTF. Details: ${reason}`,
        )
      }

      const html = buildStructuredHtmlFromText(text)
      return {
        text,
        html,
        structuredData: {
          personalDetails: extractPersonalDetails(text),
          skills: extractSkills(text),
          education: extractSectionLines(text, 'education'),
          projects: extractSectionLines(text, 'projects'),
          experience: extractSectionLines(text, 'experience'),
          certifications: extractSectionLines(text, 'certifications'),
        },
      }
    }
  }

  if (extension === '.docx') {
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ path: filePath }),
      mammoth.convertToHtml({ path: filePath }),
    ])
    const text = normalizeText(textResult.value || '')
    const html = cleanHtml(htmlResult.value || buildStructuredHtmlFromText(text))
    return {
      text,
      html: html.startsWith('<article') ? html : `<article>${html}</article>`,
      structuredData: {
        personalDetails: extractPersonalDetails(text),
        skills: extractSkills(text),
        education: extractSectionLines(text, 'education'),
        projects: extractSectionLines(text, 'projects'),
        experience: extractSectionLines(text, 'experience'),
        certifications: extractSectionLines(text, 'certifications'),
      },
    }
  }

  if (extension === '.txt') {
    const raw = await fs.readFile(filePath, 'utf8')
    const text = normalizeText(raw || '')
    const html = buildStructuredHtmlFromText(text)
    return {
      text,
      html,
      structuredData: {
        personalDetails: extractPersonalDetails(text),
        skills: extractSkills(text),
        education: extractSectionLines(text, 'education'),
        projects: extractSectionLines(text, 'projects'),
        experience: extractSectionLines(text, 'experience'),
        certifications: extractSectionLines(text, 'certifications'),
      },
    }
  }

  if (extension === '.rtf') {
    const raw = await fs.readFile(filePath, 'utf8')
    const text = normalizeText(stripRtf(raw || ''))
    const html = buildStructuredHtmlFromText(text)
    return {
      text,
      html,
      structuredData: {
        personalDetails: extractPersonalDetails(text),
        skills: extractSkills(text),
        education: extractSectionLines(text, 'education'),
        projects: extractSectionLines(text, 'projects'),
        experience: extractSectionLines(text, 'experience'),
        certifications: extractSectionLines(text, 'certifications'),
      },
    }
  }

  throw new ApiError(400, 'Unsupported file type. Supported formats: PDF, DOCX, TXT, RTF.')
}

export const extractResumeText = async (filePath: string): Promise<string> => {
  const content = await extractResumeContent(filePath)
  return content.text
}
