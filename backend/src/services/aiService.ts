import { env } from '../config/env'

interface MatchInput {
  resumeText: string
  jobText: string
}

interface ResumeStructuredData {
  personalDetails: Record<string, string>
  skills: string[]
  education: string[]
  projects: string[]
  experience: string[]
  certifications: string[]
}

interface ResumeScoringContext {
  jobText?: string
  targetRole?: string
  profileSkills?: string[]
  profileProjects?: string[]
  preferredIndustry?: string
}

interface ResumeAnalysisOptions {
  htmlContent?: string
  structuredData?: Partial<ResumeStructuredData>
  context?: ResumeScoringContext
}

interface SkillGapOptions {
  targetRole?: string
  domain?: string
}

interface SectionResult {
  title: string
  present: boolean
  score: number
  feedback: string
  suggestions: string[]
}

interface ScoreBreakdownItem {
  label: string
  score: number
  weight: number
  reason: string
}

const skillDictionary = {
  technical: [
    'javascript',
    'typescript',
    'react',
    'node',
    'express',
    'mongodb',
    'mysql',
    'postgresql',
    'sql',
    'python',
    'java',
    'c',
    'c++',
    'c#',
    'html',
    'css',
    'bootstrap',
    'tailwind',
    'redux',
    'next.js',
    'angular',
    'vue',
    'rest',
    'api',
    'docker',
    'git',
    'testing',
    'jest',
    'machine learning',
    'data structures',
    'algorithms',
    'oop',
  ],
  soft: ['communication', 'leadership', 'teamwork', 'problem solving', 'adaptability', 'collaboration', 'ownership', 'presentation'],
  tools: ['github', 'postman', 'figma', 'jira', 'vscode', 'aws', 'firebase', 'vercel', 'netlify', 'linux', 'excel', 'power bi'],
}

const sectionPatterns = [
  { key: 'personalInfo', title: 'Personal Info', pattern: /(email|phone|linkedin|github|portfolio)/i },
  { key: 'education', title: 'Education', pattern: /(education|degree|university|college|bachelor|master|cgpa)/i },
  { key: 'skills', title: 'Skills', pattern: /(skills|technologies|tools|programming)/i },
  { key: 'projects', title: 'Projects', pattern: /(projects|project experience|built|developed|implemented)/i },
  { key: 'experience', title: 'Experience', pattern: /(experience|internship|work|employment|responsibilities)/i },
  { key: 'certifications', title: 'Certifications', pattern: /(certification|certificate|course|training)/i },
]

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim()
const words = (text: string): string[] => normalize(text.toLowerCase()).split(/[^a-z0-9+#.]+/).filter(Boolean)
const unique = <T>(items: T[]): T[] => [...new Set(items)]
const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value))
const hasNumber = (text: string): boolean => /\b\d+(\.\d+)?%?\b/.test(text)
const actionVerbPattern = /\b(built|developed|led|implemented|designed|optimized|improved|created|managed|launched|delivered|architected)\b/gi
const hasActionVerb = (text: string): boolean => /\b(built|developed|led|implemented|designed|optimized|improved|created|managed|launched|delivered|architected)\b/i.test(text)
const tableOrImagePattern = /<(table|img|figure|svg|canvas)\b/i
const suspiciousGrammarPattern = /\b(i am|i has|i have did|responsible to|good in|knowledge on)\b/i

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const includesSkill = (text: string, skill: string): boolean => {
  const normalizedSkill = skill.toLowerCase()
  if (['c', 'c++', 'c#'].includes(normalizedSkill)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedSkill)}([^a-z0-9]|$)`, 'i').test(text)
  }
  return new RegExp(`\\b${escapeRegExp(normalizedSkill)}\\b`, 'i').test(text)
}

const listHtml = (items: string[]): string => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
const asJsonObject = (value: string): Record<string, unknown> => {
  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response.')
  return JSON.parse(value.slice(start, end + 1)) as Record<string, unknown>
}

const callOpenAiJson = async (system: string, user: string): Promise<Record<string, unknown> | null> => {
  if (!env.openAiApiKey) return null
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) return null
  try {
    return asJsonObject(content)
  } catch {
    return null
  }
}

const extractSkills = (text: string) => {
  const lower = text.toLowerCase()
  return {
    technicalSkills: skillDictionary.technical.filter((skill) => includesSkill(lower, skill)),
    softSkills: skillDictionary.soft.filter((skill) => includesSkill(lower, skill)),
    toolsAndTechnologies: skillDictionary.tools.filter((skill) => includesSkill(lower, skill)),
  }
}

const sectionScore = (present: boolean, resumeText: string, sectionTitle: string): number => {
  if (!present) return 20
  const impactBonus = hasNumber(resumeText) ? 15 : 0
  const actionBonus = /(built|developed|improved|created|designed|implemented|led|optimized)/i.test(resumeText) ? 15 : 0
  const base = sectionTitle === 'Personal Info' ? 85 : 58
  return clamp(base + impactBonus + actionBonus)
}

const buildSections = (resumeText: string): SectionResult[] =>
  sectionPatterns.map((section) => {
    const present = section.pattern.test(resumeText)
    const score = sectionScore(present, resumeText, section.title)
    return {
      title: section.title,
      present,
      score,
      feedback: present
        ? `${section.title} is detected and contributes to resume completeness.`
        : `${section.title} is missing or too weak to detect clearly.`,
      suggestions: present
        ? [`Make ${section.title.toLowerCase()} more measurable and keyword-rich.`]
        : [`Add a clear ${section.title.toLowerCase()} section with concise, recruiter-friendly details.`],
    }
  })

const buildScoreBreakdown = (
  resumeText: string,
  sections: SectionResult[],
  extractedSkillsList: string[],
  structuredData: Partial<ResumeStructuredData> = {},
  htmlContent = '',
  context: ResumeScoringContext = {},
): ScoreBreakdownItem[] => {
  const sectionPresentCount = sections.filter((section) => section.present).length
  const effectiveTargetRole = context.targetRole?.trim() || ''
  const hasTargetContext = Boolean(
    context.jobText?.trim()
    || context.targetRole?.trim()
    || context.preferredIndustry?.trim()
    || (context.profileSkills ?? []).length,
  )
  const { targetKeywords, matchedKeywords, matchPercent } = buildKeywordInputs(resumeText, extractedSkillsList, context)
  const keywordScore = hasTargetContext
    ? scoreFromBands(
        matchPercent,
        [
          { min: 90, score: 30 },
          { min: 70, score: 25 },
          { min: 50, score: 18 },
          { min: 30, score: 10 },
        ],
        5,
      )
    : extractedSkillsList.length >= 8
      ? 24
      : extractedSkillsList.length >= 5
        ? 20
        : extractedSkillsList.length >= 3
          ? 15
          : 10

  const projectText = `${(structuredData.projects ?? []).join(' ')} ${resumeText}`
  const experienceText = `${(structuredData.experience ?? []).join(' ')} ${resumeText}`
  const targetSkillPool = unique([
    ...(context.profileSkills ?? []).map((skill) => skill.toLowerCase()),
    ...(effectiveTargetRole ? findRoleKeywords(effectiveTargetRole) : []),
    ...extractSkills(context.jobText ?? '').technicalSkills,
    ...extractSkills(context.jobText ?? '').toolsAndTechnologies,
  ]).filter(Boolean)
  const matchedTargetSkills = targetSkillPool.filter((skill) => extractedSkillsList.map((item) => item.toLowerCase()).includes(skill))
  const demonstratedSkills = matchedTargetSkills.filter((skill) => projectText.toLowerCase().includes(skill) || experienceText.toLowerCase().includes(skill))
  const skillsScore = matchedTargetSkills.length >= 5 && demonstratedSkills.length >= Math.min(3, matchedTargetSkills.length)
    ? 20
    : matchedTargetSkills.length >= 3 && demonstratedSkills.length >= 1
      ? 16
    : matchedTargetSkills.length >= 1
        ? demonstratedSkills.length >= 1 ? 12 : 10
        : extractedSkillsList.length >= 4
          ? 8
          : 5

  const actionVerbCount = countActionVerbs(resumeText)
  const quantifiedCount = (resumeText.match(/\b\d+(\.\d+)?%?\b/g) ?? []).length
  const experienceScore = actionVerbCount >= 4 && quantifiedCount >= 2
    ? 15
    : actionVerbCount >= 2 || quantifiedCount >= 1
      ? 10
      : 5

  const hasPoorFormattingSignals = tableOrImagePattern.test(htmlContent) || /\b(table|columns?)\b/i.test(resumeText)
  const hasCoreHeadings = ['Education', 'Skills'].every((title) => sections.some((section) => section.title === title && section.present))
  const structureScore = !hasPoorFormattingSignals && hasCoreHeadings && sectionPresentCount >= 5
    ? 10
    : !hasPoorFormattingSignals && sectionPresentCount >= 3
      ? 7
      : 3

  const sentenceList = resumeText.split(/[.!?]\s+/).map((sentence) => sentence.trim()).filter(Boolean)
  const averageSentenceLength = sentenceList.length
    ? Math.round(words(sentenceList.join(' ')).length / sentenceList.length)
    : 0
  const capsWords = (resumeText.match(/\b[A-Z]{4,}\b/g) ?? []).length
  const noisyPunctuation = (resumeText.match(/[!?]{2,}|\.{3,}/g) ?? []).length
  const grammarSignals = (suspiciousGrammarPattern.test(resumeText) ? 1 : 0) + noisyPunctuation + (capsWords > 6 ? 1 : 0)
  const readabilityScore = averageSentenceLength >= 8 && averageSentenceLength <= 24 && grammarSignals === 0
    ? 10
    : averageSentenceLength >= 5 && averageSentenceLength <= 30 && grammarSignals <= 2
      ? 7
      : 3

  const roleKeywords = effectiveTargetRole ? findRoleKeywords(effectiveTargetRole) : []
  const roleMatches = roleKeywords.filter((keyword) => resumeText.toLowerCase().includes(keyword) || extractedSkillsList.map((item) => item.toLowerCase()).includes(keyword))
  const roleAlignmentScore = roleKeywords.length
    ? roleMatches.length >= Math.max(2, Math.ceil(roleKeywords.length / 2))
      ? 10
      : roleMatches.length >= 1
        ? 6
        : 2
    : extractedSkillsList.length >= 5
      ? 8
      : 5

  const projectItems = structuredData.projects ?? []
  const projectHasLinks = /(github|gitlab|portfolio|https?:\/\/)/i.test(projectText)
  const projectHasTech = extractedSkillsList.some((skill) => projectText.toLowerCase().includes(skill.toLowerCase()))
  const projectHasAction = hasActionVerb(projectText)
  const projectsScore = projectItems.length >= 2 && projectHasTech && (projectHasLinks || projectHasAction)
    ? 5
    : projectItems.length >= 1 && (projectHasTech || actionVerbCount >= 2)
      ? 3
      : 1

  return [
    {
      label: 'Keyword Match',
      score: keywordScore,
      weight: 30,
      reason: targetKeywords.length
        ? `${matchedKeywords.length} of ${targetKeywords.length} job/profile keywords matched (${matchPercent}%). Band score: ${keywordScore}/30.`
        : `No JD or target role keywords were available, so this score uses resume skill coverage (${extractedSkillsList.length} detected skills).`,
    },
    {
      label: 'Skills Relevance',
      score: skillsScore,
      weight: 20,
      reason: `${matchedTargetSkills.length} relevant skills were found, with ${demonstratedSkills.length} demonstrated in projects or experience. Score follows the 20-point skills relevance rubric.`,
    },
    {
      label: 'Experience Quality',
      score: experienceScore,
      weight: 15,
      reason: `${actionVerbCount} action verbs and ${quantifiedCount} quantified outcomes were detected. Strong quantified experience earns 15 points.`,
    },
    {
      label: 'Resume Structure & Formatting',
      score: structureScore,
      weight: 10,
      reason: `${sectionPresentCount} major sections were detected${hasPoorFormattingSignals ? ', with table/image/column formatting risk.' : ' with ATS-friendly heading detection.'}`,
    },
    {
      label: 'Grammar & Readability',
      score: readabilityScore,
      weight: 10,
      reason: averageSentenceLength
        ? `Average sentence length is about ${averageSentenceLength} words, with ${grammarSignals} grammar/readability warning signals.`
        : 'Readability could not be measured confidently from the extracted text.',
    },
    {
      label: 'Job Role Alignment',
      score: roleAlignmentScore,
      weight: 10,
      reason: roleKeywords.length
        ? `${roleMatches.length} role-specific keywords were found for the target role "${effectiveTargetRole}".`
        : 'No target role was provided, so role alignment uses general technical skill breadth.',
    },
    {
      label: 'Projects Quality',
      score: projectsScore,
      weight: 5,
      reason: projectItems.length
        ? `${projectItems.length} project entries were detected${projectHasLinks ? ' with links or portfolio references' : ''}.`
        : 'No strong project evidence was detected in the extracted project section.',
    },
  ]
}

const scoreResume = (breakdown: ScoreBreakdownItem[]): number =>
  breakdown.reduce((sum, item) => sum + item.score, 0)

const missingInDemandSkills = (skills: string[]): string[] =>
  ['typescript', 'testing', 'rest', 'mongodb', 'git', 'docker', 'system design'].filter((skill) => !skills.includes(skill))

const extractKeywordSet = (text: string): Set<string> =>
  new Set(words(text).filter((word) => word.length > 2 && !['and', 'the', 'with', 'for', 'from', 'that'].includes(word)))

const roleKeywordMap: Record<string, string[]> = {
  software: ['javascript', 'python', 'java', 'sql', 'git', 'api', 'data structures', 'algorithms', 'oop', 'testing'],
  developer: ['javascript', 'python', 'java', 'sql', 'git', 'api', 'data structures', 'algorithms', 'oop', 'testing'],
  frontend: ['react', 'javascript', 'typescript', 'html', 'css', 'redux', 'ui', 'tailwind'],
  backend: ['node', 'express', 'api', 'mongodb', 'sql', 'database', 'rest', 'authentication'],
  fullstack: ['react', 'node', 'express', 'mongodb', 'sql', 'javascript', 'typescript', 'api'],
  'full stack': ['react', 'node', 'express', 'mongodb', 'sql', 'javascript', 'typescript', 'api'],
  data: ['python', 'sql', 'machine learning', 'pandas', 'analysis', 'statistics'],
  devops: ['docker', 'aws', 'linux', 'ci', 'cd', 'kubernetes', 'terraform'],
  finance: ['accounting', 'excel', 'gst', 'taxation', 'auditing', 'tally'],
  accountant: ['accounting', 'excel', 'gst', 'taxation', 'tally'],
  banking: ['banking', 'excel', 'accounting', 'communication'],
  mechanical: ['autocad', 'solidworks', 'manufacturing', 'maintenance', 'quality', 'machine design'],
  civil: ['autocad', 'revit', 'staad', 'estimation', 'quantity surveying', 'site supervision'],
  electrical: ['plc', 'matlab', 'wiring', 'control panel', 'circuit analysis', 'maintenance'],
  electronics: ['embedded systems', 'microcontroller', 'arduino', 'pcb', 'vlsi', 'circuit design'],
  marketing: ['seo', 'sem', 'content writing', 'branding', 'campaign', 'social media'],
  hr: ['recruitment', 'onboarding', 'communication', 'payroll', 'employee engagement', 'excel'],
  design: ['figma', 'photoshop', 'illustrator', 'wireframe', 'prototype', 'typography'],
  healthcare: ['patient care', 'medical coding', 'clinical documentation', 'emr', 'healthcare operations'],
}

const findRoleKeywords = (targetRole: string): string[] => {
  const lower = targetRole.toLowerCase()
  return unique(
    Object.entries(roleKeywordMap)
      .filter(([key]) => lower.includes(key))
      .flatMap(([, keywords]) => keywords),
  )
}

const domainSkillMap: Record<string, string[]> = {
  it_software: ['javascript', 'sql', 'git', 'testing', 'api', 'typescript'],
  data_analytics: ['excel', 'sql', 'power bi', 'tableau', 'statistics', 'python'],
  commerce_finance: ['accounting', 'excel', 'gst', 'taxation', 'auditing', 'tally'],
  mechanical: ['autocad', 'solidworks', 'manufacturing', 'maintenance', 'quality'],
  civil: ['autocad', 'revit', 'staad', 'estimation', 'quantity surveying', 'site supervision'],
  electrical: ['plc', 'matlab', 'wiring', 'control panel', 'circuit analysis', 'maintenance'],
  electronics: ['embedded systems', 'microcontroller', 'arduino', 'pcb', 'vlsi'],
  marketing: ['seo', 'sem', 'content writing', 'branding', 'campaign'],
  hr: ['recruitment', 'onboarding', 'communication', 'payroll', 'employee engagement'],
  design: ['figma', 'photoshop', 'illustrator', 'wireframe', 'prototype'],
  healthcare: ['patient care', 'medical coding', 'clinical documentation', 'emr', 'healthcare operations'],
  general_fresher: ['communication', 'teamwork', 'problem solving', 'excel'],
}

const skillGapDefaults = (targetRole = '', domain = ''): string[] => {
  const roleKeywords = findRoleKeywords(targetRole)
  if (roleKeywords.length) return roleKeywords
  const domainSkills = domainSkillMap[domain]
  if (domainSkills?.length) return domainSkills
  return ['communication', 'teamwork', 'problem solving', 'excel']
}

const scoreFromBands = (value: number, bands: Array<{ min: number; score: number }>, fallback: number): number => {
  for (const band of bands) {
    if (value >= band.min) return band.score
  }
  return fallback
}

const countActionVerbs = (text: string): number => (text.match(actionVerbPattern) ?? []).length

const buildKeywordInputs = (
  resumeText: string,
  extractedSkillsList: string[],
  context: ResumeScoringContext = {},
): { targetKeywords: string[]; matchedKeywords: string[]; matchPercent: number } => {
  const resumeKeywords = extractKeywordSet(`${resumeText} ${extractedSkillsList.join(' ')}`)
  const effectiveTargetRole = context.targetRole?.trim() || ''
  const targetRoleKeywords = effectiveTargetRole ? findRoleKeywords(effectiveTargetRole) : []
  const targetSkills = extractSkills(context.jobText ?? '')
  const profileSkills = (context.profileSkills ?? []).map((skill) => skill.toLowerCase())
  const targetKeywords = unique([
    ...targetRoleKeywords,
    ...profileSkills,
    ...targetSkills.technicalSkills,
    ...targetSkills.toolsAndTechnologies,
    ...extractKeywordSet(context.jobText ?? ''),
    ...extractKeywordSet(effectiveTargetRole),
    ...extractKeywordSet(context.preferredIndustry ?? ''),
  ]).filter((keyword) => keyword.length > 2)

  if (!targetKeywords.length) {
    return { targetKeywords: [], matchedKeywords: [], matchPercent: 0 }
  }

  const matchedKeywords = targetKeywords.filter((keyword) => resumeKeywords.has(keyword))
  const matchPercent = Math.round((matchedKeywords.length / targetKeywords.length) * 100)
  return { targetKeywords, matchedKeywords, matchPercent }
}

const makeAnalysisHtml = (score: number, sections: SectionResult[], improvements: string[]): string => `
  <section>
    <h2>Resume Analysis Report</h2>
    <p><strong>Overall Score:</strong> ${score}/100</p>
    <h3>Section Feedback</h3>
    ${sections.map((section) => `<h4>${escapeHtml(section.title)} - ${section.score}/100</h4><p>${escapeHtml(section.feedback)}</p>${listHtml(section.suggestions)}`).join('')}
    <h3>Improvement Roadmap</h3>
    ${listHtml(improvements)}
  </section>
`

const predefinedResumePrompt = `You are an expert resume analysis assistant. The input provided is a candidate resume converted into clean HTML from a PDF or DOCX file. Analyze the resume carefully and identify the candidate's personal details, skills, education, projects, experience, certifications, strengths, weaknesses, missing sections, ATS-related issues, and improvement suggestions. Return the result in a clear and structured format. Do not invent or assume details that are not present in the resume. Only use the information available in the provided HTML content.`

export const aiService = {
  async analyzeResumeHtml(htmlContent: string, resumeText: string, structuredData: ResumeStructuredData, context: ResumeScoringContext = {}) {
    const baseAnalysis = await this.analyzeResume(resumeText, { htmlContent, structuredData, context })
    const fallback = {
      ...baseAnalysis,
      personalDetails: structuredData.personalDetails,
      extractedSkills: structuredData.skills.length ? structuredData.skills : unique(Object.values(extractSkills(resumeText)).flat()),
      extractedEducation: structuredData.education,
      extractedProjects: structuredData.projects,
      extractedExperience: structuredData.experience,
      extractedCertifications: structuredData.certifications,
      strengths: baseAnalysis.structuredContent.sections.filter((section) => section.score >= 70).map((section) => section.title),
      weaknesses: baseAnalysis.structuredContent.missingOrWeakSections,
      missingSections: baseAnalysis.structuredContent.missingOrWeakSections,
      atsIssues: [baseAnalysis.atsCompatibility.feedback],
      suggestions: [
        ...baseAnalysis.structuredContent.sections.flatMap((section) => section.suggestions),
        ...baseAnalysis.keywordOptimization.missingInDemandSkills.map((skill) => `Add stronger evidence for ${skill}.`),
      ],
    }

    const aiResult = await callOpenAiJson(
      predefinedResumePrompt,
      `Analyze this resume HTML and return JSON with keys:
personalDetails:{name:string,email:string,phone:string,linkedin:string,github:string,portfolio:string},
extractedSkills:string[],
extractedEducation:string[],
extractedProjects:string[],
extractedExperience:string[],
extractedCertifications:string[],
scoreBreakdown:[{label:string,score:number,weight:number,reason:string}],
strengths:string[],
weaknesses:string[],
missingSections:string[],
atsIssues:string[],
suggestions:string[]

Resume HTML:
${htmlContent.slice(0, 15000)}`,
    )

    if (!aiResult) return fallback
    return {
      ...fallback,
      ...aiResult,
      personalDetails: { ...structuredData.personalDetails, ...(aiResult.personalDetails as Record<string, string> | undefined) },
      extractedSkills: (aiResult.extractedSkills as string[] | undefined) ?? fallback.extractedSkills,
      extractedEducation: (aiResult.extractedEducation as string[] | undefined) ?? fallback.extractedEducation,
      extractedProjects: (aiResult.extractedProjects as string[] | undefined) ?? fallback.extractedProjects,
      extractedExperience: (aiResult.extractedExperience as string[] | undefined) ?? fallback.extractedExperience,
      extractedCertifications: (aiResult.extractedCertifications as string[] | undefined) ?? fallback.extractedCertifications,
      strengths: (aiResult.strengths as string[] | undefined) ?? fallback.strengths,
      weaknesses: (aiResult.weaknesses as string[] | undefined) ?? fallback.weaknesses,
      missingSections: (aiResult.missingSections as string[] | undefined) ?? fallback.missingSections,
      atsIssues: (aiResult.atsIssues as string[] | undefined) ?? fallback.atsIssues,
      suggestions: (aiResult.suggestions as string[] | undefined) ?? fallback.suggestions,
    }
  },

  async analyzeResume(resumeText: string, options: ResumeAnalysisOptions = {}) {
    const cleanedText = normalize(resumeText)
    const skills = extractSkills(cleanedText)
    const allSkills = unique([
      ...(options.structuredData?.skills ?? []),
      ...skills.technicalSkills,
      ...skills.softSkills,
      ...skills.toolsAndTechnologies,
    ])
    const sections = buildSections(cleanedText)
    const scoreBreakdown = buildScoreBreakdown(
      cleanedText,
      sections,
      allSkills,
      options.structuredData,
      options.htmlContent ?? '',
      options.context,
    )
    const score = scoreResume(scoreBreakdown)
    const missingSections = sections.filter((section) => !section.present).map((section) => section.title)
    const improvements = [
      'Add measurable impact using numbers such as percentage, time saved, users served, or performance gain.',
      'Use role-specific keywords naturally in skills, projects, and experience.',
      'Rewrite project bullets using action verb + technology + outcome.',
      ...missingSections.map((section) => `Add or strengthen the ${section} section.`),
    ]
    const formattingBreakdown = scoreBreakdown.find((item) => item.label === 'Resume Structure & Formatting')

    const fallback = {
      score,
      scoreBreakdown,
      structuredContent: {
        sections,
        normalizedTextPreview: cleanedText.slice(0, 700),
        missingOrWeakSections: missingSections,
      },
      atsCompatibility: {
        score: Math.round(((formattingBreakdown?.score ?? 0) / 10) * 100),
        feedback: formattingBreakdown?.reason ?? 'Use standard section headings, plain text, consistent dates, and avoid image-only resume content.',
      },
      keywordOptimization: {
        detectedSkills: skills,
        missingInDemandSkills: missingInDemandSkills(allSkills),
      },
      clarityAndImpact: {
        score: hasNumber(cleanedText) ? 85 : 58,
        feedback: hasNumber(cleanedText)
          ? 'Resume includes measurable details. Keep connecting each metric to business or project impact.'
          : 'Resume needs stronger measurable outcomes. Add metrics to projects and experience bullets.',
      },
      technicalStrength: {
        score: clamp(skills.technicalSkills.length * 11, 30, 95),
        feedback: skills.technicalSkills.length >= 6 ? 'Technical skill coverage is strong.' : 'Add more role-relevant technical skills and tool evidence.',
      },
      enhancement: {
        summaryRewrite: `Motivated candidate with practical experience in ${allSkills.slice(0, 5).join(', ') || 'software development'}, focused on building reliable, user-focused solutions.`,
        bulletRewriteTemplate: 'Developed [feature/project] using [technology], improving [metric/outcome] for [users/team].',
        projectDescriptionTemplate: 'Built an end-to-end project that solves [problem], using [stack], with measurable outcomes such as [metric].',
      },
      formattedHtml: makeAnalysisHtml(score, sections, improvements),
      pdfReady: true,
    }
    const aiResult = await callOpenAiJson(
      'You are an ATS resume analysis assistant. Return only valid JSON matching the requested shape with concise, recruiter-friendly language.',
      `Analyze this resume text and return JSON with keys:
score:number,
scoreBreakdown:[{label:string,score:number,weight:number,reason:string}],
structuredContent:{sections:[{title:string,present:boolean,score:number,feedback:string,suggestions:string[]}],normalizedTextPreview:string,missingOrWeakSections:string[]},
atsCompatibility:{score:number,feedback:string},
keywordOptimization:{detectedSkills:{technicalSkills:string[],softSkills:string[],toolsAndTechnologies:string[]},missingInDemandSkills:string[]},
clarityAndImpact:{score:number,feedback:string},
technicalStrength:{score:number,feedback:string},
enhancement:{summaryRewrite:string,bulletRewriteTemplate:string,projectDescriptionTemplate:string}

Resume:
${cleanedText.slice(0, 12000)}`,
    )
    if (!aiResult) return fallback
    return {
      ...fallback,
      ...aiResult,
      score,
      scoreBreakdown,
      formattedHtml: makeAnalysisHtml(
        score,
        ((aiResult.structuredContent as Record<string, unknown> | undefined)?.sections as SectionResult[] | undefined) ?? sections,
        [
          ...improvements,
          String((aiResult.atsCompatibility as Record<string, unknown> | undefined)?.feedback ?? ''),
          String((aiResult.clarityAndImpact as Record<string, unknown> | undefined)?.feedback ?? ''),
        ].filter(Boolean),
      ),
      pdfReady: true,
    }
  },

  async matchResumeToJob(input: MatchInput) {
    const resumeSkills = unique(Object.values(extractSkills(input.resumeText)).flat())
    const jobSkills = unique(Object.values(extractSkills(input.jobText)).flat())
    const resumeKeywords = extractKeywordSet(input.resumeText)
    const jobKeywords = extractKeywordSet(input.jobText)
    const matchedSkills = jobSkills.filter((skill) => resumeSkills.includes(skill))
    const missingSkills = jobSkills.filter((skill) => !resumeSkills.includes(skill))
    const keywordMatches = [...jobKeywords].filter((word) => resumeKeywords.has(word))
    const score = jobSkills.length
      ? clamp(Math.round((matchedSkills.length / jobSkills.length) * 70 + Math.min(keywordMatches.length, 15) * 2))
      : clamp(55 + Math.min(keywordMatches.length, 20) * 2)
    const suggestions = [
      ...missingSkills.map((skill) => `Add evidence for ${skill} if you have used it in projects or coursework.`),
      'Mirror important JD terms in your summary, skills, and project bullets where truthful.',
      'Prioritize the top missing skills before applying to this role.',
    ]

    const fallback = {
      score,
      matchedSkills,
      missingSkills,
      keywordMatches: keywordMatches.slice(0, 25),
      suggestions,
      formattedHtml: `
        <section>
          <h2>Job Description Match</h2>
          <p><strong>Match Score:</strong> ${score}%</p>
          <h3>Matched Skills</h3>${listHtml(matchedSkills.length ? matchedSkills : ['No direct skill matches detected.'])}
          <h3>Missing Skills</h3>${listHtml(missingSkills.length ? missingSkills : ['No major missing skills detected from the provided JD.'])}
          <h3>Recommendations</h3>${listHtml(suggestions)}
        </section>
      `,
    }
    const aiResult = await callOpenAiJson(
      'You are a resume-to-job matching assistant. Return only valid JSON.',
      `Compare this resume with this job description. Return JSON with keys:
score:number,
matchedSkills:string[],
missingSkills:string[],
keywordMatches:string[],
suggestions:string[]

Resume:
${input.resumeText.slice(0, 8000)}

Job Description:
${input.jobText.slice(0, 6000)}`,
    )
    if (!aiResult) return fallback
    return {
      ...fallback,
      ...aiResult,
      formattedHtml: `
        <section>
          <h2>Job Description Match</h2>
          <p><strong>Match Score:</strong> ${Number(aiResult.score ?? fallback.score)}%</p>
          <h3>Matched Skills</h3>${listHtml(((aiResult.matchedSkills as string[] | undefined) ?? matchedSkills).length ? ((aiResult.matchedSkills as string[] | undefined) ?? matchedSkills) : ['No direct skill matches detected.'])}
          <h3>Missing Skills</h3>${listHtml(((aiResult.missingSkills as string[] | undefined) ?? missingSkills).length ? ((aiResult.missingSkills as string[] | undefined) ?? missingSkills) : ['No major missing skills detected from the provided JD.'])}
          <h3>Recommendations</h3>${listHtml((aiResult.suggestions as string[] | undefined) ?? suggestions)}
        </section>
      `,
    }
  },

  async generateSkillGap(resumeText = '', jobText = '', options: SkillGapOptions = {}) {
    const resumeSkills = unique(Object.values(extractSkills(resumeText)).flat())
    const targetSkills = jobText
      ? unique(Object.values(extractSkills(jobText)).flat())
      : skillGapDefaults(options.targetRole, options.domain)
    const gaps = targetSkills
      .filter((skill) => !resumeSkills.includes(skill))
      .map((skill, index) => ({
        skill,
        category: skillDictionary.tools.includes(skill) ? 'Tools & Technologies' : 'Technical Skills',
        priority: index < 2 ? 'High' : index < 4 ? 'Medium' : 'Low',
        progress: index < 2 ? 25 : index < 4 ? 45 : 60,
        action: `Build one small project or add one verified resume bullet demonstrating ${skill}.`,
      }))

    const fallback = {
      technicalSkills: extractSkills(resumeText).technicalSkills,
      softSkills: extractSkills(resumeText).softSkills,
      toolsAndTechnologies: extractSkills(resumeText).toolsAndTechnologies,
      gaps,
      formattedHtml: `<section><h2>Skill Gap Analysis</h2>${listHtml(gaps.map((gap) => `${gap.skill}: ${gap.action}`))}</section>`,
    }
    const aiResult = await callOpenAiJson(
      'You are a skill-gap analysis assistant. Return only valid JSON.',
      `Using the resume and target role or job description, return JSON with keys:
technicalSkills:string[],
softSkills:string[],
toolsAndTechnologies:string[],
gaps:[{skill:string,category:string,priority:string,progress:number,action:string}]

Resume:
${resumeText.slice(0, 8000)}

Target:
${jobText.slice(0, 4000)}`,
    )
    if (!aiResult) return fallback
    const aiGaps = (aiResult.gaps as Array<Record<string, unknown>> | undefined) ?? gaps
    return {
      ...fallback,
      ...aiResult,
      formattedHtml: `<section><h2>Skill Gap Analysis</h2>${listHtml(aiGaps.map((gap) => `${String(gap.skill)}: ${String(gap.action)}`))}</section>`,
    }
  },

  async generateInterviewQuestions(role: string, difficulty: string, resumeText = '') {
    const resumeSkills = unique(Object.values(extractSkills(resumeText)).flat()).slice(0, 5)
    const targetRole = role || 'Selected Role'
    const fallback = {
      levels: [
        {
          level: 1,
          title: 'Aptitude & Reasoning',
          questions: [
            'Solve a percentage-based placement aptitude problem and explain your approach.',
            'Identify the pattern in a logical reasoning sequence.',
            'Summarize a short workplace paragraph in two clear sentences.',
          ],
        },
        {
          level: 2,
          title: 'Domain / Role Round',
          questions: [
            `Explain a ${difficulty || 'intermediate'} concept relevant to ${targetRole}.`,
            `Explain how you would handle a practical task related to ${resumeSkills[0] || targetRole}.`,
            `Describe one project, coursework task, internship activity, or achievement where you used ${resumeSkills.slice(0, 2).join(' and ') || 'your main role-related skills'}.`,
          ],
        },
        {
          level: 3,
          title: 'Behavioral Round',
          questions: [
            'Tell me about a time you handled a difficult deadline.',
            'Describe a situation where you received feedback and improved your work.',
            `Why are you a strong fit for ${targetRole}?`,
          ],
        },
        {
          level: 4,
          title: 'Mock Interview Simulation',
          questions: [
            'Walk me through your resume from education to your strongest project.',
            'What would you improve in your most recent project if you had one more month?',
            'Ask the interviewer one thoughtful question about the role or team.',
          ],
        },
      ],
      formattedHtml: `<section><h2>Interview Preparation Plan</h2><p>Role: ${escapeHtml(targetRole)}</p><p>Difficulty: ${escapeHtml(difficulty || 'Intermediate')}</p>${listHtml([
        'Level 1: Aptitude, logical reasoning, and verbal ability',
        'Level 2: Domain-specific concepts, practical work, and role-focused questions',
        'Level 3: Project, resume, and behavioral interview practice',
        'Level 4: Mock interview simulation with reflection prompts',
      ])}</section>`,
    }
    const aiResult = await callOpenAiJson(
      'You are an interview preparation planner for major company hiring rounds. Return only valid JSON.',
      `Create a multi-level interview preparation plan for this role. Return JSON with keys:
levels:[{level:number,title:string,focus:string,questions:string[],tips:string[]}].
Include aptitude, reasoning, verbal, project discussion, HR, mock interview rounds, and domain-specific technical or functional topics where relevant. Include coding, debugging, or core CS only when the role clearly needs them.

Role: ${targetRole}
Difficulty: ${difficulty}
Resume:
${resumeText.slice(0, 8000)}`,
    )
    if (!aiResult) return fallback
    return {
      ...fallback,
      ...aiResult,
      formattedHtml: `<section><h2>Interview Preparation Plan</h2><p>Role: ${escapeHtml(targetRole)}</p><p>Difficulty: ${escapeHtml(difficulty || 'Intermediate')}</p></section>`,
    }
  },

  async evaluateMockAnswer(answer: string, question = '') {
    const cleanAnswer = normalize(answer)
    const answerWords = words(cleanAnswer).length
    const score = clamp(Math.round(answerWords * 2.1 + (hasNumber(cleanAnswer) ? 12 : 0)), 35, 95)
    const fallback = {
      score,
      confidence: clamp(score - (answerWords < 25 ? 12 : 2), 30, 95),
      clarity: clamp(score + (cleanAnswer.length < 450 ? 4 : -4), 30, 95),
      responseQuality: score,
      technicalAccuracy: clamp(score - 6, 30, 95),
      communication: clamp(score + 3, 35, 98),
      feedback: answerWords < 30
        ? 'Answer is too short. Use situation, action, result, and include one specific example.'
        : 'Good structure. Improve by adding sharper metrics, tradeoffs, and a clearer closing sentence.',
      formattedHtml: `<section><h2>Mock Interview Feedback</h2><p><strong>Score:</strong> ${score}/100</p><p>${escapeHtml(cleanAnswer.slice(0, 300))}</p></section>`,
    }
    const aiResult = await callOpenAiJson(
      'You are an interview evaluator. Return only valid JSON.',
      `Evaluate this interview answer. Return JSON with keys:
score:number,
confidence:number,
clarity:number,
responseQuality:number,
technicalAccuracy:number,
communication:number,
feedback:string,
strengths:string[],
improvements:string[]

Question: ${question}
Answer: ${cleanAnswer.slice(0, 6000)}`,
    )
    if (!aiResult) return fallback
    return {
      ...fallback,
      ...aiResult,
      formattedHtml: `<section><h2>Mock Interview Feedback</h2><p><strong>Score:</strong> ${Number(aiResult.score ?? fallback.score)}/100</p><p>${escapeHtml(String(aiResult.feedback ?? fallback.feedback))}</p>${listHtml((aiResult.improvements as string[] | undefined) ?? [])}</section>`,
    }
  },

  async generateInterviewFollowUp(question: string, answer: string, topic = '', targetRole = '', domain = '') {
    const fallback = topic
      ? `Go one level deeper on ${topic}: explain one practical example, your decision, and the result.`
      : 'Can you support that answer with one specific example and explain the reasoning behind it?'
    const aiResult = await callOpenAiJson(
      'You are a realistic interviewer. Return only valid JSON.',
      `Generate one short, relevant follow-up interview question as JSON with key:
followUpQuestion:string

Rules:
- Stay inside the candidate's domain and role
- Do not switch into software or coding unless the question clearly needs it
- Ask a realistic interviewer-style deeper probe
- Keep it to one sentence

Domain: ${domain}
Target role: ${targetRole}
Topic: ${topic}
Original question: ${question}
Candidate answer: ${answer.slice(0, 3000)}`,
    )
    return String(aiResult?.followUpQuestion ?? fallback).trim()
  },
}
