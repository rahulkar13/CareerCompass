import { env } from '../config/env'

type SupportedLanguage = 'python' | 'javascript' | 'java' | 'cpp'

export type ExecutionResult = {
  stdout: string
  stderr: string
  compileOutput: string
  status: string
  time: string
  memory: number
}

type JudgeZeroResponse = {
  stdout?: string | null
  stderr?: string | null
  compile_output?: string | null
  status?: { description?: string | null }
  time?: string | null
  memory?: number | null
}

const languageIdMap: Record<SupportedLanguage, number> = {
  python: 71,
  javascript: 63,
  java: 62,
  cpp: 54,
}

const supportedLanguages = Object.keys(languageIdMap) as SupportedLanguage[]

export const codingExecutionService = {
  supportedLanguages,

  isConfigured(): boolean {
    return Boolean(env.codeExecutionBaseUrl)
  },

  isSupportedLanguage(language: string): language is SupportedLanguage {
    return supportedLanguages.includes(language as SupportedLanguage)
  },

  async executeCode(code: string, language: string, stdin: string): Promise<ExecutionResult> {
    if (!this.isSupportedLanguage(language)) {
      throw new Error('Selected language is not supported for code execution.')
    }

    if (!this.isConfigured()) {
      throw new Error('Code execution service is not configured.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.codeExecutionTimeoutMs)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (env.codeExecutionApiKey) headers['X-RapidAPI-Key'] = env.codeExecutionApiKey
      if (env.codeExecutionApiHost) headers['X-RapidAPI-Host'] = env.codeExecutionApiHost

      const response = await fetch(`${env.codeExecutionBaseUrl.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language_id: languageIdMap[language],
          source_code: code,
          stdin,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error('Code execution API request failed.')
      }

      const data = (await response.json()) as JudgeZeroResponse
      return {
        stdout: String(data.stdout ?? ''),
        stderr: String(data.stderr ?? ''),
        compileOutput: String(data.compile_output ?? ''),
        status: String(data.status?.description ?? 'Unknown'),
        time: String(data.time ?? ''),
        memory: Number(data.memory ?? 0),
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Code execution timed out.')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  },
}
