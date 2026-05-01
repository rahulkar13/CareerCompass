import fs from 'node:fs/promises'
import path from 'node:path'
import { InterviewQuestion } from '../models/InterviewQuestion'

export type InterviewBankQuestion = {
  id: string
  field: string
  role: string
  category: string
  topic: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  experienceLevel: 'fresher' | 'experienced'
  companyType: 'service company' | 'product company' | 'startup' | 'campus placement' | 'general' | 'internship interview'
  questionText: string
  answerHint: string
  keyPoints: string[]
  commonMistakes: string[]
  tags: string[]
  whyRecommended?: string
  priority?: number
}

const bankFolder = path.join(process.cwd(), 'src', 'interview-question-bank')

const normalizeQuestion = (question: InterviewBankQuestion): InterviewBankQuestion => ({
  ...question,
  id: String(question.id).trim(),
  field: String(question.field).trim(),
  role: String(question.role).trim(),
  category: String(question.category).trim(),
  topic: String(question.topic).trim(),
  difficulty: question.difficulty,
  experienceLevel: question.experienceLevel,
  companyType: question.companyType,
  questionText: String(question.questionText).trim(),
  answerHint: String(question.answerHint).trim(),
  keyPoints: (question.keyPoints ?? []).map((item) => String(item).trim()).filter(Boolean),
  commonMistakes: (question.commonMistakes ?? []).map((item) => String(item).trim()).filter(Boolean),
  tags: (question.tags ?? []).map((item) => String(item).trim()).filter(Boolean),
  whyRecommended: String(question.whyRecommended ?? '').trim() || undefined,
  priority: Number(question.priority ?? 60),
})

export const interviewQuestionBankService = {
  folderPath: bankFolder,

  async loadAll(): Promise<InterviewBankQuestion[]> {
    const files = (await fs.readdir(bankFolder))
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b))

    const groups = await Promise.all(files.map(async (file) => {
      const content = await fs.readFile(path.join(bankFolder, file), 'utf8')
      const parsed = JSON.parse(content) as InterviewBankQuestion[]
      return parsed.map(normalizeQuestion)
    }))
    const customQuestions = await InterviewQuestion.find().lean<Array<Record<string, unknown>>>()
    const customNormalized = customQuestions.map((question) =>
      normalizeQuestion({
        id: String(question.bankId ?? question._id ?? ''),
        field: String(question.field ?? question.domain ?? 'general_fresher'),
        role: String(question.role ?? ''),
        category: String(question.category ?? 'General'),
        topic: String(question.topic ?? ''),
        difficulty: (String(question.difficulty ?? 'Intermediate') as InterviewBankQuestion['difficulty']),
        experienceLevel: (String(question.experienceLevel ?? 'fresher') as InterviewBankQuestion['experienceLevel']),
        companyType: (String(question.companyType ?? 'general') as InterviewBankQuestion['companyType']),
        questionText: String(question.questionText ?? (Array.isArray(question.questions) ? question.questions[0] : '') ?? ''),
        answerHint: String(question.answerHint ?? ''),
        keyPoints: Array.isArray(question.keyPoints) ? question.keyPoints.map((item) => String(item)) : [],
        commonMistakes: Array.isArray(question.commonMistakes) ? question.commonMistakes.map((item) => String(item)) : [],
        tags: Array.isArray(question.tags) ? question.tags.map((item) => String(item)) : [],
        whyRecommended: String(question.whyRecommended ?? 'Added by admin from the platform question bank.'),
        priority: Number(question.priority ?? 70),
      }),
    )

    return [...groups.flat(), ...customNormalized]
  },
}
