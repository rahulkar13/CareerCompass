import type { Request, Response } from 'express'
import { InterviewQuestion, JobApplication, MockInterview, Profile, RecruiterAssessmentAssignment, RecruiterInterviewQuestion, Report, Resume, SavedJobDescription, SkillGapReport } from '../models/CoreModels'
import { defaultRolesForDomain, domainLabel, isDomainKey, type DomainKey } from '../services/domainService'
import { aiService } from '../services/aiService'
import { interviewQuestionBankService } from '../services/interviewQuestionBankService'
import { reminderService } from '../services/reminderService'

type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type PrepQuestion = {
  id: string
  questionText: string
  category: string
  domain: string
  topic: string
  role: string
  difficulty: Difficulty
  companyType: string
  experienceLevel: string
  answerHint: string
  keyPoints: string[]
  commonMistakes: string[]
  tags: string[]
  whyRecommended: string
  answerStructure: {
    directAnswer: string
    explanation: string
    example: string
    projectLink: string
    impact: string
  }
  source: string
  priority: number
}

const questionBank: PrepQuestion[] = [
  {
    id: 'hr-intro',
    questionText: 'Tell me about yourself.',
    category: 'HR',
    domain: 'all',
    topic: 'self introduction',
    role: 'all',
    difficulty: 'Beginner',
    companyType: 'campus placement',
    experienceLevel: 'student',
    answerHint: 'Use a 60-90 second structure: education, strongest skills, one project proof, target role, and why you fit.',
    keyPoints: ['Current education or role', '2-3 relevant skills', 'best project or internship proof', 'role interest'],
    commonMistakes: ['Repeating the full resume', 'Starting with personal family details', 'Speaking without a clear ending'],
    tags: ['hr', 'intro', 'confidence'],
    whyRecommended: 'Almost every interview starts here, and a clear opening makes the rest of the interview easier.',
    answerStructure: {
      directAnswer: 'Start with who you are and the role you are preparing for.',
      explanation: 'Connect your skills and learning journey to the target role.',
      example: 'Mention one project, internship, or achievement that proves your readiness.',
      projectLink: 'Link the answer to your strongest resume project.',
      impact: 'Close by saying what value you want to bring to the company.',
    },
    source: 'question bank',
    priority: 82,
  },
  {
    id: 'hr-strength',
    questionText: 'What are your strengths and how have you used them in a project?',
    category: 'HR',
    domain: 'all',
    topic: 'strengths',
    role: 'all',
    difficulty: 'Beginner',
    companyType: 'campus placement',
    experienceLevel: 'student',
    answerHint: 'Pick one real strength and prove it with a project or teamwork example.',
    keyPoints: ['One specific strength', 'Situation where it helped', 'Outcome or learning'],
    commonMistakes: ['Listing too many strengths', 'Using generic words without proof'],
    tags: ['hr', 'behavioral'],
    whyRecommended: 'Recruiters check whether you can explain your value with evidence.',
    answerStructure: {
      directAnswer: 'Name the strength directly.',
      explanation: 'Explain how that strength affects your work.',
      example: 'Give one short project or team example.',
      projectLink: 'Mention where this appears in your resume.',
      impact: 'End with how it helps you perform in the target role.',
    },
    source: 'question bank',
    priority: 70,
  },
  {
    id: 'oops',
    questionText: 'Explain OOPs concepts with a practical example.',
    category: 'Core CS',
    domain: 'it_software',
    topic: 'OOPs',
    role: 'software developer',
    difficulty: 'Beginner',
    companyType: 'service company',
    experienceLevel: 'student',
    answerHint: 'Define encapsulation, inheritance, polymorphism, and abstraction, then connect them to a small code or project example.',
    keyPoints: ['Encapsulation', 'Inheritance', 'Polymorphism', 'Abstraction', 'real example'],
    commonMistakes: ['Only naming concepts', 'Confusing abstraction with encapsulation'],
    tags: ['core cs', 'oops', 'java', 'python'],
    whyRecommended: 'OOPs is a common campus and service-company screening topic.',
    answerStructure: {
      directAnswer: 'OOPs organizes code around objects and classes.',
      explanation: 'Explain the four pillars in simple language.',
      example: 'Use a User, Order, or Student class example.',
      projectLink: 'Mention where your project used models, components, or classes.',
      impact: 'Close with maintainability and reuse.',
    },
    source: 'question bank',
    priority: 68,
  },
  {
    id: 'sql-nosql',
    questionText: 'What is the difference between SQL and NoSQL databases?',
    category: 'Core CS',
    domain: 'it_software',
    topic: 'DBMS',
    role: 'software developer',
    difficulty: 'Intermediate',
    companyType: 'service company',
    experienceLevel: 'student',
    answerHint: 'Compare schema, relationships, scaling, transactions, and when you would choose each.',
    keyPoints: ['schema', 'relations', 'transactions', 'horizontal scaling', 'use cases'],
    commonMistakes: ['Saying NoSQL has no structure', 'Claiming one is always better'],
    tags: ['dbms', 'sql', 'mongodb'],
    whyRecommended: 'Database tradeoffs are common in backend, full-stack, and project discussions.',
    answerStructure: {
      directAnswer: 'SQL is relational and schema-driven; NoSQL is flexible and document/key-value oriented.',
      explanation: 'Compare consistency, joins, and scaling.',
      example: 'Use banking for SQL and event/log/product catalog for NoSQL.',
      projectLink: 'Relate it to the database used in your resume project.',
      impact: 'Close with choosing based on data shape and consistency needs.',
    },
    source: 'question bank',
    priority: 72,
  },
  {
    id: 'rest-api',
    questionText: 'Explain REST API and the HTTP methods you used in your project.',
    category: 'Role-based Technical',
    domain: 'it_software',
    topic: 'REST API',
    role: 'backend',
    difficulty: 'Intermediate',
    companyType: 'product company',
    experienceLevel: 'student',
    answerHint: 'Explain resources, endpoints, methods, status codes, validation, and auth.',
    keyPoints: ['resources', 'GET POST PUT DELETE', 'status codes', 'validation', 'authentication'],
    commonMistakes: ['Only listing methods', 'Ignoring status codes and error handling'],
    tags: ['backend', 'rest', 'api', 'nodejs', 'express'],
    whyRecommended: 'REST API knowledge is central for backend and full-stack roles.',
    answerStructure: {
      directAnswer: 'REST is a resource-based API style using HTTP methods.',
      explanation: 'Explain endpoints, payloads, and status codes.',
      example: 'Describe a login, user, or product endpoint.',
      projectLink: 'Connect it to an API from your resume project.',
      impact: 'Close with maintainable integration between frontend and backend.',
    },
    source: 'question bank',
    priority: 80,
  },
  {
    id: 'react-state',
    questionText: 'What is state management in React and when would you use it?',
    category: 'Skill-based',
    domain: 'it_software',
    topic: 'React',
    role: 'frontend',
    difficulty: 'Intermediate',
    companyType: 'startup',
    experienceLevel: 'student',
    answerHint: 'Start with local state, then props, context, and external stores for shared or complex state.',
    keyPoints: ['local state', 'props', 'context', 'server state', 'Redux or Zustand'],
    commonMistakes: ['Using Redux for every small state', 'Not separating server state from UI state'],
    tags: ['frontend', 'react', 'state'],
    whyRecommended: 'React interviewers often test whether you understand data flow, not just syntax.',
    answerStructure: {
      directAnswer: 'State management controls how data changes and flows through UI components.',
      explanation: 'Explain local versus shared state.',
      example: 'Use auth user, cart, filters, or form state.',
      projectLink: 'Mention how your project handled shared state.',
      impact: 'Close with predictable UI and easier debugging.',
    },
    source: 'question bank',
    priority: 84,
  },
  {
    id: 'jwt-auth',
    questionText: 'What is JWT authentication and how do you secure it?',
    category: 'Skill-based',
    domain: 'it_software',
    topic: 'JWT',
    role: 'backend',
    difficulty: 'Intermediate',
    companyType: 'product company',
    experienceLevel: 'student',
    answerHint: 'Explain token creation, verification, expiry, refresh flow, storage risks, and HTTPS.',
    keyPoints: ['signed token', 'claims', 'expiry', 'refresh token', 'httpOnly cookies', 'HTTPS'],
    commonMistakes: ['Storing sensitive data in JWT', 'Using tokens without expiry', 'Ignoring token theft'],
    tags: ['backend', 'jwt', 'auth', 'security'],
    whyRecommended: 'Authentication appears often in real web apps and backend interviews.',
    answerStructure: {
      directAnswer: 'JWT is a signed token used to verify user identity without server-side sessions.',
      explanation: 'Explain payload, signature, expiry, and verification.',
      example: 'Use login and protected route flow.',
      projectLink: 'Connect it to authentication in your project if present.',
      impact: 'Close with security practices that reduce account risk.',
    },
    source: 'question bank',
    priority: 86,
  },
  {
    id: 'product-depth',
    questionText: 'How would you improve the performance and reliability of a feature you built?',
    category: 'Company-style',
    domain: 'it_software',
    topic: 'product company depth',
    role: 'software developer',
    difficulty: 'Advanced',
    companyType: 'product company',
    experienceLevel: 'student',
    answerHint: 'Discuss measurement, bottlenecks, caching, database queries, testing, monitoring, and tradeoffs.',
    keyPoints: ['measure first', 'bottleneck', 'caching', 'query optimization', 'testing', 'monitoring'],
    commonMistakes: ['Jumping to tools before explaining the problem', 'Ignoring tradeoffs'],
    tags: ['system thinking', 'performance', 'product company'],
    whyRecommended: 'Product-style interviews expect depth, tradeoffs, and practical ownership.',
    answerStructure: {
      directAnswer: 'I would measure the issue first, then improve the highest-impact bottleneck.',
      explanation: 'Describe frontend, backend, database, and reliability angles.',
      example: 'Use a slow dashboard, API, or search flow.',
      projectLink: 'Tie it to a feature from your project.',
      impact: 'Close with user experience and maintainability improvements.',
    },
    source: 'question bank',
    priority: 76,
  },
  {
    id: 'data-dashboard',
    questionText: 'Explain one dashboard or reporting project and the business insight it produced.',
    category: 'Resume/Project-based',
    domain: 'data_analytics',
    topic: 'dashboard reporting',
    role: 'data analyst',
    difficulty: 'Beginner',
    companyType: 'campus placement',
    experienceLevel: 'student',
    answerHint: 'Explain data source, metrics tracked, tool used, and what decision the dashboard supports.',
    keyPoints: ['data source', 'tool', 'metrics', 'insight', 'business impact'],
    commonMistakes: ['Only naming the tool', 'Not explaining the insight', 'Ignoring business use'],
    tags: ['data', 'dashboard', 'analytics'],
    whyRecommended: 'Analyst interviews often test whether you can turn data work into business meaning.',
    answerStructure: {
      directAnswer: 'Start with the business or reporting problem you were solving.',
      explanation: 'Explain the dataset, cleaning steps, metrics, and tool used.',
      example: 'Use one dashboard, report, or analysis project from your resume.',
      projectLink: 'Link to your strongest reporting or analytics project.',
      impact: 'Close with the business insight or action enabled by the report.',
    },
    source: 'question bank',
    priority: 78,
  },
  {
    id: 'finance-gst',
    questionText: 'What is GST and where have you seen it used in practical accounting work?',
    category: 'Core Domain',
    domain: 'commerce_finance',
    topic: 'GST',
    role: 'accounts executive',
    difficulty: 'Beginner',
    companyType: 'campus placement',
    experienceLevel: 'student',
    answerHint: 'Define GST, explain input/output tax idea, and connect it to invoicing or accounts work.',
    keyPoints: ['GST meaning', 'input tax', 'output tax', 'invoice', 'practical use'],
    commonMistakes: ['Giving a textbook definition only', 'Skipping practical use in accounts work'],
    tags: ['finance', 'gst', 'accounting'],
    whyRecommended: 'Commerce and finance interviews often test whether basic tax concepts are practical for you, not just memorized.',
    answerStructure: {
      directAnswer: 'Define GST simply and correctly.',
      explanation: 'Explain how it appears in business transactions and records.',
      example: 'Use invoicing, purchase, or accounting entry context.',
      projectLink: 'Connect it to an internship, finance task, or academic accounting work.',
      impact: 'Close with why correct GST handling matters in finance operations.',
    },
    source: 'question bank',
    priority: 77,
  },
  {
    id: 'mechanical-maintenance',
    questionText: 'What is preventive maintenance and why is it important in mechanical operations?',
    category: 'Core Domain',
    domain: 'mechanical',
    topic: 'preventive maintenance',
    role: 'maintenance engineer',
    difficulty: 'Beginner',
    companyType: 'plant operations',
    experienceLevel: 'student',
    answerHint: 'Define preventive maintenance, compare it with reactive maintenance, and explain operational value.',
    keyPoints: ['definition', 'planned maintenance', 'downtime reduction', 'reliability', 'safety'],
    commonMistakes: ['Confusing preventive and corrective maintenance', 'Not linking to equipment reliability'],
    tags: ['mechanical', 'maintenance', 'operations'],
    whyRecommended: 'Mechanical roles often test whether you understand basic plant reliability concepts.',
    answerStructure: {
      directAnswer: 'Define preventive maintenance as planned action before failure happens.',
      explanation: 'Explain its effect on uptime, cost, and safety.',
      example: 'Use one machine, workshop, or plant example.',
      projectLink: 'Connect it to your lab, internship, or maintenance-related project if available.',
      impact: 'Close with why it improves productivity and equipment life.',
    },
    source: 'question bank',
    priority: 76,
  },
  {
    id: 'marketing-seo',
    questionText: 'What is SEO and how would you improve campaign reach using it?',
    category: 'Core Domain',
    domain: 'marketing',
    topic: 'SEO',
    role: 'digital marketing intern',
    difficulty: 'Beginner',
    companyType: 'startup',
    experienceLevel: 'student',
    answerHint: 'Define SEO, mention on-page basics, and explain how it supports visibility and traffic.',
    keyPoints: ['search visibility', 'keywords', 'content', 'technical basics', 'traffic'],
    commonMistakes: ['Mixing SEO with paid ads', 'Not connecting it to reach or visibility'],
    tags: ['marketing', 'seo', 'digital marketing'],
    whyRecommended: 'Marketing interviews often ask whether you understand how organic reach is improved in practice.',
    answerStructure: {
      directAnswer: 'Define SEO as improving search visibility for relevant audiences.',
      explanation: 'Mention keywords, content quality, structure, and basic performance checks.',
      example: 'Use a blog, campaign page, or brand page example.',
      projectLink: 'Connect it to your campaign, content, or internship work.',
      impact: 'Close with how better reach supports leads, traffic, or awareness.',
    },
    source: 'question bank',
    priority: 76,
  },
]

const normalize = (value: unknown): string => String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
const unique = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))]
const toStringArray = (value: unknown): string[] => Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const inferCompanyType = (value: unknown): string => {
  const text = normalize(value)
  if (/startup|founding|0-1|fast paced/.test(text)) return 'startup'
  if (/product|saas|platform|scale/.test(text)) return 'product company'
  if (/campus|fresher|graduate|trainee/.test(text)) return 'campus placement'
  return 'service company'
}

const inferExperienceLevel = (text: string): string => {
  const lower = normalize(text)
  if (/senior|lead|5\+|6\+|7\+/.test(lower)) return 'experienced'
  if (/intern|fresher|student|0-1|entry/.test(lower)) return 'student'
  return 'junior'
}

const roleFamily = (role: string): string => {
  const lower = normalize(role)
  if (/front|react|ui/.test(lower)) return 'frontend'
  if (/back|node|api|server/.test(lower)) return 'backend'
  if (/full/.test(lower)) return 'full stack'
  if (/data|analyst/.test(lower)) return 'data analyst'
  if (/finance|account|bank|tax/.test(lower)) return 'finance'
  if (/mechanical|production|maintenance|design engineer/.test(lower)) return 'mechanical'
  if (/marketing|seo|content|campaign|brand/.test(lower)) return 'marketing'
  return 'software developer'
}

const extractKnownSkills = (text: string): string[] => {
  const lower = normalize(text)
  const skills = [
    'javascript', 'typescript', 'html', 'css', 'react', 'nodejs', 'express', 'mongodb', 'sql', 'mysql', 'python', 'java', 'jwt', 'rest api', 'git', 'docker', 'aws', 'dsa', 'oops',
    'excel', 'power bi', 'tableau', 'statistics', 'gst', 'taxation', 'accounting', 'auditing', 'tally', 'banking',
    'autocad', 'solidworks', 'machine design', 'manufacturing', 'maintenance', 'quality',
    'seo', 'sem', 'content writing', 'branding', 'campaign',
  ]
  return skills.filter((skill) => lower.includes(skill.replace('nodejs', 'node')))
}

const inferDomainFromRecommendation = (payload: Record<string, unknown>, role: string, text: string): string => {
  const detectedDomainPayload = (payload.detectedDomain as Record<string, unknown> | undefined) ?? {}
  const confirmed = String(payload.confirmedDomain ?? payload.activeDomain ?? detectedDomainPayload.key ?? '').trim()
  if (isDomainKey(confirmed)) return confirmed
  const detected = String(detectedDomainPayload.key ?? '').trim()
  if (detected) return detected
  const lower = normalize(`${role} ${text}`)
  if (/react|node|java|python|api|software|frontend|backend/.test(lower)) return 'it_software'
  if (/excel|tableau|power bi|analytics|reporting|data/.test(lower)) return 'data_analytics'
  if (/gst|account|finance|tally|audit|banking/.test(lower)) return 'commerce_finance'
  if (/autocad|solidworks|mechanical|maintenance|production/.test(lower)) return 'mechanical'
  if (/civil|construction|site engineer|quantity survey/.test(lower)) return 'civil'
  if (/electrical|plc|wiring|control panel/.test(lower)) return 'electrical'
  if (/embedded|arduino|microcontroller|pcb|electronics/.test(lower)) return 'electronics'
  if (/seo|marketing|campaign|branding|content/.test(lower)) return 'marketing'
  if (/recruitment|talent acquisition|onboarding|human resource|\bhr\b/.test(lower)) return 'hr'
  if (/figma|photoshop|illustrator|wireframe|prototype|design/.test(lower)) return 'design'
  if (/patient|clinical|medical|healthcare|hospital/.test(lower)) return 'healthcare'
  return 'general_fresher'
}

const defaultRoleForDomain = (domain: string): string => {
  return defaultRolesForDomain((isDomainKey(domain) ? domain : 'general_fresher') as DomainKey)[0] ?? 'Graduate Trainee'
}

const answerStructureFor = (question: string, topic: string, project = '', category = '') => {
  const lowerCategory = normalize(category)
  const lowerQuestion = normalize(question)
  const projectText = project ? ` from ${project}` : ''

  if (lowerCategory.includes('resume') || lowerCategory.includes('project') || lowerQuestion.includes('project')) {
    return {
      directAnswer: 'Start with the problem your project solved and who it was for.',
      explanation: 'Describe the architecture, main modules, and the exact part you personally built.',
      example: `Walk through one feature or challenge${projectText} with the technology decisions you made.`,
      projectLink: project ? `Use ${project} as the proof, not a separate generic example.` : 'Use your strongest resume project as the proof.',
      impact: 'Close with the result, learning, improvement, or what you would build next.',
    }
  }

  if (lowerCategory.includes('weak')) {
    return {
      directAnswer: `Give a simple definition of ${topic}, then admit the practical use case you are strengthening.`,
      explanation: 'Explain the core idea with one diagram-like flow in words: input, process, output, and tradeoff.',
      example: `Show where ${topic} would fit in a real app${projectText}, even if you have not used it deeply yet.`,
      projectLink: project ? `Say how you could add or improve ${topic} in ${project}.` : 'Connect it to a feature you could add to a resume project.',
      impact: 'Close by saying how learning it improves security, speed, maintainability, or interview readiness.',
    }
  }

  if (lowerCategory.includes('job')) {
    return {
      directAnswer: `Start by linking ${topic} directly to the job responsibility.`,
      explanation: 'Explain what level of hands-on work you have done and what you are currently improving.',
      example: `Use a concrete task${projectText}: endpoint, component, database query, deployment, or debugging case.`,
      projectLink: project ? `Map the job requirement back to ${project}.` : 'Map the job requirement back to your resume or profile.',
      impact: 'Close with why this makes you useful for the target role from day one.',
    }
  }

  if (lowerCategory.includes('role')) {
    return {
      directAnswer: `Name 3-4 responsibilities of the ${topic} role that you can handle now.`,
      explanation: 'For each responsibility, connect one skill, tool, or project proof from your resume.',
      example: `Give one realistic work scenario${projectText}, such as building a feature, fixing a bug, or collaborating with a team.`,
      projectLink: project ? `Use ${project} to prove role readiness.` : 'Use one project or internship task to prove role readiness.',
      impact: 'Close with how you will contribute, learn quickly, and communicate clearly.',
    }
  }

  if (lowerCategory.includes('hr')) {
    return {
      directAnswer: 'Answer honestly in one clear sentence before giving background.',
      explanation: 'Use a short situation-action-result story instead of a memorized paragraph.',
      example: 'Pick a college, project, internship, teamwork, or learning moment that shows maturity.',
      projectLink: 'Where possible, connect the answer to your project work or preparation effort.',
      impact: 'Close with confidence: what you learned and how it helps you in the role.',
    }
  }

  if (lowerCategory.includes('revision')) {
    return {
      directAnswer: 'List the few topics you will revise first, starting from the highest-risk area.',
      explanation: 'Explain why each topic matters for this role or company pattern.',
      example: 'Use a 30-minute checklist: intro, project story, weak concepts, job skills, and questions for interviewer.',
      projectLink: 'Keep one project story ready for technical and HR rounds.',
      impact: 'Close by reducing panic: focus on recall, clarity, and examples.',
    }
  }

  return {
    directAnswer: `Answer ${topic || 'the topic'} with the main idea first, not a long introduction.`,
    explanation: 'Explain how it works, when to use it, and one limitation or tradeoff.',
    example: `Give a practical example${projectText || ' from a project, API, UI flow, or database design'}.`,
    projectLink: project ? `Connect the example to ${project}.` : 'Connect the example to one resume project or internship task.',
    impact: 'Close with the result: reliability, better UX, security, speed, teamwork, or maintainability.',
  }
}

const makeQuestion = (input: Partial<PrepQuestion> & Pick<PrepQuestion, 'questionText' | 'category' | 'topic'>): PrepQuestion => ({
  id: input.id ?? `${normalize(input.category)}-${normalize(input.topic)}-${normalize(input.questionText).slice(0, 40)}`.replace(/[^a-z0-9]+/g, '-'),
  questionText: input.questionText,
  category: input.category,
  domain: input.domain ?? 'all',
  topic: input.topic,
  role: input.role ?? 'all',
  difficulty: input.difficulty ?? 'Intermediate',
  companyType: input.companyType ?? 'campus placement',
  experienceLevel: input.experienceLevel ?? 'student',
  answerHint: input.answerHint ?? `Answer this as a ${input.category.toLowerCase()} question: start directly, add one practical example, connect it to your work, and close with impact.`,
  keyPoints: input.keyPoints ?? [input.topic, 'definition', 'example', 'tradeoff', 'impact'],
  commonMistakes: input.commonMistakes ?? ['Giving only a definition', 'Not connecting to your project', 'Missing the result or impact'],
  tags: input.tags ?? [input.category, input.topic].map(normalize),
  whyRecommended: input.whyRecommended ?? `${input.topic} is relevant to your target role and interview preparation.`,
  answerStructure: input.answerStructure ?? answerStructureFor(input.questionText, input.topic, '', input.category),
  source: input.source ?? 'generated',
  priority: input.priority ?? 60,
})

const rankAndDedupe = (questions: PrepQuestion[]): PrepQuestion[] => {
  const seen = new Set<string>()
  return questions
    .sort((a, b) => b.priority - a.priority)
    .filter((question) => {
      const key = normalize(question.questionText)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 36)
}

const ensureQuestionBank = async () => {
  const bankQuestions = await interviewQuestionBankService.loadAll()
  const bankIds = bankQuestions.map((question) => question.id)
  await Promise.all(bankQuestions.map((question) => InterviewQuestion.updateOne(
    { bankId: question.id, userId: null },
    {
      $set: {
        bankId: question.id,
        userId: null,
        field: question.field,
        domain: question.field,
        category: question.category,
        role: question.role,
        skill: question.topic,
        difficulty: question.difficulty,
        topic: question.topic,
        companyType: question.companyType,
        experienceLevel: question.experienceLevel,
        questionText: question.questionText,
        questions: [question.questionText],
        answerHint: question.answerHint,
        keyPoints: question.keyPoints,
        commonMistakes: question.commonMistakes,
        tags: question.tags,
      },
    },
    { upsert: true },
  )))
  await InterviewQuestion.deleteMany({ userId: null, bankId: { $nin: bankIds } })
}

const fromBankDoc = (doc: Record<string, unknown>, role: string): PrepQuestion => makeQuestion({
  id: String(doc.bankId ?? doc._id ?? ''),
  questionText: String(doc.questionText ?? ''),
  category: String(doc.category ?? 'Technical'),
  domain: String(doc.field ?? doc.domain ?? 'all'),
  topic: String(doc.topic ?? doc.skill ?? ''),
  role: String(doc.role ?? role),
  difficulty: String(doc.difficulty ?? 'Intermediate') as Difficulty,
  companyType: String(doc.companyType ?? 'campus placement'),
  experienceLevel: String(doc.experienceLevel ?? 'fresher'),
  answerHint: String(doc.answerHint ?? ''),
  keyPoints: toStringArray(doc.keyPoints),
  commonMistakes: toStringArray(doc.commonMistakes),
  tags: toStringArray(doc.tags),
  whyRecommended: String(doc.whyRecommended ?? `This comes from the reliable question bank and matches your ${role} preparation context.`),
  source: 'question bank',
  priority: Number(doc.priority ?? 62),
})

export const generateQuestions = async (req: Request, res: Response): Promise<void> => {
  const { role, difficulty, resumeId, resumeText: bodyResumeText, jobDescriptionText = '', companyType = '' } = req.body
  const userId = String(req.user?.userId ?? '')
  const resume = resumeId
    ? await Resume.findOne({ _id: resumeId, userId }).lean<Record<string, unknown>>()
    : await Resume.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const profile = await Profile.findOne({ userId }).lean<Record<string, unknown>>()
  const latestGap = await SkillGapReport.findOne({ userId, ...(resume?._id ? { resumeId: resume._id } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const latestRecommendation = await Report.findOne({ userId, reportType: 'Smart Recommendation', ...(resume?._id ? { relatedId: String(resume._id) } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const latestJob = await SavedJobDescription.findOne({ userId, ...(resume?._id ? { resumeId: String(resume._id) } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const recommendationPayload = (latestRecommendation?.payload ?? {}) as Record<string, unknown>

  const selectedDifficulty = (String(difficulty ?? 'Intermediate') as Difficulty) || 'Intermediate'
  const effectiveJobText = String(jobDescriptionText || latestJob?.jobDescriptionText || '').trim()
  const resumeText = String(bodyResumeText ?? resume?.extractedText ?? '').trim()
  const inferredDomain = inferDomainFromRecommendation(
    { ...recommendationPayload, confirmedDomain: profile?.confirmedDomain ?? recommendationPayload.confirmedDomain },
    String(role ?? recommendationPayload.targetRole ?? profile?.preferredJobRole ?? ''),
    `${resumeText} ${effectiveJobText} ${profile?.summary ?? ''}`,
  )
  const targetRole = String(role ?? recommendationPayload.targetRole ?? profile?.preferredJobRole ?? defaultRoleForDomain(inferredDomain)).trim() || defaultRoleForDomain(inferredDomain)
  const detectedDomain = inferredDomain
  const roleKind = roleFamily(targetRole)
  const extractedSkills = unique([
    ...toStringArray(profile?.skills),
    ...toStringArray(profile?.technicalSkills),
    ...toStringArray(resume?.extractedSkills),
    ...extractKnownSkills(resumeText),
  ])
  const profileProjects = unique([...toStringArray(profile?.projects), ...toStringArray(resume?.extractedProjects)]).slice(0, 4)
  const gapContent = ((latestGap?.content ?? latestRecommendation?.payload ?? {}) as Record<string, unknown>)
  const skillGapAnalysis = ((gapContent.skillGapAnalysis ?? {}) as Record<string, unknown>)
  const weakSkills = unique([
    ...toStringArray(skillGapAnalysis.missingRequiredSkills),
    ...toStringArray(skillGapAnalysis.weakRequiredSkills),
    ...toStringArray((latestGap as Record<string, unknown> | null)?.missingSkills),
    ...toStringArray((gapContent.gaps as Array<Record<string, unknown>> | undefined)?.map((gap) => String(gap.skill ?? ''))),
  ]).slice(0, 8)
  const jobSkills = unique([
    ...toStringArray((gapContent.parsedJobDescription as Record<string, unknown> | undefined)?.requiredSkills),
    ...extractKnownSkills(effectiveJobText),
  ]).slice(0, 10)
  const selectedCompanyType = String(companyType || inferCompanyType(`${effectiveJobText} ${targetRole}`))
  const experienceLevel = inferExperienceLevel(`${resumeText} ${effectiveJobText} ${profile?.experience ?? ''}`)

  await ensureQuestionBank()
  const bankDocs = await InterviewQuestion.find({
    userId: null,
    $or: [
      { field: { $in: ['all', detectedDomain] } },
      { domain: { $in: ['all', detectedDomain] } },
    ],
  }).lean<Array<Record<string, unknown>>>()

  const bankQuestions = bankDocs
    .map((doc) => fromBankDoc(doc, targetRole))
    .map((question) => {
      const topic = normalize(question.topic)
      const companyBoost = [selectedCompanyType, 'general', 'campus placement'].includes(question.companyType) ? 8 : 0
      const roleBoost = ['all', roleKind, targetRole.toLowerCase()].includes(normalize(question.role)) ? 10 : 0
      const topicBoost = [...weakSkills, ...jobSkills, ...extractedSkills].some((item) => normalize(item) === topic) ? 12 : 0
      return { ...question, priority: question.priority + companyBoost + roleBoost + topicBoost }
    })
  const resumeQuestions = profileProjects.flatMap((project, index) => [
    makeQuestion({
      questionText: `Explain your project "${project}" as if the interviewer has not seen your resume.`,
      category: 'Resume/Project-based',
      domain: detectedDomain,
      topic: 'project explanation',
      role: targetRole,
      difficulty: selectedDifficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'Interviewers usually ask from your own projects first because that is the easiest place to verify real experience.',
      answerHint: 'Use problem, users, tech stack, your contribution, challenge, and result.',
      keyPoints: ['problem solved', 'tech stack', 'your contribution', 'challenge', 'result'],
      commonMistakes: ['Only naming technologies', 'Not explaining your own contribution', 'No measurable result'],
      answerStructure: answerStructureFor(`Explain your project ${project}`, 'project explanation', project, 'Resume/Project-based'),
      source: 'resume',
      priority: 96 - index,
      tags: ['resume', 'project', targetRole],
    }),
    makeQuestion({
      questionText: `What was the toughest technical challenge in "${project}" and how did you solve it?`,
      category: 'Resume/Project-based',
      domain: detectedDomain,
      topic: 'project challenge',
      role: targetRole,
      difficulty: 'Intermediate',
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'This checks whether you truly built or understood the project, not just listed it.',
      answerHint: 'Pick one real issue, explain debugging steps, decision, and final improvement.',
      keyPoints: ['challenge', 'root cause', 'options considered', 'solution', 'learning'],
      commonMistakes: ['Saying there were no challenges', 'Blaming teammates', 'Skipping the debugging process'],
      answerStructure: answerStructureFor(`Technical challenge in ${project}`, 'project challenge', project, 'Resume/Project-based'),
      source: 'resume',
      priority: 92 - index,
      tags: ['resume', 'project', 'problem solving'],
    }),
  ])

  const skillQuestions = weakSkills.flatMap((skill, index) => [
    makeQuestion({
      questionText: `Explain ${skill} in simple terms and describe where you would use it.`,
      category: 'Weak-skill-based',
      domain: detectedDomain,
      topic: skill,
      role: targetRole,
      difficulty: selectedDifficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: `${skill} is currently weak or missing, so practicing it first improves interview readiness quickly.`,
      answerHint: `Keep it honest and practical: define ${skill}, explain one use case, then show how you would apply it in your project work.`,
      keyPoints: [skill, 'definition', 'use case', 'project example', 'tradeoff'],
      answerStructure: answerStructureFor(`Explain ${skill}`, skill, profileProjects[0], 'Weak-skill-based'),
      source: 'skill gap',
      priority: 90 - index,
      tags: ['weak skill', skill, roleKind],
    }),
    makeQuestion({
      questionText: `Give one project example where ${skill} would improve the solution.`,
      category: 'Weak-skill-based',
      domain: detectedDomain,
      topic: skill,
      role: targetRole,
      difficulty: 'Intermediate',
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'Interviewers value candidates who can connect weak topics to practical improvements.',
      answerHint: `Describe one current limitation, then explain how ${skill} would improve the design, security, speed, or maintainability.`,
      keyPoints: ['current limitation', skill, 'implementation idea', 'benefit'],
      answerStructure: answerStructureFor(`Project improvement with ${skill}`, skill, profileProjects[0], 'Weak-skill-based'),
      source: 'skill gap',
      priority: 84 - index,
      tags: ['weak skill', 'project improvement', skill],
    }),
  ])

  const jobQuestions = jobSkills.map((skill, index) => makeQuestion({
    questionText: `The job requires ${skill}. How would you demonstrate your practical experience with it?`,
    category: 'Job-description-based',
    domain: detectedDomain,
    topic: skill,
    role: targetRole,
    difficulty: selectedDifficulty,
    companyType: selectedCompanyType,
    experienceLevel,
    whyRecommended: `${skill} appears in the target job context, so it is likely to be checked during screening or technical rounds.`,
    answerHint: `Treat this like a job-fit answer: say where you used ${skill}, how deep your work was, and what result it created.`,
    keyPoints: [skill, 'where used', 'depth of work', 'result', 'learning'],
    answerStructure: answerStructureFor(`Job requires ${skill}`, skill, profileProjects[0], 'Job-description-based'),
    source: 'job description',
    priority: 88 - index,
    tags: ['job description', skill, roleKind],
  }))

  const roleQuestions = [
    makeQuestion({
      questionText: `For a ${targetRole}, what are the most important responsibilities you are ready to handle?`,
      category: 'Role-based Technical',
      domain: detectedDomain,
      topic: roleKind,
      role: targetRole,
      difficulty: selectedDifficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'This helps you connect your preparation to the actual role instead of answering randomly.',
      answerHint: `Do not define "${roleKind}". Explain the real responsibilities of a ${targetRole} and prove them with resume examples.`,
      keyPoints: ['role responsibilities', 'matching skills', 'project proof', 'learning plan'],
      answerStructure: answerStructureFor(`Responsibilities for ${targetRole}`, roleKind, profileProjects[0], 'Role-based Technical'),
      source: 'target role',
      priority: 83,
      tags: ['role', roleKind, targetRole],
    }),
    makeQuestion({
      questionText: `What would you revise in the last 30 minutes before a ${targetRole} interview?`,
      category: 'Quick Revision',
      domain: detectedDomain,
      topic: roleKind,
      role: targetRole,
      difficulty: 'Beginner',
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'A focused revision checklist reduces panic before mock or real interviews.',
      keyPoints: ['intro', 'projects', 'weak topics', 'job skills', 'questions for interviewer'],
      source: 'revision',
      priority: 75,
      tags: ['revision', roleKind],
    }),
  ]

  const questions = rankAndDedupe([...resumeQuestions, ...skillQuestions, ...jobQuestions, ...roleQuestions, ...bankQuestions])
  const practicedBaseline = 0
  const readinessScore = Math.min(92, Math.max(48, 55 + Math.min(profileProjects.length, 3) * 8 + Math.min(extractedSkills.length, 8) * 2 - Math.min(weakSkills.length, 8) * 3))
  const dailyPractice = questions.slice(0, 7)
  const quickRevision = [
    'Practice your self introduction out loud once.',
    `Revise ${weakSkills.slice(0, 3).join(', ') || 'your top weak topics'} with one example each.`,
    'Prepare one project story using problem, action, result, and learning.',
    `Review ${targetRole} responsibilities and match them to your resume proof.`,
  ]
  const commonMistakes = unique(questions.flatMap((question) => question.commonMistakes)).slice(0, 8)
  const completedTopics: string[] = []

  const plan = {
    generatedAt: new Date().toISOString(),
    role: targetRole,
    difficulty: selectedDifficulty,
    companyType: selectedCompanyType,
    experienceLevel,
    resumeId: String(resume?._id ?? resumeId ?? ''),
    contextSummary: {
      detectedDomain,
      detectedDomainLabel: domainLabel((isDomainKey(detectedDomain) ? detectedDomain : 'general_fresher') as DomainKey),
      resumeName: String(resume?.fileName ?? 'Latest resume'),
      profileHeadline: String(profile?.professionalHeadline ?? profile?.summary ?? ''),
      topProjects: profileProjects,
      strongSkills: extractedSkills.slice(0, 10),
      weakSkills,
      jobSkills,
      targetRole,
    },
    readiness: {
      score: readinessScore,
      level: readinessScore >= 78 ? 'Strong' : readinessScore >= 62 ? 'Building' : 'Needs focused practice',
      recommendedQuestions: questions.length,
      practicedQuestions: practicedBaseline,
      topWeakTopic: weakSkills[0] ?? jobSkills[0] ?? roleKind,
      message: weakSkills.length
        ? `Start with ${weakSkills[0]} and your resume projects, then move into role-specific technical rounds.`
        : 'Your weak-skill list is light, so focus on project depth, role fit, and confident HR answers.',
    },
    questions,
    topRecommended: questions.slice(0, 5),
    dailyPractice,
    quickRevision,
    commonMistakes,
    completedTopics,
    weakTopicsNotPracticed: weakSkills,
    levels: [
      { level: 1, title: 'Resume and project proof', focus: 'Own your projects and contribution.', questions: resumeQuestions.slice(0, 4).map((item) => item.questionText), tips: ['Use problem-action-result.', 'Never claim work you cannot explain.'] },
      { level: 2, title: 'Weak skill repair', focus: 'Convert gaps into answerable topics.', questions: skillQuestions.slice(0, 5).map((item) => item.questionText), tips: ['Define simply, then give a project use case.'] },
      { level: 3, title: 'Role and job fit', focus: `Prepare for ${targetRole}.`, questions: [...jobQuestions, ...roleQuestions].slice(0, 5).map((item) => item.questionText), tips: ['Map every answer back to role requirements.'] },
      { level: 4, title: 'HR and company style', focus: `${selectedCompanyType} interview pattern.`, questions: bankQuestions.filter((item) => item.category === 'HR' || item.category === 'Company-style').slice(0, 5).map((item) => item.questionText), tips: ['Be specific, honest, and outcome-focused.'] },
    ],
  }

  if (resume) {
    await InterviewQuestion.create({
      userId,
      domain: detectedDomain,
      role: targetRole,
      skill: weakSkills[0] ?? roleKind,
      difficulty: selectedDifficulty,
      category: 'Personalized Plan',
      topic: weakSkills[0] ?? roleKind,
      companyType: selectedCompanyType,
      experienceLevel,
      questionText: questions[0]?.questionText ?? '',
      questions: questions.map((question) => question.questionText),
      answerHint: questions[0]?.answerHint ?? '',
      keyPoints: questions[0]?.keyPoints ?? [],
      commonMistakes: questions[0]?.commonMistakes ?? [],
      tags: ['personalized', targetRole, roleKind],
    })
  }

  const report = await Report.create({
    userId,
    reportType: 'Interview Preparation',
    relatedId: resume?._id ? String(resume._id) : null,
    title: `${targetRole} Interview Preparation Plan`,
    summary: `Prepared a personalized interview plan for ${targetRole}.`,
    payload: plan,
  })
  void reminderService.sendReportReadyNotification({
    userId,
    reportType: 'Interview Preparation Progress Report',
    title: String(report.title ?? `${targetRole} Interview Preparation Plan`),
    summary: String(report.summary ?? ''),
    actionPath: '/student/interview-prep',
    contextKey: `report:${String(report._id)}`,
  }).catch((error) => console.error('[reminders] failed to send interview preparation email', error))

  res.json({ success: true, data: plan })
}

export const mockInterviewFeedback = async (req: Request, res: Response): Promise<void> => {
  const { question, answer } = req.body
  const profile = await Profile.findOne({ userId: req.user?.userId }).lean<Record<string, unknown>>()
  const latestRecommendation = await Report.findOne({ userId: req.user?.userId, reportType: 'Smart Recommendation' }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const recommendationPayload = (latestRecommendation?.payload ?? {}) as Record<string, unknown>
  const detectedDomain = inferDomainFromRecommendation(recommendationPayload, String(profile?.preferredJobRole ?? ''), `${question} ${answer}`)
  const feedback = await aiService.evaluateMockAnswer(answer, question)
  const saved = await MockInterview.create({
    userId: req.user?.userId,
    domain: detectedDomain,
    targetRole: String(recommendationPayload.targetRole ?? profile?.preferredJobRole ?? ''),
    questions: [question],
    answers: [answer],
    feedback,
    score: feedback.score,
  })
  res.json({ success: true, data: saved })
}

type MockInterviewMode = 'quick_practice' | 'full_mock' | 'weak_topic_practice' | 'resume_defense' | 'hr_round'
type MockInterviewType = 'hr' | 'technical' | 'role_based' | 'resume_based' | 'mixed'
type MockContext = {
  domain: string
  domainLabel: string
  targetRole: string
  difficulty: Difficulty
  sessionMode: MockInterviewMode
  interviewType: MockInterviewType
  questionCount: number
  timerEnabled: boolean
  timerPerQuestionSec: number
  topWeakTopic: string
  weakSkills: string[]
  strongSkills: string[]
  jobSkills: string[]
  projects: string[]
  profileSummary: string
  prepProgress: Record<string, unknown>
  questions: PrepQuestion[]
}

const asDifficulty = (value: unknown): Difficulty => {
  const normalizedValue = String(value ?? '').trim().toLowerCase()
  if (normalizedValue === 'beginner') return 'Beginner'
  if (normalizedValue === 'advanced') return 'Advanced'
  return 'Intermediate'
}

const asMockMode = (value: unknown): MockInterviewMode => {
  const normalizedValue = String(value ?? '').trim().toLowerCase()
  if (normalizedValue === 'full_mock') return 'full_mock'
  if (normalizedValue === 'weak_topic_practice') return 'weak_topic_practice'
  if (normalizedValue === 'resume_defense') return 'resume_defense'
  if (normalizedValue === 'hr_round') return 'hr_round'
  return 'quick_practice'
}

const asMockType = (value: unknown): MockInterviewType => {
  const normalizedValue = String(value ?? '').trim().toLowerCase()
  if (normalizedValue === 'hr') return 'hr'
  if (normalizedValue === 'technical') return 'technical'
  if (normalizedValue === 'role_based') return 'role_based'
  if (normalizedValue === 'resume_based') return 'resume_based'
  return 'mixed'
}

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

const defaultQuestionCount = (mode: MockInterviewMode): number => {
  if (mode === 'full_mock') return 12
  if (mode === 'hr_round') return 6
  if (mode === 'resume_defense') return 6
  if (mode === 'weak_topic_practice') return 6
  return 6
}

const questionCountFor = (mode: MockInterviewMode, requested: unknown): number => {
  const parsed = Number(requested ?? 0)
  if (Number.isFinite(parsed) && parsed > 0) {
    return clampNumber(Math.round(parsed), 3, 15)
  }
  return defaultQuestionCount(mode)
}

const categorizePrepQuestion = (questionText: string): { category: string; topic: string } => {
  const lower = normalize(questionText)
  if (/tell me about yourself|strength|weakness|why should we hire|conflict|team|hr/.test(lower)) {
    return { category: 'HR', topic: 'communication' }
  }
  if (/resume|project|internship|challenge|built|developed/.test(lower)) {
    return { category: 'Resume/Project-based', topic: 'project explanation' }
  }
  if (/role|responsibilities|fit|job requires/.test(lower)) {
    return { category: 'Role-based Technical', topic: 'role readiness' }
  }
  if (/revise|last 30 minutes/.test(lower)) {
    return { category: 'Quick Revision', topic: 'revision' }
  }
  return { category: 'Technical', topic: 'domain fundamentals' }
}

const questionMatchesInterviewType = (question: PrepQuestion, interviewType: MockInterviewType): boolean => {
  const category = normalize(question.category)
  if (interviewType === 'hr') return category.includes('hr') || category.includes('behavioral')
  if (interviewType === 'technical') return !category.includes('hr') && !category.includes('resume')
  if (interviewType === 'role_based') return category.includes('role') || category.includes('job')
  if (interviewType === 'resume_based') return category.includes('resume') || category.includes('project')
  return true
}

const buildSessionQuestionItems = (questions: PrepQuestion[], timerPerQuestionSec: number) =>
  questions.map((question, index) => ({
    id: question.id || `question-${index + 1}`,
    order: index + 1,
    questionText: question.questionText,
    category: question.category,
    topic: question.topic,
    difficulty: question.difficulty,
    answerHint: question.answerHint,
    keyPoints: question.keyPoints,
    commonMistakes: question.commonMistakes,
    whyRecommended: question.whyRecommended,
    source: question.source,
    tags: question.tags,
    timeLimitSec: timerPerQuestionSec,
  }))

const customInterviewQuestionToPrepQuestion = (question: Record<string, unknown>, context: MockContext, index: number): PrepQuestion =>
  makeQuestion({
    id: String(question._id ?? `recruiter-question-${index + 1}`),
    questionText: String(question.questionText ?? ''),
    category: String(question.roundType ?? context.interviewType),
    domain: context.domain,
    topic: String(question.topic ?? ''),
    role: String(question.role ?? context.targetRole),
    difficulty: asDifficulty(question.difficulty ?? context.difficulty),
    companyType: 'recruiter assigned',
    experienceLevel: 'student',
    answerHint: String(question.answerHint ?? ''),
    keyPoints: Array.isArray(question.keyPoints) ? question.keyPoints.map((item) => String(item)) : [],
    whyRecommended: 'Assigned directly by the recruiter for this application.',
    source: 'recruiter custom',
    priority: 100 - index,
    tags: Array.isArray(question.tags) ? question.tags.map((item) => String(item)) : ['recruiter assigned'],
  })

const overallBand = (score: number): string => {
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Promising'
  if (score >= 50) return 'Needs focused practice'
  return 'Needs major revision'
}

const followUpFallback = (question: string, topic: string, answer: string): string => {
  const hasExample = /\b(for example|for instance|in my project|during my internship|when i)\b/i.test(answer)
  if (!hasExample) return `Give one concrete example for ${topic || 'this answer'} and explain your exact contribution.`
  if (/\bwhy\b/i.test(question)) return `Can you justify that choice with one tradeoff or business reason?`
  return `Go one level deeper: what challenge did you face in ${topic || 'this area'} and how did you handle it?`
}

const buildMockInterviewContext = async (userId: string, payload: Record<string, unknown>): Promise<MockContext> => {
  const resumeId = String(payload.resumeId ?? '').trim()
  const requestedRole = String(payload.role ?? '').trim()
  const difficulty = asDifficulty(payload.difficulty)
  const sessionMode = asMockMode(payload.sessionMode)
  const interviewType = asMockType(payload.interviewType)
  const selectedDomain = String(payload.selectedDomain ?? '').trim()
  const timerEnabled = Boolean(payload.timerEnabled)
  const timerPerQuestionSec = timerEnabled ? clampNumber(Number(payload.timerPerQuestionSec ?? 90) || 90, 30, 300) : 0
  const questionCount = questionCountFor(sessionMode, payload.questionCount)
  const jobDescriptionText = String(payload.jobDescriptionText ?? '').trim()

  const resume = resumeId
    ? await Resume.findOne({ _id: resumeId, userId }).lean<Record<string, unknown>>()
    : await Resume.findOne({ userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const profile = await Profile.findOne({ userId }).lean<Record<string, unknown>>()
  const latestGap = await SkillGapReport.findOne({ userId, ...(resume?._id ? { resumeId: resume._id } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const latestRecommendation = await Report.findOne({ userId, reportType: 'Smart Recommendation', ...(resume?._id ? { relatedId: String(resume._id) } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const latestPrep = await Report.findOne({ userId, reportType: 'Interview Preparation', ...(resume?._id ? { relatedId: String(resume._id) } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const latestJob = await SavedJobDescription.findOne({ userId, ...(resume?._id ? { resumeId: String(resume._id) } : {}) }).sort({ createdAt: -1 }).lean<Record<string, unknown>>()
  const recommendationPayload = (latestRecommendation?.payload ?? {}) as Record<string, unknown>
  const prepPayload = (latestPrep?.payload ?? {}) as Record<string, unknown>
  const gapContent = ((latestGap?.content ?? {}) as Record<string, unknown>)
  const skillGapAnalysis = ((gapContent.skillGapAnalysis ?? {}) as Record<string, unknown>)
  const effectiveJobText = jobDescriptionText || String(latestJob?.jobDescriptionText ?? '')
  const resumeText = String(payload.resumeText ?? resume?.extractedText ?? '').trim()
  const inferredDomain = inferDomainFromRecommendation(
    { ...recommendationPayload, confirmedDomain: profile?.confirmedDomain ?? recommendationPayload.confirmedDomain },
    requestedRole || String(recommendationPayload.targetRole ?? profile?.preferredJobRole ?? ''),
    `${resumeText} ${effectiveJobText} ${profile?.summary ?? ''}`,
  )
  const domain = isDomainKey(selectedDomain) ? selectedDomain : inferredDomain
  const targetRole = requestedRole || String(recommendationPayload.targetRole ?? profile?.preferredJobRole ?? defaultRoleForDomain(domain)).trim() || defaultRoleForDomain(domain)
  const domainKey = (isDomainKey(domain) ? domain : 'general_fresher') as DomainKey
  const domainDisplay = domainLabel(domainKey)
  const roleKind = roleFamily(targetRole)
  const selectedCompanyType = inferCompanyType(`${effectiveJobText} ${targetRole}`)
  const experienceLevel = inferExperienceLevel(`${resumeText} ${effectiveJobText} ${profile?.experience ?? ''}`)
  const strongSkills = unique([
    ...toStringArray(profile?.skills),
    ...toStringArray(profile?.technicalSkills),
    ...toStringArray(resume?.extractedSkills),
    ...extractKnownSkills(resumeText),
  ]).slice(0, 12)
  const projects = unique([...toStringArray(profile?.projects), ...toStringArray(resume?.extractedProjects)]).slice(0, 5)
  const weakSkills = unique([
    ...toStringArray(skillGapAnalysis.missingRequiredSkills),
    ...toStringArray(skillGapAnalysis.weakRequiredSkills),
    ...toStringArray(latestGap?.missingSkills),
    ...toStringArray((gapContent.gaps as Array<Record<string, unknown>> | undefined)?.map((gap) => String(gap.skill ?? ''))),
  ]).slice(0, 8)
  const jobSkills = unique([
    ...toStringArray((gapContent.parsedJobDescription as Record<string, unknown> | undefined)?.requiredSkills),
    ...extractKnownSkills(effectiveJobText),
  ]).slice(0, 8)

  await ensureQuestionBank()
  const bankDocs = await InterviewQuestion.find({
    userId: null,
    $or: [
      { field: { $in: ['all', domain] } },
      { domain: { $in: ['all', domain] } },
    ],
  }).lean<Array<Record<string, unknown>>>()

  const bankQuestions = bankDocs
    .map((doc) => fromBankDoc(doc, targetRole))
    .map((question) => {
      const topic = normalize(question.topic)
      const roleBoost = ['all', roleKind, targetRole.toLowerCase()].includes(normalize(question.role)) ? 8 : 0
      const companyBoost = [selectedCompanyType, 'general', 'campus placement'].includes(question.companyType) ? 6 : 0
      const skillBoost = [...weakSkills, ...jobSkills, ...strongSkills].some((item) => normalize(item) === topic) ? 10 : 0
      return { ...question, priority: question.priority + roleBoost + companyBoost + skillBoost }
    })

  const prepQuestionTexts = unique([
    ...(((prepPayload.questions ?? []) as Array<Record<string, unknown>>).map((item) => String(item.questionText ?? ''))),
    ...(((prepPayload.topRecommended ?? []) as Array<Record<string, unknown>>).map((item) => String(item.questionText ?? ''))),
    ...(((prepPayload.levels ?? []) as Array<Record<string, unknown>>).flatMap((level) => toStringArray(level.questions))),
    ...toStringArray((prepPayload.dailyPractice as Array<Record<string, unknown>> | undefined)?.map((item) => String(item.questionText ?? ''))),
  ]).filter(Boolean)

  const prepQuestions = prepQuestionTexts.map((questionText, index) => {
    const derived = categorizePrepQuestion(questionText)
    return makeQuestion({
      id: `prep-${index + 1}-${normalize(questionText).slice(0, 32).replace(/[^a-z0-9]+/g, '-')}`,
      questionText,
      category: derived.category,
      domain,
      topic: derived.topic,
      role: targetRole,
      difficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'This came from your latest interview preparation plan, so it matches your active readiness path.',
      source: 'interview preparation',
      priority: 82 - index,
      tags: ['prep plan', targetRole, domain],
    })
  })

  const resumeQuestions = projects.flatMap((project, index) => [
    makeQuestion({
      questionText: `Walk me through "${project}" in a way that proves your contribution clearly.`,
      category: 'Resume/Project-based',
      domain,
      topic: 'project explanation',
      role: targetRole,
      difficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'Real interviewers often begin with your own project or internship proof before moving to deeper questions.',
      answerHint: 'Explain the problem, your role, tools used, challenge, and result in a recruiter-friendly flow.',
      keyPoints: ['problem', 'your contribution', 'tools', 'challenge', 'result'],
      source: 'resume',
      priority: 95 - index,
      tags: ['resume', 'project', domain],
    }),
    makeQuestion({
      questionText: `What decisions did you personally make in "${project}", and why?`,
      category: 'Resume/Project-based',
      domain,
      topic: 'project ownership',
      role: targetRole,
      difficulty: 'Intermediate',
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'This reveals whether you owned the work or only assisted with it.',
      source: 'resume',
      priority: 90 - index,
      tags: ['resume', 'ownership', domain],
    }),
  ])

  const weakTopicQuestions = weakSkills.flatMap((skill, index) => [
    makeQuestion({
      questionText: `Explain ${skill} in simple terms and connect it to the ${targetRole} role.`,
      category: 'Weak-skill-based',
      domain,
      topic: skill,
      role: targetRole,
      difficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: `${skill} appears in your weak-skill context, so improving it should increase readiness quickly.`,
      source: 'skill gap',
      priority: 92 - index,
      tags: ['weak topic', skill, domain],
    }),
    makeQuestion({
      questionText: `Give one practical scenario where ${skill} would matter in ${domainDisplay}.`,
      category: 'Weak-skill-based',
      domain,
      topic: skill,
      role: targetRole,
      difficulty: 'Intermediate',
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'This checks whether you can use the concept in realistic work, not only define it.',
      source: 'skill gap',
      priority: 88 - index,
      tags: ['weak topic', 'scenario', skill],
    }),
  ])

  const jobQuestions = jobSkills.map((skill, index) => makeQuestion({
    questionText: `This target role needs ${skill}. How would you prove your readiness with an example?`,
    category: 'Job-description-based',
    domain,
    topic: skill,
    role: targetRole,
    difficulty,
    companyType: selectedCompanyType,
    experienceLevel,
    whyRecommended: `${skill} appears in the role or job context, so it is a likely screening question.`,
    source: 'job description',
    priority: 87 - index,
    tags: ['job fit', skill, domain],
  }))

  const roleQuestions = [
    makeQuestion({
      questionText: `As a ${targetRole}, what are the top responsibilities you are ready to handle from day one?`,
      category: 'Role-based Technical',
      domain,
      topic: roleKind,
      role: targetRole,
      difficulty,
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'Interviewers want to see if you understand the job, not only the subject.',
      source: 'target role',
      priority: 84,
      tags: ['role', roleKind, domain],
    }),
    makeQuestion({
      questionText: `What would success look like in the first 90 days of a ${targetRole} role?`,
      category: 'Role-based Technical',
      domain,
      topic: roleKind,
      role: targetRole,
      difficulty: 'Intermediate',
      companyType: selectedCompanyType,
      experienceLevel,
      whyRecommended: 'This checks role-awareness, ownership, and practical thinking.',
      source: 'target role',
      priority: 80,
      tags: ['role', 'ownership', domain],
    }),
  ]

  const allQuestions = rankAndDedupe([
    ...prepQuestions,
    ...resumeQuestions,
    ...weakTopicQuestions,
    ...jobQuestions,
    ...roleQuestions,
    ...bankQuestions,
  ])

  return {
    domain,
    domainLabel: domainDisplay,
    targetRole,
    difficulty,
    sessionMode,
    interviewType,
    questionCount,
    timerEnabled,
    timerPerQuestionSec,
    topWeakTopic: weakSkills[0] ?? jobSkills[0] ?? roleKind,
    weakSkills,
    strongSkills,
    jobSkills,
    projects,
    profileSummary: String(profile?.professionalHeadline ?? profile?.summary ?? ''),
    prepProgress: {
      readinessScore: Number((prepPayload.readiness as Record<string, unknown> | undefined)?.score ?? latestGap?.readinessScore ?? 0),
      practicedQuestions: Number((prepPayload.readiness as Record<string, unknown> | undefined)?.practicedQuestions ?? 0),
      topWeakTopic: String((prepPayload.readiness as Record<string, unknown> | undefined)?.topWeakTopic ?? weakSkills[0] ?? ''),
    },
    questions: allQuestions,
  }
}

const selectSessionQuestions = (context: MockContext): PrepQuestion[] => {
  const fromType = context.questions.filter((question) => questionMatchesInterviewType(question, context.interviewType))
  const hrPool = context.questions.filter((question) => questionMatchesInterviewType(question, 'hr'))
  const resumePool = context.questions.filter((question) => questionMatchesInterviewType(question, 'resume_based'))
  const rolePool = context.questions.filter((question) => questionMatchesInterviewType(question, 'role_based'))
  const technicalPool = context.questions.filter((question) => questionMatchesInterviewType(question, 'technical'))
  const weakPool = context.questions.filter((question) => normalize(question.category).includes('weak'))

  let selected: PrepQuestion[] = []
  if (context.sessionMode === 'hr_round') {
    selected = hrPool
  } else if (context.sessionMode === 'resume_defense') {
    selected = resumePool.length ? resumePool : fromType
  } else if (context.sessionMode === 'weak_topic_practice') {
    selected = weakPool.length ? weakPool : technicalPool
  } else if (context.sessionMode === 'full_mock') {
    selected = rankAndDedupe([
      ...resumePool.slice(0, 3),
      ...technicalPool.slice(0, 5),
      ...rolePool.slice(0, 2),
      ...hrPool.slice(0, 3),
    ])
  } else {
    selected = fromType.length ? fromType : context.questions
  }

  if (!selected.length) selected = context.questions
  return selected.slice(0, context.questionCount)
}

const summarizeSessionHistory = (session: Record<string, unknown>) => ({
  id: String(session._id ?? ''),
  domain: String(session.domain ?? ''),
  targetRole: String(session.targetRole ?? ''),
  interviewType: String(session.interviewType ?? 'mixed'),
  difficulty: String(session.difficulty ?? 'Intermediate'),
  score: Number(session.score ?? 0),
  status: String(session.status ?? 'completed'),
  questionCount: Number(session.questionCount ?? 0),
  createdAt: session.createdAt,
  evaluation: session.evaluation ?? {},
})

export const startMockInterviewSession = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.user?.userId ?? '')
  const assignmentId = String(req.body.assignmentId ?? '').trim()
  let assignment: Record<string, unknown> | null = null
  let lockedRequestBody = { ...(req.body as Record<string, unknown>) }
  if (assignmentId) {
    assignment = await RecruiterAssessmentAssignment.findOne({ _id: assignmentId, studentId: userId, roundCategory: 'interview' }).lean<Record<string, unknown> | null>()
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assigned interview round not found.' })
      return
    }
    if (['completed', 'reviewed'].includes(String(assignment.status ?? '').toLowerCase())) {
      res.status(409).json({ success: false, message: 'This recruiter-assigned interview has already been completed.' })
      return
    }
    if (assignment.sessionId) {
      const existingSession = await MockInterview.findOne({ _id: assignment.sessionId, userId })
      if (existingSession && String(existingSession.status ?? '') === 'in_progress') {
        res.json({
          success: true,
          data: {
            sessionId: String(existingSession._id),
            session: existingSession,
            currentQuestion: ((existingSession.questionItems ?? []) as Array<Record<string, unknown>>)[Number(existingSession.currentQuestionIndex ?? 0)] ?? null,
            questionItems: existingSession.questionItems ?? [],
            readinessSummary: existingSession.contextSummary ?? {},
          },
        })
        return
      }
    }
    const job = assignment.jobId ? await SavedJobDescription.findById(assignment.jobId).lean<Record<string, unknown> | null>().catch(() => null) : null
    lockedRequestBody = {
      ...lockedRequestBody,
      selectedDomain: String(job?.domain ?? req.body.selectedDomain ?? 'general_fresher'),
      role: String(job?.roleLabel ?? job?.title ?? req.body.role ?? ''),
      difficulty: String(assignment.difficulty ?? 'Intermediate'),
      interviewType: String(assignment.roundType ?? 'mixed'),
      questionCount: Number(assignment.questionCount ?? 6),
      timerEnabled: Boolean(Number(assignment.timeLimitSec ?? 0) > 0),
      timerPerQuestionSec: Number(assignment.timeLimitSec ?? 0),
      sessionMode: 'recruiter_assigned',
      jobDescriptionText: '',
    }
  }
  const context = await buildMockInterviewContext(userId, lockedRequestBody)
  let selectedQuestions = selectSessionQuestions(context)
  if (assignment && String(assignment.questionSource ?? 'platform') === 'recruiter_custom') {
    const customQuestions = await RecruiterInterviewQuestion.find({
      _id: { $in: Array.isArray(assignment.customInterviewQuestionIds) ? assignment.customInterviewQuestionIds : [] },
      recruiterId: assignment.recruiterId as any,
    }).lean<Array<Record<string, unknown>>>()
    if (customQuestions.length) {
      selectedQuestions = customQuestions
        .slice(0, Number(assignment.questionCount ?? customQuestions.length))
        .map((question, index) => customInterviewQuestionToPrepQuestion(question, context, index))
    }
  }
  const questionItems = buildSessionQuestionItems(selectedQuestions, context.timerPerQuestionSec)
  const assignmentObjectId = assignment ? ((assignment as any)._id ?? null) : null
  const session = await MockInterview.create({
    userId,
    recruiterId: (assignment as any)?.recruiterId ?? req.body.recruiterId ?? null,
    jobId: (assignment as any)?.jobId ?? req.body.jobId ?? null,
    applicationId: (assignment as any)?.applicationId ?? req.body.applicationId ?? null,
    assignmentId: assignmentObjectId,
    domain: context.domain,
    targetRole: context.targetRole,
    interviewType: context.interviewType,
    difficulty: context.difficulty,
    status: 'in_progress',
    questionCount: questionItems.length,
    timerEnabled: context.timerEnabled,
    timerPerQuestionSec: context.timerPerQuestionSec,
    currentQuestionIndex: 0,
    sessionMode: assignmentObjectId ? 'recruiter_assigned' : context.sessionMode,
    assessmentMode: assignmentObjectId ? 'recruiter_assigned' : 'practice',
    contextSummary: {
      domain: context.domain,
      domainLabel: context.domainLabel,
      targetRole: context.targetRole,
      topWeakTopic: context.topWeakTopic,
      weakSkills: context.weakSkills,
      strongSkills: context.strongSkills,
      jobSkills: context.jobSkills,
      projects: context.projects,
      profileSummary: context.profileSummary,
      prepProgress: context.prepProgress,
    },
    questionItems,
    answerItems: [],
    questions: questionItems.map((item) => String(item.questionText ?? '')),
    answers: [],
    feedback: {},
    evaluation: {},
    recommendedNextSteps: [],
    startedAt: new Date(),
    score: 0,
  })

  const linkedAssignmentId = assignmentObjectId
  if (linkedAssignmentId) {
    const sessionDoc = session as any
    await RecruiterAssessmentAssignment.updateOne(
      { _id: linkedAssignmentId },
      { $set: { sessionId: sessionDoc._id, status: 'started' } },
    )
  }

  res.json({
    success: true,
    data: {
      sessionId: String((session as any)._id),
      session,
      currentQuestion: questionItems[0] ?? null,
      questionItems,
      readinessSummary: {
        domain: context.domain,
        domainLabel: context.domainLabel,
        targetRole: context.targetRole,
        topWeakTopic: context.topWeakTopic,
        weakSkills: context.weakSkills,
        strongSkills: context.strongSkills,
        prepProgress: context.prepProgress,
      },
    },
  })
}

export const submitMockInterviewAnswer = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.user?.userId ?? '')
  const session = await MockInterview.findOne({ _id: req.params.sessionId, userId })
  if (!session) {
    res.status(404).json({ success: false, message: 'Mock interview session not found.' })
    return
  }
  if (String(session.status ?? '') !== 'in_progress') {
    res.status(409).json({ success: false, message: 'This interview session is already closed.' })
    return
  }

  const questionId = String(req.body.questionId ?? '')
  const responseTimeSec = clampNumber(Number(req.body.responseTimeSec ?? 0) || 0, 0, 3600)
  const skipped = Boolean(req.body.skipped)
  const questionItems = (session.questionItems ?? []) as Array<Record<string, unknown>>
  const lockedAssessment = String(session.assessmentMode ?? 'practice') === 'recruiter_assigned'
  const expectedQuestion = questionItems[session.currentQuestionIndex ?? 0] ?? questionItems[0]
  if (lockedAssessment && questionId && String(expectedQuestion?.id ?? '') !== questionId) {
    res.status(400).json({ success: false, message: 'This recruiter-assigned interview question order is locked.' })
    return
  }
  if (lockedAssessment && skipped) {
    res.status(400).json({ success: false, message: 'Skipping is disabled for recruiter-assigned interview rounds.' })
    return
  }
  const questionIndex = lockedAssessment
    ? Math.max(0, Number(session.currentQuestionIndex ?? 0))
    : Math.max(0, questionItems.findIndex((item) => String(item.id ?? '') === questionId))
  const question = questionItems[questionIndex] ?? questionItems[session.currentQuestionIndex ?? 0]
  const questionText = String(question?.questionText ?? '')
  const answer = String(req.body.answer ?? '').trim()

  const evaluation = skipped
    ? {
        score: 0,
        confidence: 0,
        clarity: 0,
        responseQuality: 0,
        technicalAccuracy: 0,
        communication: 0,
        feedback: 'Question skipped. Revisit this topic and try answering it in your next practice round.',
        strengths: [],
        improvements: ['Try answering this once in your own words before the next mock round.'],
      }
    : await aiService.evaluateMockAnswer(answer, questionText)

  const followUpQuestion = skipped || Number(evaluation.score ?? 0) >= 70
    ? ''
    : await aiService.generateInterviewFollowUp(
      questionText,
      answer,
      String(question?.topic ?? ''),
      String((session.contextSummary as Record<string, unknown> | undefined)?.targetRole ?? session.targetRole ?? ''),
      String(session.domain ?? ''),
    )

  const answerItems = ((session.answerItems ?? []) as Array<Record<string, unknown>>).filter((item) => String(item.questionId ?? '') !== String(question?.id ?? ''))
  answerItems.push({
    questionId: String(question?.id ?? questionId ?? ''),
    questionText,
    category: String(question?.category ?? ''),
    topic: String(question?.topic ?? ''),
    answer,
    skipped,
    responseTimeSec,
    feedback: evaluation,
    followUpQuestion: followUpQuestion || followUpFallback(questionText, String(question?.topic ?? ''), answer),
    answeredAt: new Date().toISOString(),
  })

  session.answerItems = answerItems
  session.answers = answerItems.map((item) => String(item.answer ?? ''))
  session.currentQuestionIndex = clampNumber(questionIndex + 1, 0, Math.max(questionItems.length - 1, 0))
  session.feedback = {
    lastAnswer: evaluation,
    answeredQuestions: answerItems.length,
    remainingQuestions: Math.max(questionItems.length - answerItems.length, 0),
  }
  await session.save()

  const nextQuestion = questionItems.find((item) => !answerItems.some((answerItem) => String(answerItem.questionId ?? '') === String(item.id ?? ''))) ?? null
  res.json({
    success: true,
    data: {
      sessionId: String(session._id),
      answerEvaluation: evaluation,
      followUpQuestion,
      nextQuestion,
      progress: {
        answered: answerItems.length,
        total: questionItems.length,
      },
    },
  })
}

export const completeMockInterviewSession = async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.user?.userId ?? '')
  const session = await MockInterview.findOne({ _id: req.params.sessionId, userId })
  if (!session) {
    res.status(404).json({ success: false, message: 'Mock interview session not found.' })
    return
  }
  if (String(session.status ?? '') !== 'in_progress') {
    res.status(409).json({ success: false, message: 'This interview session has already been submitted.' })
    return
  }

  const questionItems = (session.questionItems ?? []) as Array<Record<string, unknown>>
  const answerItems = (session.answerItems ?? []) as Array<Record<string, unknown>>
  const scoredAnswers = answerItems.filter((item) => !Boolean(item.skipped))
  const overallScore = scoredAnswers.length
    ? Math.round(scoredAnswers.reduce((sum, item) => sum + Number((item.feedback as Record<string, unknown> | undefined)?.score ?? 0), 0) / scoredAnswers.length)
    : 0
  const technicalAnswers = answerItems.filter((item) => !/hr|behavioral/i.test(String(item.category ?? '')))
  const hrAnswers = answerItems.filter((item) => /hr|behavioral/i.test(String(item.category ?? '')))
  const resumeAnswers = answerItems.filter((item) => /resume|project/i.test(String(item.category ?? '')))
  const categoryAverage = (items: Array<Record<string, unknown>>) =>
    items.length
      ? Math.round(items.reduce((sum, item) => sum + Number((item.feedback as Record<string, unknown> | undefined)?.score ?? 0), 0) / items.length)
      : 0
  const weakAreas = unique(answerItems.filter((item) => Number((item.feedback as Record<string, unknown> | undefined)?.score ?? 0) < 65).map((item) => String(item.topic ?? '')).filter(Boolean)).slice(0, 5)
  const strongAreas = unique(answerItems.filter((item) => Number((item.feedback as Record<string, unknown> | undefined)?.score ?? 0) >= 75).map((item) => String(item.topic ?? '')).filter(Boolean)).slice(0, 5)
  const answerFeedback = answerItems.map((item) => ({
    questionId: String(item.questionId ?? ''),
    questionText: String(item.questionText ?? ''),
    category: String(item.category ?? ''),
    topic: String(item.topic ?? ''),
    score: Number((item.feedback as Record<string, unknown> | undefined)?.score ?? 0),
    responseTimeSec: Number(item.responseTimeSec ?? 0),
    skipped: Boolean(item.skipped),
    briefEvaluation: String((item.feedback as Record<string, unknown> | undefined)?.feedback ?? ''),
    whatWasGood: toStringArray((item.feedback as Record<string, unknown> | undefined)?.strengths),
    whatWasMissing: toStringArray((item.feedback as Record<string, unknown> | undefined)?.improvements),
    betterWayToAnswer: followUpFallback(String(item.questionText ?? ''), String(item.topic ?? ''), String(item.answer ?? '')),
    followUpTopicToRevise: String(item.topic ?? ''),
  }))
  const contextSummary = (session.contextSummary ?? {}) as Record<string, unknown>
  const recommendedNextTopics = unique([
    ...weakAreas,
    ...toStringArray(contextSummary.weakSkills),
  ]).slice(0, 6)
  const recommendedNextSteps = [
    `Revise ${recommendedNextTopics[0] ?? 'your weakest topic'} before your next mock interview.`,
    'Practice one stronger project explanation with clearer ownership and measurable outcomes.',
    session.interviewType === 'hr' ? 'Repeat an HR round and focus on concise, confident communication.' : `Run another ${String(session.interviewType ?? 'mixed')} session after revising the weak areas.`,
  ]

  const finalEvaluation = {
    overallScore,
    technicalScore: categoryAverage(technicalAnswers),
    hrScore: categoryAverage(hrAnswers),
    resumeProjectScore: categoryAverage(resumeAnswers),
    questionCoverage: {
      totalQuestions: questionItems.length,
      answeredQuestions: answerItems.length,
      skippedQuestions: answerItems.filter((item) => Boolean(item.skipped)).length,
    },
    confidenceSignals: {
      averageResponseTimeSec: answerItems.length ? Math.round(answerItems.reduce((sum, item) => sum + Number(item.responseTimeSec ?? 0), 0) / answerItems.length) : 0,
      averageConfidence: scoredAnswers.length ? Math.round(scoredAnswers.reduce((sum, item) => sum + Number((item.feedback as Record<string, unknown> | undefined)?.confidence ?? 0), 0) / scoredAnswers.length) : 0,
      completionRate: questionItems.length ? Math.round((answerItems.length / questionItems.length) * 100) : 0,
    },
    roleReadiness: {
      band: overallBand(overallScore),
      targetRole: String(session.targetRole ?? contextSummary.targetRole ?? ''),
      domain: String(session.domain ?? contextSummary.domain ?? ''),
    },
    strongAreas,
    weakAreas,
    improvementSuggestions: unique(answerItems.flatMap((item) => toStringArray((item.feedback as Record<string, unknown> | undefined)?.improvements))).slice(0, 8),
    recommendedNextTopics,
    answerFeedback,
    summary: overallScore >= 75
      ? 'You are showing strong readiness. Keep sharpening depth and examples.'
      : overallScore >= 60
        ? 'You are building solid readiness, but a few weak areas still need targeted practice.'
        : 'This session exposed important gaps. Focus on fundamentals, project clarity, and structured answers before the next round.',
  }

  session.status = 'completed'
  session.completedAt = new Date()
  session.currentQuestionIndex = Math.max(questionItems.length - 1, 0)
  session.score = overallScore
  session.evaluation = finalEvaluation
  session.feedback = finalEvaluation
  session.recommendedNextSteps = recommendedNextSteps
  await session.save()

  if (session.assignmentId) {
    await RecruiterAssessmentAssignment.updateOne(
      { _id: session.assignmentId as any },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          resultSummary: {
            roundType: String(session.interviewType ?? ''),
            questions: session.questions,
            answerSummary: answerFeedback,
            score: overallScore,
            summary: String(finalEvaluation.summary),
            strongAreas,
            weakAreas,
            recommendedNextSteps,
          },
        },
      },
    )
  }
  if (session.applicationId) {
    const relatedAssignments = await RecruiterAssessmentAssignment.find({ applicationId: session.applicationId as any }).lean<Array<Record<string, unknown>>>()
    const nextStatus = relatedAssignments.length && relatedAssignments.every((item) => ['completed', 'reviewed'].includes(String(item.status ?? '')))
      ? 'completed'
      : 'interview_assigned'
    await JobApplication.updateOne({ _id: session.applicationId }, { $set: { status: nextStatus, recruiterReviewStatus: nextStatus } })
  }

  const report = await Report.create({
    userId,
    reportType: 'Mock Interview',
    title: `${String(session.targetRole ?? 'Mock Interview')} Mock Interview Report`,
    summary: String(finalEvaluation.summary),
    payload: {
      sessionId: String(session._id),
      domain: session.domain,
      targetRole: session.targetRole,
      interviewType: session.interviewType,
      difficulty: session.difficulty,
      sessionMode: session.sessionMode,
      assessmentMode: session.assessmentMode,
      score: overallScore,
      ...finalEvaluation,
      createdAt: new Date().toISOString(),
    },
  })
  void reminderService.sendReportReadyNotification({
    userId,
    reportType: 'Mock Interview Result Report',
    title: String(report.title ?? `${String(session.targetRole ?? 'Mock Interview')} Mock Interview Report`),
    summary: String(report.summary ?? ''),
    actionPath: '/student/mock-interview',
    contextKey: `report:${String(report._id)}`,
  }).catch((error) => console.error('[reminders] failed to send mock interview email', error))

  res.json({
    success: true,
    data: {
      sessionId: String(session._id),
      evaluation: finalEvaluation,
      recommendedNextSteps,
    },
  })
}

export const listMockInterviewSessions = async (req: Request, res: Response): Promise<void> => {
  const sessions = await MockInterview.find({ userId: req.user?.userId }).sort({ createdAt: -1 }).limit(20).lean<Array<Record<string, unknown>>>()
  res.json({ success: true, data: sessions.map(summarizeSessionHistory) })
}

export const getMockInterviewSession = async (req: Request, res: Response): Promise<void> => {
  const session = await MockInterview.findOne({ _id: req.params.sessionId, userId: req.user?.userId }).lean<Record<string, unknown>>()
  if (!session) {
    res.status(404).json({ success: false, message: 'Mock interview session not found.' })
    return
  }
  res.json({ success: true, data: session })
}
