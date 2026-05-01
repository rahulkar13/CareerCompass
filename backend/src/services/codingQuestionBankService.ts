import fs from 'node:fs/promises'
import path from 'node:path'
import { CodingProblem } from '../models/CodingProblem'

export type CodingQuestionTestCase = {
  input: string
  output: string
  explanation?: string
}

export type CodingQuestion = {
  id: string
  domain: string
  role: string
  topic: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  title: string
  problemStatement: string
  inputFormat: string
  outputFormat: string
  constraints: string[]
  sampleInput: string
  sampleOutput: string
  explanation: string
  supportedLanguages: string[]
  timeLimit: number
  memoryLimit: number
  visibleTestCases: CodingQuestionTestCase[]
  hiddenTestCases: CodingQuestionTestCase[]
  tags: string[]
}

const bankFolder = path.join(process.cwd(), 'src', 'coding-question-bank')

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []

const normalizeTestCase = (value: CodingQuestionTestCase): CodingQuestionTestCase => ({
  input: String(value.input ?? ''),
  output: String(value.output ?? ''),
  explanation: String(value.explanation ?? '').trim() || undefined,
})

const normalizeQuestion = (value: CodingQuestion): CodingQuestion => ({
  id: String(value.id ?? '').trim(),
  domain: String(value.domain ?? '').trim(),
  role: String(value.role ?? '').trim(),
  topic: String(value.topic ?? '').trim(),
  difficulty: value.difficulty,
  title: String(value.title ?? '').trim(),
  problemStatement: String(value.problemStatement ?? '').trim(),
  inputFormat: String(value.inputFormat ?? '').trim(),
  outputFormat: String(value.outputFormat ?? '').trim(),
  constraints: toStringArray(value.constraints),
  sampleInput: String(value.sampleInput ?? ''),
  sampleOutput: String(value.sampleOutput ?? ''),
  explanation: String(value.explanation ?? '').trim(),
  supportedLanguages: toStringArray(value.supportedLanguages).map((item) => item.toLowerCase()),
  timeLimit: Number(value.timeLimit ?? 2),
  memoryLimit: Number(value.memoryLimit ?? 256),
  visibleTestCases: Array.isArray(value.visibleTestCases) ? value.visibleTestCases.map(normalizeTestCase) : [],
  hiddenTestCases: Array.isArray(value.hiddenTestCases) ? value.hiddenTestCases.map(normalizeTestCase) : [],
  tags: toStringArray(value.tags),
})

export const codingQuestionBankService = {
  async loadAll(): Promise<CodingQuestion[]> {
    const files = (await fs.readdir(bankFolder))
      .filter((file) => file.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b))

    const groups = await Promise.all(files.map(async (file) => {
      const content = await fs.readFile(path.join(bankFolder, file), 'utf8')
      const parsed = JSON.parse(content) as CodingQuestion[]
      return parsed.map(normalizeQuestion)
    }))
    const customProblems = await CodingProblem.find().lean<Array<Record<string, unknown>>>()
    const customNormalized = customProblems.map((problem) =>
      normalizeQuestion({
        id: String(problem.problemId ?? problem._id ?? ''),
        domain: String(problem.domain ?? ''),
        role: String(problem.role ?? ''),
        topic: String(problem.topic ?? ''),
        difficulty: String(problem.difficulty ?? 'Intermediate') as CodingQuestion['difficulty'],
        title: String(problem.title ?? ''),
        problemStatement: String(problem.problemStatement ?? ''),
        inputFormat: String(problem.inputFormat ?? ''),
        outputFormat: String(problem.outputFormat ?? ''),
        constraints: toStringArray(problem.constraints),
        sampleInput: String(problem.sampleInput ?? ''),
        sampleOutput: String(problem.sampleOutput ?? ''),
        explanation: String(problem.explanation ?? ''),
        supportedLanguages: toStringArray(problem.supportedLanguages),
        timeLimit: Number(problem.timeLimit ?? 2),
        memoryLimit: Number(problem.memoryLimit ?? 256),
        visibleTestCases: Array.isArray(problem.visibleTestCases) ? problem.visibleTestCases.map((item) => normalizeTestCase(item as CodingQuestionTestCase)) : [],
        hiddenTestCases: Array.isArray(problem.hiddenTestCases) ? problem.hiddenTestCases.map((item) => normalizeTestCase(item as CodingQuestionTestCase)) : [],
        tags: toStringArray(problem.tags),
      }),
    )

    return [...groups.flat(), ...customNormalized]
  },
}
