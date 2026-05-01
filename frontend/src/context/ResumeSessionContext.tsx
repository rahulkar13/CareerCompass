import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'

type ApiRecord = Record<string, any>

interface ResumeSessionValue {
  resume: ApiRecord | null
  analysis: ApiRecord | null
  reports: ApiRecord[]
  reportsLoaded: boolean
  pageState: Record<string, ApiRecord>
  setSession: (resume: ApiRecord | null, analysis: ApiRecord | null) => void
  setReports: (reports: ApiRecord[]) => void
  setPageState: (key: string, state: ApiRecord) => void
  clearPageState: () => void
  clearSession: () => void
}

const ResumeSessionContext = createContext<ResumeSessionValue | undefined>(undefined)

export const ResumeSessionProvider = ({ children }: PropsWithChildren) => {
  const [resume, setResume] = useState<ApiRecord | null>(null)
  const [analysis, setAnalysis] = useState<ApiRecord | null>(null)
  const [reports, setReportsState] = useState<ApiRecord[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [pageState, setPageStateRecord] = useState<Record<string, ApiRecord>>({})

  const value = useMemo<ResumeSessionValue>(
    () => ({
      resume,
      analysis,
      reports,
      reportsLoaded,
      pageState,
      setSession: (nextResume, nextAnalysis) => {
        setResume(nextResume)
        setAnalysis(nextAnalysis)
      },
      setReports: (nextReports) => {
        setReportsState(nextReports)
        setReportsLoaded(true)
      },
      setPageState: (key, state) => {
        setPageStateRecord((current) => ({ ...current, [key]: state }))
      },
      clearPageState: () => {
        setPageStateRecord({})
      },
      clearSession: () => {
        setResume(null)
        setAnalysis(null)
        setReportsState([])
        setReportsLoaded(false)
        setPageStateRecord({})
      },
    }),
    [analysis, pageState, reports, reportsLoaded, resume],
  )

  return <ResumeSessionContext.Provider value={value}>{children}</ResumeSessionContext.Provider>
}

export const useResumeSession = (): ResumeSessionValue => {
  const context = useContext(ResumeSessionContext)
  if (!context) {
    throw new Error('useResumeSession must be used within a ResumeSessionProvider.')
  }
  return context
}
