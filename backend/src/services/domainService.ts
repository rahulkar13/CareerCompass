export type DomainKey =
  | 'it_software'
  | 'data_analytics'
  | 'commerce_finance'
  | 'mechanical'
  | 'civil'
  | 'electrical'
  | 'electronics'
  | 'marketing'
  | 'hr'
  | 'design'
  | 'healthcare'
  | 'general_fresher'

export type DomainConfidenceBand = 'high' | 'medium' | 'low'

export type DomainOption = {
  key: DomainKey
  label: string
  degreeKeywords: string[]
  specializationKeywords: string[]
  skillKeywords: string[]
  projectKeywords: string[]
  roleKeywords: string[]
  defaultRoles: string[]
}

export type DetectedDomain = {
  key: DomainKey
  label: string
  confidence: number
  band: DomainConfidenceBand
  score: number
  reasons: string[]
}

type DetectionEvidenceInput = {
  preferredRole?: string
  profile?: Record<string, unknown>
  resume?: Record<string, unknown>
  extracted?: {
    skills?: string[]
    projects?: string[]
    experience?: string[]
    certifications?: string[]
    education?: string[]
    tools?: string[]
    interests?: string[]
  }
}

const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const unique = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))]
const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []

export const domainOptions: DomainOption[] = [
  {
    key: 'it_software',
    label: 'IT / Software',
    degreeKeywords: ['btech', 'be', 'bca', 'mca', 'computer science', 'information technology', 'software engineering'],
    specializationKeywords: ['cse', 'it', 'computer', 'software', 'ai', 'cloud', 'cyber security'],
    skillKeywords: ['javascript', 'typescript', 'react', 'node', 'java', 'python', 'sql', 'mongodb', 'git', 'api'],
    projectKeywords: ['web app', 'frontend', 'backend', 'full stack', 'application', 'software'],
    roleKeywords: ['developer', 'software engineer', 'frontend', 'backend', 'full stack', 'qa tester'],
    defaultRoles: ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'QA Tester'],
  },
  {
    key: 'data_analytics',
    label: 'Data / Analytics',
    degreeKeywords: ['data science', 'statistics', 'analytics', 'bsc', 'bcom', 'bba', 'mathematics'],
    specializationKeywords: ['data', 'analytics', 'statistics', 'business analytics'],
    skillKeywords: ['excel', 'sql', 'python', 'power bi', 'powerbi', 'tableau', 'statistics', 'reporting'],
    projectKeywords: ['dashboard', 'analysis', 'dataset', 'visualization', 'forecast', 'report'],
    roleKeywords: ['data analyst', 'reporting analyst', 'bi analyst', 'analyst'],
    defaultRoles: ['Data Analyst', 'Reporting Analyst', 'Junior Analyst'],
  },
  {
    key: 'commerce_finance',
    label: 'Commerce / Finance',
    degreeKeywords: ['bcom', 'mcom', 'commerce', 'finance', 'accounting', 'bba'],
    specializationKeywords: ['finance', 'accounting', 'taxation', 'banking'],
    skillKeywords: ['accounting', 'tally', 'gst', 'taxation', 'auditing', 'banking', 'excel'],
    projectKeywords: ['ledger', 'invoice', 'tax', 'account', 'finance', 'audit'],
    roleKeywords: ['accountant', 'accounts executive', 'finance analyst', 'banking trainee', 'tax assistant'],
    defaultRoles: ['Accounts Executive', 'Finance Analyst', 'Tax Assistant'],
  },
  {
    key: 'mechanical',
    label: 'Mechanical',
    degreeKeywords: ['mechanical', 'production', 'manufacturing'],
    specializationKeywords: ['mechanical', 'machine design', 'manufacturing', 'production'],
    skillKeywords: ['autocad', 'solidworks', 'manufacturing', 'maintenance', 'quality', 'machine design'],
    projectKeywords: ['machine', 'production', 'maintenance', 'cad', 'manufacturing'],
    roleKeywords: ['production engineer', 'maintenance engineer', 'design engineer', 'quality engineer'],
    defaultRoles: ['Production Engineer', 'Design Engineer Trainee', 'Quality Engineer'],
  },
  {
    key: 'civil',
    label: 'Civil',
    degreeKeywords: ['civil'],
    specializationKeywords: ['civil', 'structural', 'construction'],
    skillKeywords: ['autocad', 'staad', 'revit', 'quantity surveying', 'estimation', 'site supervision'],
    projectKeywords: ['construction', 'site', 'structural', 'survey', 'estimation'],
    roleKeywords: ['site engineer', 'civil engineer', 'quantity surveyor', 'planning engineer'],
    defaultRoles: ['Site Engineer Trainee', 'Quantity Surveyor', 'Civil CAD Trainee'],
  },
  {
    key: 'electrical',
    label: 'Electrical',
    degreeKeywords: ['electrical'],
    specializationKeywords: ['electrical', 'power systems', 'control systems'],
    skillKeywords: ['plc', 'matlab', 'wiring', 'control panel', 'electrical maintenance', 'circuit analysis'],
    projectKeywords: ['power', 'substation', 'control', 'wiring', 'electrical'],
    roleKeywords: ['electrical engineer', 'maintenance engineer', 'electrical design trainee'],
    defaultRoles: ['Electrical Maintenance Trainee', 'Electrical Design Trainee', 'Control Panel Trainee'],
  },
  {
    key: 'electronics',
    label: 'Electronics',
    degreeKeywords: ['electronics', 'ece', 'embedded'],
    specializationKeywords: ['electronics', 'embedded', 'communication systems', 'vlsi'],
    skillKeywords: ['embedded systems', 'arduino', 'microcontroller', 'pcb', 'circuit design', 'vlsi'],
    projectKeywords: ['embedded', 'sensor', 'microcontroller', 'pcb', 'electronics'],
    roleKeywords: ['embedded trainee', 'electronics technician', 'hardware engineer'],
    defaultRoles: ['Embedded Systems Trainee', 'Electronics Technician', 'Hardware Support Engineer'],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    degreeKeywords: ['marketing', 'mba', 'bba', 'mass communication'],
    specializationKeywords: ['marketing', 'digital marketing', 'brand management'],
    skillKeywords: ['seo', 'sem', 'content writing', 'branding', 'campaign', 'social media'],
    projectKeywords: ['campaign', 'content', 'brand', 'seo', 'promotion'],
    roleKeywords: ['seo executive', 'digital marketing intern', 'content marketing assistant'],
    defaultRoles: ['Digital Marketing Intern', 'SEO Executive', 'Content Marketing Assistant'],
  },
  {
    key: 'hr',
    label: 'HR',
    degreeKeywords: ['human resources', 'mba', 'bba'],
    specializationKeywords: ['hr', 'human resource', 'talent acquisition'],
    skillKeywords: ['recruitment', 'payroll', 'onboarding', 'employee engagement', 'ms excel', 'communication'],
    projectKeywords: ['hiring', 'employee', 'recruitment', 'onboarding', 'hr'],
    roleKeywords: ['hr assistant', 'talent acquisition coordinator', 'hr intern'],
    defaultRoles: ['HR Assistant', 'Talent Acquisition Coordinator', 'HR Intern'],
  },
  {
    key: 'design',
    label: 'Design',
    degreeKeywords: ['design', 'fashion', 'fine arts', 'multimedia'],
    specializationKeywords: ['graphic design', 'ui ux', 'visual design'],
    skillKeywords: ['figma', 'photoshop', 'illustrator', 'wireframe', 'prototype', 'typography'],
    projectKeywords: ['branding', 'poster', 'wireframe', 'prototype', 'design system'],
    roleKeywords: ['graphic designer', 'ui ux designer', 'visual designer'],
    defaultRoles: ['Graphic Designer Intern', 'UI/UX Designer Trainee', 'Visual Design Assistant'],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    degreeKeywords: ['bpharm', 'nursing', 'pharmacy', 'biotech', 'medical', 'healthcare'],
    specializationKeywords: ['clinical', 'nursing', 'medical lab', 'hospital administration'],
    skillKeywords: ['patient care', 'medical coding', 'clinical documentation', 'emr', 'phlebotomy', 'healthcare operations'],
    projectKeywords: ['patient', 'clinical', 'hospital', 'medical', 'lab'],
    roleKeywords: ['medical lab assistant', 'healthcare operations trainee', 'clinical support'],
    defaultRoles: ['Medical Lab Assistant', 'Healthcare Operations Trainee', 'Clinical Support Associate'],
  },
  {
    key: 'general_fresher',
    label: 'General Fresher',
    degreeKeywords: ['graduate', 'student'],
    specializationKeywords: ['fresher', 'student'],
    skillKeywords: ['communication', 'teamwork', 'problem solving', 'excel'],
    projectKeywords: ['project', 'internship', 'college'],
    roleKeywords: ['trainee', 'intern', 'fresher'],
    defaultRoles: ['Graduate Trainee', 'Operations Trainee', 'General Fresher Role'],
  },
]

export const domainLabelMap: Record<DomainKey, string> = domainOptions.reduce((acc, option) => {
  acc[option.key] = option.label
  return acc
}, {} as Record<DomainKey, string>)

export const isDomainKey = (value: unknown): value is DomainKey =>
  typeof value === 'string' && domainOptions.some((option) => option.key === value)

export const domainLabel = (key: DomainKey): string => domainLabelMap[key]

export const defaultRolesForDomain = (key: DomainKey): string[] =>
  domainOptions.find((option) => option.key === key)?.defaultRoles ?? domainOptions[domainOptions.length - 1].defaultRoles

const countMatches = (text: string, keywords: string[]): { count: number; matched: string[] } => {
  const matched = unique(keywords.filter((keyword) => text.includes(normalize(keyword))))
  return { count: matched.length, matched }
}

const confidenceBand = (score: number, gap: number): DomainConfidenceBand => {
  if (score >= 28 && gap >= 6) return 'high'
  if (score >= 16 && gap >= 3) return 'medium'
  return 'low'
}

export const detectLikelyDomains = (input: DetectionEvidenceInput): DetectedDomain[] => {
  const profile = input.profile ?? {}
  const resume = input.resume ?? {}
  const extracted = input.extracted ?? {}
  const evidenceText = normalize([
    input.preferredRole ?? '',
    String(profile.preferredJobRole ?? ''),
    String(profile.preferredIndustry ?? ''),
    String(profile.degree ?? ''),
    String(profile.branch ?? ''),
    String(profile.education ?? ''),
    String(profile.summary ?? ''),
    String(profile.professionalHeadline ?? ''),
    String(profile.internshipExperience ?? ''),
    String(profile.workExperience ?? ''),
    String(profile.experience ?? ''),
    ...toStringArray(profile.skills),
    ...toStringArray(profile.technicalSkills),
    ...toStringArray(profile.softSkills),
    ...toStringArray(profile.certifications),
    ...toStringArray(profile.projects),
    ...toStringArray(profile.areasOfInterest),
    String(resume.extractedText ?? ''),
    ...toStringArray(resume.extractedSkills),
    ...toStringArray(resume.extractedProjects),
    ...toStringArray(resume.extractedExperience),
    ...toStringArray(resume.extractedEducation),
    ...toStringArray(resume.extractedCertifications),
    ...(extracted.skills ?? []),
    ...(extracted.projects ?? []),
    ...(extracted.experience ?? []),
    ...(extracted.certifications ?? []),
    ...(extracted.education ?? []),
    ...(extracted.tools ?? []),
    ...(extracted.interests ?? []),
  ].join(' '))

  const raw = domainOptions.map((option) => {
    const degree = countMatches(evidenceText, option.degreeKeywords)
    const specialization = countMatches(evidenceText, option.specializationKeywords)
    const skills = countMatches(evidenceText, option.skillKeywords)
    const projects = countMatches(evidenceText, option.projectKeywords)
    const roles = countMatches(evidenceText, option.roleKeywords)
    const score =
      degree.count * 10
      + specialization.count * 9
      + skills.count * 7
      + projects.count * 5
      + roles.count * 6
    const reasons = unique([
      degree.matched[0] ? `education includes ${degree.matched.slice(0, 2).join(' and ')}` : '',
      specialization.matched[0] ? `specialization points to ${specialization.matched.slice(0, 2).join(' and ')}` : '',
      skills.matched[0] ? `skills include ${skills.matched.slice(0, 3).join(', ')}` : '',
      projects.matched[0] ? `projects or experience mention ${projects.matched.slice(0, 2).join(' and ')}` : '',
      roles.matched[0] ? `preferred roles align with ${roles.matched.slice(0, 2).join(' and ')}` : '',
    ].filter(Boolean))
    return { option, score, reasons }
  }).sort((a, b) => b.score - a.score)

  const topScore = raw[0]?.score ?? 0
  const secondScore = raw[1]?.score ?? 0

  return raw.slice(0, 3).map(({ option, score, reasons }) => {
    const band = confidenceBand(score, score - secondScore)
    const confidence = option.key === 'general_fresher'
      ? Math.max(35, Math.min(75, 40 + score))
      : Math.max(20, Math.min(96, score >= 1 ? 32 + score + (band === 'high' ? 8 : band === 'medium' ? 2 : -4) : 18))
    return {
      key: option.key,
      label: option.label,
      confidence,
      band,
      score,
      reasons: reasons.length ? reasons : ['profile and resume evidence is still limited'],
    }
  })
}

export const selectRecommendedDomain = (detectedDomains: DetectedDomain[]): DetectedDomain => {
  const top = detectedDomains[0]
  if (!top) {
    return {
      key: 'general_fresher',
      label: domainLabel('general_fresher'),
      confidence: 35,
      band: 'low',
      score: 0,
      reasons: ['profile and resume evidence is still limited'],
    }
  }
  if (top.key !== 'general_fresher' && (top.band === 'high' || top.confidence >= 65)) {
    return top
  }
  return {
    key: 'general_fresher',
    label: domainLabel('general_fresher'),
    confidence: Math.max(40, Math.min(78, top.confidence)),
    band: 'low',
    score: top.score,
    reasons: ['signals are mixed, so broad fresher support is safer until you confirm your field'],
  }
}

