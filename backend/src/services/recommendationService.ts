import { env } from '../config/env'
import { Profile, Resume, SavedJobDescription } from '../models/CoreModels'
import { defaultRolesForDomain, detectLikelyDomains, domainLabel, isDomainKey, type DomainKey } from './domainService'

type LanguagePreference = 'english' | 'hindi' | 'both'
type SkillPriority = 'high' | 'medium' | 'optional'
type GapType = 'matched' | 'missing_required' | 'weak_required' | 'partial_match' | 'missing_optional'
type RecommendationType = 'concept' | 'project' | 'interview' | 'revision'
type RecommendationIntent = 'concept learning' | 'hands-on project' | 'interview preparation' | 'revision or quick recap'
type RecommendationInput = {
  userId: string
  resumeId?: string
  language: LanguagePreference
  targetRole?: string
  preferredLocation?: string
  jobDescriptionText?: string
  jobDescriptionId?: string
  selectedDomain?: DomainKey | ''
}

type ParsedJob = {
  jobRole: string
  experienceLevel: string
  requiredSkills: string[]
  optionalSkills: string[]
  toolsFrameworksTechnologies: string[]
}

type CandidateProfile = {
  skills: string[]
  projects: string[]
  experience: string[]
  education: string[]
  certifications: string[]
  preferredRole: string
}

type SkillGap = {
  skill: string
  gapType: GapType
  priority: SkillPriority
  reason: string
}

type RecommendedVideo = {
  topic: string
  intent: RecommendationIntent
  searchQuery: string
  selectedVideoId: string
  selectedVideoTitle: string
  embedUrl: string
  watchUrl: string
  youtubeSearchUrl: string
  topicName: string
  weakOrMissingSkill: string
  videoTitle: string
  channelName: string
  language: 'Hindi' | 'English' | 'Both'
  videoLink: string
  embedLink: string
  reasonForRecommendation: string
  recommendationType: RecommendationType
  recommendationIntent: RecommendationIntent
  difficultyLevel: 'Beginner' | 'Intermediate' | 'Advanced'
  priorityLevel: SkillPriority
  relevanceScore: number
  isEmbeddable: boolean
  scoreBreakdown: Record<string, number>
  selectionReason: string
  auditLog: {
    topic: string
    intent: RecommendationIntent
    finalSearchQuery: string
    selectedVideoTitle: string
    selectedVideoId: string
    reasonSelected: string
    scoreBreakdown: Record<string, number>
  }
}

type GroupedRecommendations = {
  topicName: string
  weakOrMissingSkill: string
  priorityLevel: SkillPriority
  gapType: GapType
  whyThisTopicMatters: string
  videos: RecommendedVideo[]
}

type JobRecommendation = {
  jobTitle: string
  companyName: string
  platformName: string
  location: string
  isPreferredLocationMatch: boolean
  recommendationSection: 'preferred_location' | 'other_locations'
  applyLink: string
  fitScore: number
  matchedSkills: string[]
  missingSkills: string[]
  reasonForRecommendation: string
  suggestedImprovementsBeforeApplying: string[]
}

type ReadinessCategory = 'ready_to_apply' | 'near_match' | 'recommended_to_study'

type CareerFieldDefinition = {
  name: string
  key: string
  domain: DomainKey
  coreSkills: string[]
  supportSkills: string[]
  projectKeywords: string[]
  relatedTitles: string[]
}

type CareerFieldRecommendation = {
  fieldName: string
  fieldKey: string
  fitScore: number
  fitLevel: 'Strong' | 'Moderate' | 'Emerging'
  readinessCategory: ReadinessCategory
  reasonForRecommendation: string
  matchedSkills: string[]
  missingSkills: string[]
  supportingSignals: string[]
  suggestedImprovements: string[]
  recommendedNextSteps: string[]
  projectIdeas: string[]
  suggestedTopicsToStudy: string[]
}

type CareerFieldJobGroup = {
  fieldName: string
  fieldKey: string
  domain: DomainKey
  readinessCategory: ReadinessCategory
  jobs: JobRecommendation[]
}

type DomainDefinition = {
  key: DomainKey
  label: string
  degreeKeywords: string[]
  skillKeywords: string[]
  projectKeywords: string[]
  preferredRoleKeywords: string[]
  fallbackRoles: string[]
}

const skillAliases: Record<string, string[]> = {
  javascript: ['js', 'javascript', 'ecmascript'],
  typescript: ['typescript', 'ts'],
  html: ['html', 'html5'],
  css: ['css', 'css3'],
  react: ['react', 'reactjs', 'react.js'],
  redux: ['redux', '@reduxjs/toolkit', 'rtk'],
  nodejs: ['node', 'nodejs', 'node.js'],
  express: ['express', 'expressjs', 'express.js'],
  mongodb: ['mongodb', 'mongo', 'mongo db'],
  mysql: ['mysql'],
  postgresql: ['postgres', 'postgresql'],
  sql: ['sql'],
  rest: ['rest', 'rest api', 'restful api'],
  graphql: ['graphql'],
  docker: ['docker'],
  kubernetes: ['kubernetes', 'k8s'],
  aws: ['aws', 'amazon web services'],
  git: ['git', 'github', 'gitlab'],
  testing: ['testing', 'unit test', 'jest', 'vitest'],
  java: ['java'],
  springboot: ['spring', 'spring boot', 'springboot'],
  python: ['python'],
  dsa: ['data structures', 'algorithms', 'dsa'],
  jwt: ['jwt', 'json web token', 'authentication'],
  tailwind: ['tailwind', 'tailwindcss'],
  excel: ['excel', 'spreadsheets', 'microsoft excel'],
  powerbi: ['power bi', 'powerbi'],
  tableau: ['tableau'],
  statistics: ['statistics', 'statistical analysis'],
  tally: ['tally'],
  gst: ['gst', 'goods and services tax'],
  taxation: ['taxation', 'tax'],
  accounting: ['accounting', 'accounts', 'bookkeeping'],
  auditing: ['auditing', 'audit'],
  banking: ['banking', 'bank operations'],
  autocad: ['autocad', 'cad'],
  solidworks: ['solidworks'],
  machine_design: ['machine design', 'mechanical design'],
  manufacturing: ['manufacturing', 'production'],
  maintenance: ['maintenance', 'preventive maintenance'],
  quality: ['quality', 'quality control', 'quality assurance'],
  revit: ['revit'],
  staad: ['staad', 'staad pro'],
  quantity_surveying: ['quantity surveying', 'quantity surveyor', 'estimation and costing'],
  site_supervision: ['site supervision', 'site engineer', 'construction supervision'],
  estimation: ['estimation', 'cost estimation', 'quantity estimation'],
  plc: ['plc', 'programmable logic controller'],
  matlab: ['matlab'],
  wiring: ['wiring', 'electrical wiring'],
  control_panel: ['control panel', 'panel wiring'],
  circuit_analysis: ['circuit analysis', 'electrical circuits'],
  embedded_systems: ['embedded systems', 'embedded'],
  microcontroller: ['microcontroller', '8051', 'avr', 'pic'],
  arduino: ['arduino'],
  pcb: ['pcb', 'printed circuit board'],
  vlsi: ['vlsi'],
  recruitment: ['recruitment', 'talent acquisition', 'sourcing'],
  payroll: ['payroll'],
  onboarding: ['onboarding'],
  employee_engagement: ['employee engagement', 'employee relations'],
  labour_law: ['labour law', 'labor law', 'hr compliance'],
  figma: ['figma'],
  photoshop: ['photoshop', 'adobe photoshop'],
  illustrator: ['illustrator', 'adobe illustrator'],
  wireframing: ['wireframe', 'wireframing'],
  prototyping: ['prototype', 'prototyping'],
  typography: ['typography'],
  patient_care: ['patient care'],
  medical_coding: ['medical coding'],
  emr: ['emr', 'electronic medical record', 'ehr'],
  phlebotomy: ['phlebotomy'],
  clinical_documentation: ['clinical documentation'],
  healthcare_operations: ['healthcare operations', 'hospital operations'],
  seo: ['seo', 'search engine optimization'],
  sem: ['sem', 'search engine marketing'],
  content_writing: ['content writing', 'copywriting', 'content strategy'],
  branding: ['branding', 'brand management'],
  campaign_management: ['campaign management', 'campaign analysis', 'campaign'],
  social_media: ['social media', 'social marketing'],
  communication: ['communication', 'verbal communication'],
  teamwork: ['teamwork', 'collaboration'],
  problem_solving: ['problem solving', 'critical thinking'],
}

const trustedChannels = new Set([
  'freeCodeCamp.org',
  'Traversy Media',
  'CodeWithHarry',
  'Hitesh Choudhary',
  'Piyush Garg',
  'Fireship',
  'Programming with Mosh',
  'Telusko',
  'Java Guides',
  'Apna College',
])

const roleSkillTemplates: Record<string, string[]> = {
  frontend: ['javascript', 'react', 'html', 'css', 'typescript', 'redux', 'tailwind', 'testing', 'git'],
  backend: ['nodejs', 'express', 'rest', 'mongodb', 'sql', 'jwt', 'testing', 'docker', 'git'],
  fullstack: ['javascript', 'react', 'nodejs', 'express', 'mongodb', 'sql', 'rest', 'git'],
  'full stack': ['javascript', 'react', 'nodejs', 'express', 'mongodb', 'sql', 'rest', 'git'],
  java: ['java', 'springboot', 'sql', 'rest', 'testing', 'git'],
  data: ['python', 'sql', 'excel', 'powerbi', 'tableau', 'statistics'],
  devops: ['docker', 'kubernetes', 'aws', 'git'],
  software: ['javascript', 'python', 'java', 'sql', 'git', 'dsa', 'testing'],
  developer: ['javascript', 'python', 'java', 'sql', 'git', 'dsa', 'testing'],
  finance: ['accounting', 'excel', 'gst', 'taxation', 'auditing', 'tally'],
  commerce: ['accounting', 'excel', 'gst', 'taxation', 'auditing', 'tally'],
  accountant: ['accounting', 'excel', 'gst', 'taxation', 'tally'],
  banking: ['banking', 'excel', 'accounting', 'communication'],
  mechanical: ['autocad', 'solidworks', 'machine_design', 'manufacturing', 'maintenance', 'quality'],
  production: ['manufacturing', 'quality', 'maintenance', 'autocad'],
  civil: ['autocad', 'revit', 'staad', 'quantity_surveying', 'site_supervision', 'estimation'],
  site: ['autocad', 'quantity_surveying', 'site_supervision', 'estimation'],
  electrical: ['plc', 'matlab', 'wiring', 'control_panel', 'circuit_analysis', 'maintenance'],
  electronics: ['embedded_systems', 'microcontroller', 'arduino', 'pcb', 'vlsi', 'circuit_analysis'],
  marketing: ['seo', 'sem', 'content_writing', 'branding', 'campaign_management', 'social_media'],
  hr: ['communication', 'teamwork', 'excel'],
  recruitment: ['recruitment', 'communication', 'excel', 'onboarding', 'employee_engagement'],
  design: ['figma', 'photoshop', 'illustrator', 'wireframing', 'prototyping', 'typography'],
  healthcare: ['patient_care', 'medical_coding', 'clinical_documentation', 'emr', 'healthcare_operations'],
  fresher: ['communication', 'teamwork', 'problem_solving', 'excel'],
}

const genericRoleSkills = ['communication', 'teamwork', 'problem_solving', 'excel']

const genericRoleTitlesByDomain: Record<DomainKey, string[]> = {
  it_software: ['Software Support Engineer', 'QA Tester', 'Junior Developer'],
  data_analytics: ['Data Analyst', 'Reporting Analyst', 'Junior Analyst'],
  commerce_finance: ['Accounts Executive', 'Finance Analyst', 'Tax Assistant'],
  mechanical: ['Production Engineer', 'Design Engineer Trainee', 'Maintenance Engineer'],
  civil: ['Site Engineer Trainee', 'Quantity Surveyor', 'Civil CAD Trainee'],
  electrical: ['Electrical Maintenance Trainee', 'Electrical Design Trainee', 'Control Panel Trainee'],
  electronics: ['Embedded Systems Trainee', 'Electronics Technician', 'Hardware Support Engineer'],
  marketing: ['Digital Marketing Intern', 'SEO Executive', 'Content Marketing Assistant'],
  hr: ['HR Assistant', 'Talent Acquisition Coordinator', 'HR Intern'],
  design: ['Graphic Designer Intern', 'UI/UX Designer Trainee', 'Visual Design Assistant'],
  healthcare: ['Medical Lab Assistant', 'Healthcare Operations Trainee', 'Clinical Support Associate'],
  general_fresher: ['Graduate Trainee', 'Operations Trainee', 'General Fresher Role'],
}

const careerFieldDefinitions: CareerFieldDefinition[] = [
  {
    key: 'frontend_developer',
    name: 'Frontend Developer',
    domain: 'it_software',
    coreSkills: ['javascript', 'react', 'html', 'css'],
    supportSkills: ['typescript', 'redux', 'tailwind', 'testing', 'git'],
    projectKeywords: ['ui', 'dashboard', 'responsive', 'frontend', 'landing page', 'react app'],
    relatedTitles: ['Frontend Developer', 'UI Developer', 'React Developer'],
  },
  {
    key: 'backend_developer',
    name: 'Backend Developer',
    domain: 'it_software',
    coreSkills: ['nodejs', 'express', 'rest', 'sql'],
    supportSkills: ['mongodb', 'postgresql', 'jwt', 'docker', 'testing', 'git'],
    projectKeywords: ['api', 'server', 'authentication', 'backend', 'database'],
    relatedTitles: ['Backend Developer', 'Node.js Developer', 'API Developer'],
  },
  {
    key: 'full_stack_developer',
    name: 'Full Stack Developer',
    domain: 'it_software',
    coreSkills: ['javascript', 'react', 'nodejs', 'express'],
    supportSkills: ['mongodb', 'sql', 'rest', 'typescript', 'git', 'testing'],
    projectKeywords: ['full stack', 'mern', 'end-to-end', 'authentication', 'deployment'],
    relatedTitles: ['Full Stack Developer', 'MERN Stack Developer', 'Software Engineer'],
  },
  {
    key: 'data_analyst',
    name: 'Data Analyst',
    domain: 'data_analytics',
    coreSkills: ['excel', 'sql', 'powerbi'],
    supportSkills: ['python', 'tableau', 'statistics'],
    projectKeywords: ['analysis', 'dashboard', 'data', 'report', 'visualization', 'excel'],
    relatedTitles: ['Data Analyst', 'Junior Data Analyst', 'Reporting Analyst'],
  },
  {
    key: 'reporting_analyst',
    name: 'Reporting Analyst',
    domain: 'data_analytics',
    coreSkills: ['excel', 'powerbi'],
    supportSkills: ['sql', 'tableau', 'communication'],
    projectKeywords: ['dashboard', 'report', 'analysis', 'visualization'],
    relatedTitles: ['Reporting Analyst', 'BI Analyst', 'Junior Analyst'],
  },
  {
    key: 'qa_tester',
    name: 'QA Tester',
    domain: 'it_software',
    coreSkills: ['testing', 'javascript'],
    supportSkills: ['html', 'css', 'git'],
    projectKeywords: ['test', 'bug', 'quality', 'automation', 'validation'],
    relatedTitles: ['QA Tester', 'Software Tester', 'Quality Analyst'],
  },
  {
    key: 'java_developer',
    name: 'Java Developer',
    domain: 'it_software',
    coreSkills: ['java', 'sql'],
    supportSkills: ['springboot', 'rest', 'git', 'testing'],
    projectKeywords: ['java', 'spring', 'backend', 'api'],
    relatedTitles: ['Java Developer', 'Spring Boot Developer', 'Software Developer Fresher'],
  },
  {
    key: 'python_developer',
    name: 'Python Developer',
    domain: 'it_software',
    coreSkills: ['python', 'sql'],
    supportSkills: ['rest', 'git', 'testing'],
    projectKeywords: ['python', 'automation', 'script', 'data'],
    relatedTitles: ['Python Developer', 'Junior Python Developer', 'Automation Developer'],
  },
  {
    key: 'ui_ux_support',
    name: 'UI/UX Support Role',
    domain: 'it_software',
    coreSkills: ['html', 'css'],
    supportSkills: ['javascript', 'react', 'git'],
    projectKeywords: ['ui', 'design', 'prototype', 'wireframe', 'user experience'],
    relatedTitles: ['UI Support', 'Web Designer Support', 'UI Developer Intern'],
  },
  {
    key: 'software_developer_fresher',
    name: 'Software Developer Fresher',
    domain: 'it_software',
    coreSkills: ['javascript', 'sql', 'git'],
    supportSkills: ['python', 'java', 'dsa', 'testing'],
    projectKeywords: ['project', 'application', 'system', 'developer'],
    relatedTitles: ['Software Developer Fresher', 'Associate Software Engineer', 'Graduate Engineer Trainee'],
  },
  {
    key: 'technical_internship_roles',
    name: 'Internship-Oriented Technical Roles',
    domain: 'general_fresher',
    coreSkills: ['javascript', 'html', 'css'],
    supportSkills: ['react', 'python', 'java', 'git', 'sql'],
    projectKeywords: ['intern', 'college project', 'student', 'portfolio'],
    relatedTitles: ['Software Intern', 'Web Development Intern', 'Technical Intern'],
  },
  {
    key: 'accounts_executive',
    name: 'Accounts Executive',
    domain: 'commerce_finance',
    coreSkills: ['accounting', 'excel', 'tally'],
    supportSkills: ['gst', 'taxation', 'auditing', 'communication'],
    projectKeywords: ['account', 'ledger', 'gst', 'tax', 'finance'],
    relatedTitles: ['Accounts Executive', 'Accountant', 'Accounts Assistant'],
  },
  {
    key: 'finance_analyst',
    name: 'Finance Analyst',
    domain: 'commerce_finance',
    coreSkills: ['excel', 'accounting', 'analysis'],
    supportSkills: ['taxation', 'auditing', 'banking', 'communication'],
    projectKeywords: ['financial report', 'analysis', 'account', 'banking'],
    relatedTitles: ['Finance Analyst', 'Banking Operations Trainee', 'Financial Analyst'],
  },
  {
    key: 'banking_trainee',
    name: 'Banking Trainee',
    domain: 'commerce_finance',
    coreSkills: ['banking', 'excel', 'communication'],
    supportSkills: ['accounting', 'auditing', 'problem_solving'],
    projectKeywords: ['banking', 'customer service', 'finance', 'report'],
    relatedTitles: ['Banking Trainee', 'Banking Operations Trainee', 'Relationship Support Associate'],
  },
  {
    key: 'production_engineer',
    name: 'Production Engineer',
    domain: 'mechanical',
    coreSkills: ['manufacturing', 'quality', 'maintenance'],
    supportSkills: ['autocad', 'solidworks', 'machine_design'],
    projectKeywords: ['production', 'manufacturing', 'maintenance', 'machine'],
    relatedTitles: ['Production Engineer', 'Maintenance Engineer', 'Quality Engineer'],
  },
  {
    key: 'design_engineer_trainee',
    name: 'Design Engineer Trainee',
    domain: 'mechanical',
    coreSkills: ['autocad', 'solidworks'],
    supportSkills: ['machine_design', 'manufacturing', 'quality'],
    projectKeywords: ['cad', 'design', 'solidworks', 'machine'],
    relatedTitles: ['Design Engineer Trainee', 'CAD Engineer', 'Mechanical Design Engineer'],
  },
  {
    key: 'site_engineer_trainee',
    name: 'Site Engineer Trainee',
    domain: 'civil',
    coreSkills: ['site_supervision', 'estimation'],
    supportSkills: ['autocad', 'quantity_surveying', 'quality'],
    projectKeywords: ['site', 'construction', 'survey', 'estimation'],
    relatedTitles: ['Site Engineer Trainee', 'Site Engineer', 'Civil Engineer Trainee'],
  },
  {
    key: 'quantity_surveyor',
    name: 'Quantity Surveyor',
    domain: 'civil',
    coreSkills: ['quantity_surveying', 'estimation'],
    supportSkills: ['autocad', 'excel', 'communication'],
    projectKeywords: ['quantity', 'costing', 'estimation', 'construction'],
    relatedTitles: ['Quantity Surveyor', 'Estimation Engineer', 'Costing Trainee'],
  },
  {
    key: 'electrical_maintenance_trainee',
    name: 'Electrical Maintenance Trainee',
    domain: 'electrical',
    coreSkills: ['maintenance', 'wiring', 'circuit_analysis'],
    supportSkills: ['plc', 'control_panel', 'matlab'],
    projectKeywords: ['electrical', 'maintenance', 'panel', 'wiring'],
    relatedTitles: ['Electrical Maintenance Trainee', 'Electrical Engineer Trainee', 'Maintenance Engineer'],
  },
  {
    key: 'electrical_design_trainee',
    name: 'Electrical Design Trainee',
    domain: 'electrical',
    coreSkills: ['matlab', 'circuit_analysis'],
    supportSkills: ['control_panel', 'wiring', 'plc'],
    projectKeywords: ['circuit', 'design', 'electrical', 'simulation'],
    relatedTitles: ['Electrical Design Trainee', 'Electrical Design Engineer', 'Control Panel Trainee'],
  },
  {
    key: 'embedded_systems_trainee',
    name: 'Embedded Systems Trainee',
    domain: 'electronics',
    coreSkills: ['embedded_systems', 'microcontroller'],
    supportSkills: ['arduino', 'pcb', 'circuit_analysis'],
    projectKeywords: ['embedded', 'microcontroller', 'sensor', 'electronics'],
    relatedTitles: ['Embedded Systems Trainee', 'Embedded Engineer Intern', 'Embedded Developer Trainee'],
  },
  {
    key: 'electronics_technician',
    name: 'Electronics Technician',
    domain: 'electronics',
    coreSkills: ['circuit_analysis', 'pcb'],
    supportSkills: ['microcontroller', 'arduino', 'quality'],
    projectKeywords: ['pcb', 'circuit', 'electronics', 'testing'],
    relatedTitles: ['Electronics Technician', 'Hardware Technician', 'Electronics Support Engineer'],
  },
  {
    key: 'digital_marketing_intern',
    name: 'Digital Marketing Intern',
    domain: 'marketing',
    coreSkills: ['seo', 'content_writing', 'social_media'],
    supportSkills: ['sem', 'branding', 'campaign_management', 'communication'],
    projectKeywords: ['campaign', 'seo', 'content', 'social media', 'brand'],
    relatedTitles: ['Digital Marketing Intern', 'SEO Executive', 'Marketing Assistant'],
  },
  {
    key: 'content_marketing_assistant',
    name: 'Content Marketing Assistant',
    domain: 'marketing',
    coreSkills: ['content_writing', 'branding'],
    supportSkills: ['seo', 'campaign_management', 'social_media', 'communication'],
    projectKeywords: ['content', 'branding', 'campaign', 'marketing'],
    relatedTitles: ['Content Marketing Assistant', 'Content Executive', 'Brand Support Executive'],
  },
  {
    key: 'hr_assistant',
    name: 'HR Assistant',
    domain: 'hr',
    coreSkills: ['communication', 'recruitment', 'onboarding'],
    supportSkills: ['excel', 'employee_engagement', 'teamwork'],
    projectKeywords: ['recruitment', 'onboarding', 'employee', 'hr'],
    relatedTitles: ['HR Assistant', 'HR Intern', 'Talent Acquisition Coordinator'],
  },
  {
    key: 'talent_acquisition_coordinator',
    name: 'Talent Acquisition Coordinator',
    domain: 'hr',
    coreSkills: ['recruitment', 'communication'],
    supportSkills: ['excel', 'onboarding', 'employee_engagement'],
    projectKeywords: ['talent acquisition', 'recruitment', 'hiring'],
    relatedTitles: ['Talent Acquisition Coordinator', 'Recruitment Coordinator', 'Sourcing Associate'],
  },
  {
    key: 'graphic_designer_intern',
    name: 'Graphic Designer Intern',
    domain: 'design',
    coreSkills: ['photoshop', 'illustrator', 'typography'],
    supportSkills: ['figma', 'branding', 'communication'],
    projectKeywords: ['poster', 'brand', 'creative', 'design'],
    relatedTitles: ['Graphic Designer Intern', 'Graphic Design Assistant', 'Visual Design Intern'],
  },
  {
    key: 'ui_ux_designer_trainee',
    name: 'UI/UX Designer Trainee',
    domain: 'design',
    coreSkills: ['figma', 'wireframing', 'prototyping'],
    supportSkills: ['communication', 'typography', 'branding'],
    projectKeywords: ['wireframe', 'prototype', 'ui', 'ux', 'design system'],
    relatedTitles: ['UI/UX Designer Trainee', 'UI Designer Intern', 'UX Design Assistant'],
  },
  {
    key: 'medical_lab_assistant',
    name: 'Medical Lab Assistant',
    domain: 'healthcare',
    coreSkills: ['patient_care', 'clinical_documentation'],
    supportSkills: ['phlebotomy', 'communication', 'healthcare_operations'],
    projectKeywords: ['patient', 'clinical', 'lab', 'medical'],
    relatedTitles: ['Medical Lab Assistant', 'Lab Technician Trainee', 'Clinical Support Associate'],
  },
  {
    key: 'healthcare_operations_trainee',
    name: 'Healthcare Operations Trainee',
    domain: 'healthcare',
    coreSkills: ['healthcare_operations', 'communication'],
    supportSkills: ['emr', 'clinical_documentation', 'excel'],
    projectKeywords: ['hospital', 'operations', 'patient', 'medical'],
    relatedTitles: ['Healthcare Operations Trainee', 'Hospital Operations Trainee', 'Clinical Operations Assistant'],
  },
  {
    key: 'graduate_trainee',
    name: 'Graduate Trainee',
    domain: 'general_fresher',
    coreSkills: ['communication', 'teamwork'],
    supportSkills: ['problem_solving', 'excel'],
    projectKeywords: ['college project', 'internship', 'student'],
    relatedTitles: ['Graduate Trainee', 'Operations Trainee', 'Fresher'],
  },
]

const recommendationIntentLabel: Record<RecommendationType, RecommendationIntent> = {
  concept: 'concept learning',
  project: 'hands-on project',
  interview: 'interview preparation',
  revision: 'revision or quick recap',
}

const intentKeywordPatterns: Record<RecommendationType, RegExp> = {
  concept: /\b(tutorial|explained|beginner|beginners|complete guide|basics|fundamentals|full course|learn)\b/,
  project: /\b(build|project|clone|app|hands[- ]?on|real world|practical)\b/,
  interview: /\b(interview|viva|questions?|answers?|asked|preparation|hiring)\b/,
  revision: /\b(crash course|quick revision|revision|recap|cheat sheet|summary)\b/,
}

const conflictingIntentPatterns: Record<RecommendationType, RegExp> = {
  concept: /\b(interview|viva|questions?|answers?|project|clone)\b/,
  project: /\b(interview|viva|questions?|answers?|crash course)\b/,
  interview: /\b(tutorial|project|clone|crash course|full course)\b/,
  revision: /\b(project|clone|interview|viva)\b/,
}

const fallbackVideoBank: Record<string, Record<'Hindi' | 'English', Partial<Record<RecommendationType, { id: string; title: string; channel: string }>>>> = {
  javascript: {
    Hindi: {
      concept: { id: 'hKB-YGF14SY', title: 'JavaScript Tutorial in Hindi', channel: 'CodeWithHarry' },
      project: { id: 'hKB-YGF14SY', title: 'JavaScript Tutorial in Hindi', channel: 'CodeWithHarry' },
      interview: { id: 'hKB-YGF14SY', title: 'JavaScript Tutorial in Hindi', channel: 'CodeWithHarry' },
      revision: { id: 'hKB-YGF14SY', title: 'JavaScript Tutorial in Hindi', channel: 'CodeWithHarry' },
    },
    English: {
      concept: { id: 'PkZNo7MFNFg', title: 'JavaScript Full Course for Beginners', channel: 'freeCodeCamp.org' },
      project: { id: 'PkZNo7MFNFg', title: 'JavaScript Full Course for Beginners', channel: 'freeCodeCamp.org' },
      interview: { id: 'PkZNo7MFNFg', title: 'JavaScript Full Course for Beginners', channel: 'freeCodeCamp.org' },
      revision: { id: 'PkZNo7MFNFg', title: 'JavaScript Full Course for Beginners', channel: 'freeCodeCamp.org' },
    },
  },
  html: {
    Hindi: {
      concept: { id: 'BsDoLVMnmZs', title: 'HTML Tutorial for Beginners in Hindi', channel: 'CodeWithHarry' },
      project: { id: 'BsDoLVMnmZs', title: 'HTML Tutorial for Beginners in Hindi', channel: 'CodeWithHarry' },
      interview: { id: 'BsDoLVMnmZs', title: 'HTML Tutorial for Beginners in Hindi', channel: 'CodeWithHarry' },
      revision: { id: 'BsDoLVMnmZs', title: 'HTML Tutorial for Beginners in Hindi', channel: 'CodeWithHarry' },
    },
    English: {
      concept: { id: 'pQN-pnXPaVg', title: 'HTML Full Course', channel: 'freeCodeCamp.org' },
      project: { id: 'pQN-pnXPaVg', title: 'HTML Full Course', channel: 'freeCodeCamp.org' },
      interview: { id: 'pQN-pnXPaVg', title: 'HTML Full Course', channel: 'freeCodeCamp.org' },
      revision: { id: 'pQN-pnXPaVg', title: 'HTML Full Course', channel: 'freeCodeCamp.org' },
    },
  },
  css: {
    Hindi: {
      concept: { id: 'Edsxf_NBFrw', title: 'CSS Tutorial in Hindi', channel: 'CodeWithHarry' },
      project: { id: 'Edsxf_NBFrw', title: 'CSS Tutorial in Hindi', channel: 'CodeWithHarry' },
      interview: { id: 'Edsxf_NBFrw', title: 'CSS Tutorial in Hindi', channel: 'CodeWithHarry' },
      revision: { id: 'Edsxf_NBFrw', title: 'CSS Tutorial in Hindi', channel: 'CodeWithHarry' },
    },
    English: {
      concept: { id: 'OXGznpKZ_sA', title: 'CSS Full Course for Beginners', channel: 'freeCodeCamp.org' },
      project: { id: 'OXGznpKZ_sA', title: 'CSS Full Course for Beginners', channel: 'freeCodeCamp.org' },
      interview: { id: 'OXGznpKZ_sA', title: 'CSS Full Course for Beginners', channel: 'freeCodeCamp.org' },
      revision: { id: 'OXGznpKZ_sA', title: 'CSS Full Course for Beginners', channel: 'freeCodeCamp.org' },
    },
  },
  react: {
    Hindi: {
      concept: { id: 'RGKi6LSPDLU', title: 'React JS Full Course in Hindi', channel: 'CodeWithHarry' },
      project: { id: 'FxgM9k1rg0Q', title: 'React Project Tutorial in Hindi', channel: 'CodeWithHarry' },
      interview: { id: 'q8EevlEpQ2A', title: 'React Interview Questions', channel: 'RoadsideCoder' },
    },
    English: {
      concept: { id: 'bMknfKXIFA8', title: 'React Course for Beginners', channel: 'freeCodeCamp.org' },
      project: { id: 'F627pKNUCVQ', title: 'React Project Tutorial', channel: 'freeCodeCamp.org' },
      interview: { id: 'Tn6-PIqc4UM', title: 'React Interview Questions', channel: 'codedamn' },
      revision: { id: 'w7ejDZ8SWv8', title: 'React JS Crash Course', channel: 'Traversy Media' },
    },
  },
  nodejs: {
    Hindi: {
      concept: { id: 'BLl32FvcdVM', title: 'Node.js Tutorial in Hindi', channel: 'CodeWithHarry' },
      project: { id: '7fjOw8ApZ1I', title: 'Node.js Backend Project in Hindi', channel: 'Piyush Garg' },
    },
    English: {
      concept: { id: 'Oe421EPjeBE', title: 'Node.js and Express.js Full Course', channel: 'freeCodeCamp.org' },
      project: { id: 'qwfE7fSVaZM', title: 'Node.js Express MongoDB Project', channel: 'freeCodeCamp.org' },
    },
  },
  mongodb: {
    Hindi: {
      concept: { id: 'ofme2o29ngU', title: 'MongoDB Tutorial in Hindi', channel: 'CodeWithHarry' },
    },
    English: {
      concept: { id: 'c2M-rlkkT5o', title: 'MongoDB Full Course', channel: 'freeCodeCamp.org' },
    },
  },
  java: {
    Hindi: {
      concept: { id: 'ntLJmHOJ0ME', title: 'Java Tutorial for Beginners in Hindi', channel: 'CodeWithHarry' },
    },
    English: {
      concept: { id: 'eIrMbAQSU34', title: 'Java Tutorial for Beginners', channel: 'Programming with Mosh' },
    },
  },
  springboot: {
    Hindi: {
      concept: { id: '35EQXmHKZYs', title: 'Spring Boot Tutorial in Hindi', channel: 'Learn Code With Durgesh' },
    },
    English: {
      concept: { id: 'vtPkZShrvXQ', title: 'Spring Boot Tutorial for Beginners', channel: 'Java Guides' },
    },
  },
  python: {
    Hindi: {
      concept: { id: 'gfDE2a7MKjA', title: 'Python Tutorial in Hindi', channel: 'CodeWithHarry' },
    },
    English: {
      concept: { id: 'rfscVS0vtbw', title: 'Python for Beginners', channel: 'freeCodeCamp.org' },
    },
  },
}

const normalize = (text: string): string => text.toLowerCase().replace(/\s+/g, ' ').trim()
const unique = (items: string[]): string[] => [...new Set(items.map((item) => item.trim()).filter(Boolean))]
const countKeywordMatches = (text: string, keywords: string[]): number =>
  keywords.reduce((count, keyword) => (text.includes(normalize(keyword)) ? count + 1 : count), 0)

const canonicalSkill = (raw: string): string => {
  const key = normalize(raw)
  for (const [canonical, aliases] of Object.entries(skillAliases)) {
    if (aliases.some((alias) => key.includes(alias))) return canonical
  }
  return key
}

const includesSkill = (text: string, skill: string): boolean => {
  const t = normalize(text)
  const aliases = skillAliases[skill] ?? [skill]
  return aliases.some((alias) => t.includes(alias))
}

const topicWords = (skill: string): string[] => unique((skillAliases[skill] ?? [skill]).flatMap((alias) => normalize(alias).split(/[^a-z0-9+#.]+/)).filter((word) => word.length > 1))

const hasCloseTopicMatch = (text: string, skill: string): boolean => {
  if (includesSkill(text, skill)) return true
  const normalizedText = normalize(text)
  const words = topicWords(skill)
  return words.length > 0 && words.some((word) => normalizedText.includes(word))
}

const extractSkillsFromText = (text: string): string[] => {
  const lower = normalize(text)
  return unique(Object.keys(skillAliases).filter((skill) => includesSkill(lower, skill)))
}

const detectPrimaryDomain = (
  profile: Record<string, unknown>,
  resume: Record<string, unknown>,
  candidate: CandidateProfile,
  preferredRole: string,
  selectedDomain?: DomainKey | '',
): {
  domain: DomainKey
  label: string
  confidence: number
  scores: Array<{ domain: DomainKey; label: string; score: number }>
  fallbackSuggestions: string[]
  topDomains: Array<{ key: DomainKey; label: string; confidence: number; reasons: string[] }>
  confirmed: boolean
} => {
  const storedDetected = toStringArray((profile.detectedDomains as Array<Record<string, unknown>> | undefined)?.map((item) => String(item.key ?? '')))
  const detected = detectLikelyDomains({
    preferredRole,
    profile,
    resume,
    extracted: {
      skills: candidate.skills,
      projects: candidate.projects,
      experience: candidate.experience,
      certifications: candidate.certifications,
      education: candidate.education,
    },
  })
  const scores = detected.map((item) => ({ domain: item.key, label: item.label, score: item.score }))
  const recommended = detected[0]?.key === 'general_fresher' || detected[0]?.band === 'low'
    ? { key: 'general_fresher' as DomainKey, label: domainLabel('general_fresher'), confidence: detected[0]?.confidence ?? 35 }
    : { key: detected[0].key, label: detected[0].label, confidence: detected[0].confidence }
  const explicitDomain = isDomainKey(selectedDomain)
    ? selectedDomain
    : isDomainKey(profile.confirmedDomain)
      ? profile.confirmedDomain
      : ''
  const chosenDomain = explicitDomain || recommended.key
  const chosenLabel = domainLabel(chosenDomain as DomainKey)

  return {
    domain: chosenDomain as DomainKey,
    label: chosenLabel,
    confidence: explicitDomain ? 96 : recommended.confidence,
    scores: scores.slice(0, 4),
    fallbackSuggestions: detected
      .filter((item) => item.key !== chosenDomain && item.key !== 'general_fresher')
      .slice(0, 3)
      .map((item) => item.label),
    topDomains: detected.slice(0, 3).map((item) => ({
      key: item.key,
      label: item.label,
      confidence: item.confidence,
      reasons: item.reasons,
    })),
    confirmed: Boolean(explicitDomain || storedDetected.includes(chosenDomain)),
  }
}

const parseExperienceLevel = (text: string): string => {
  const lower = normalize(text)
  if (/senior|5\+|6\+|7\+|8\+|lead|architect/.test(lower)) return 'advanced'
  if (/junior|entry|fresher|0-1|0-2|1-2/.test(lower)) return 'beginner'
  return 'intermediate'
}

const parseJobDescription = (jobDescription: string, fallbackRole: string, fallbackDomain: DomainKey): ParsedJob => {
  const lines = jobDescription.split('\n').map((line) => line.trim()).filter(Boolean)
  const requiredHints = ['required', 'must have', 'mandatory', 'responsibilities', 'requirements']
  const optionalHints = ['nice to have', 'preferred', 'good to have', 'plus', 'bonus']
  const requiredChunks: string[] = []
  const optionalChunks: string[] = []

  lines.forEach((line) => {
    const lower = normalize(line)
    if (requiredHints.some((hint) => lower.includes(hint))) requiredChunks.push(line)
    if (optionalHints.some((hint) => lower.includes(hint))) optionalChunks.push(line)
  })

  const allSkills = extractSkillsFromText(jobDescription)
  const requiredSkills = unique(extractSkillsFromText(requiredChunks.join(' ')))
  const optionalSkills = unique(extractSkillsFromText(optionalChunks.join(' '))).filter((skill) => !requiredSkills.includes(skill))
  const roleSkills = fallbackRole ? skillsForRole(fallbackRole) : []
  const domainSkills = skillsForDomain(fallbackDomain)
  const fallbackSkills = unique(roleSkills.length ? roleSkills : domainSkills)
  const hasExplicitRequirements = requiredSkills.length > 0 || optionalSkills.length > 0
  const inferredRequired = requiredSkills.length
    ? requiredSkills
    : allSkills.length
      ? allSkills.slice(0, 3)
      : fallbackSkills.slice(0, 3)
  const inferredOptional = optionalSkills.length
    ? optionalSkills
    : allSkills.length
      ? allSkills.slice(3, 8).filter((skill) => !inferredRequired.includes(skill))
      : fallbackSkills.slice(3, 6).filter((skill) => !inferredRequired.includes(skill))

  return {
    jobRole: fallbackRole || 'Selected Role',
    experienceLevel: parseExperienceLevel(jobDescription),
    requiredSkills: inferredRequired,
    optionalSkills: hasExplicitRequirements ? optionalSkills : inferredOptional,
    toolsFrameworksTechnologies: unique([...allSkills, ...inferredRequired, ...(hasExplicitRequirements ? optionalSkills : inferredOptional)]),
  }
}

const skillsForRole = (role: string): string[] => {
  const lower = normalize(role)
  const matches = Object.entries(roleSkillTemplates)
    .filter(([key]) => lower.includes(key))
    .flatMap(([, skills]) => skills)
  return unique(matches.length ? matches : genericRoleSkills)
}

const skillsForDomain = (domain: DomainKey): string[] => {
  const defaultRoles = defaultRolesForDomain(domain)
  const roleSkills = unique(defaultRoles.flatMap((role) => skillsForRole(role)))
  return roleSkills.length ? roleSkills : genericRoleSkills
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : []

const toSkillSet = (items: string[]): Set<string> => new Set(items.map((item) => canonicalSkill(item)))

const compareSkillLists = (requiredSkills: string[], candidateSkills: string[]) => {
  const candidateSet = toSkillSet(candidateSkills)
  const normalizedRequired = unique(requiredSkills.map(canonicalSkill))
  return {
    matched: normalizedRequired.filter((skill) => candidateSet.has(skill)),
    missing: normalizedRequired.filter((skill) => !candidateSet.has(skill)),
  }
}

const calculateFitScore = (requiredSkills: string[], candidateSkills: string[], profileCompletion: number): number => {
  if (!requiredSkills.length) return Math.max(55, Math.min(95, profileCompletion || 65))
  const { matched } = compareSkillLists(requiredSkills, candidateSkills)
  const skillRatio = matched.length / requiredSkills.length
  return Math.min(98, Math.max(35, Math.round(skillRatio * 75 + Math.min(profileCompletion || 55, 100) * 0.25)))
}

const defaultJobHubs = ['Remote', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Delhi NCR', 'Mumbai', 'Kolkata', 'India']

const buildLocationPlan = (preferredLocation: string): { primary: string; alternatives: string[] } => {
  const cleanedPreferred = preferredLocation.trim()
  const primary = cleanedPreferred || 'India'
  const normalizedPrimary = normalize(primary)
  const alternatives = unique(
    defaultJobHubs.filter((location) => normalize(location) !== normalizedPrimary),
  ).slice(0, 4)

  return { primary, alternatives }
}

const createPlatformJobSuggestions = (
  roleTitle: string,
  location: string,
  candidateSkills: string[],
  missingSkills: string[],
): Array<
  Omit<
    JobRecommendation,
    'fitScore' | 'matchedSkills' | 'missingSkills' | 'reasonForRecommendation' | 'suggestedImprovementsBeforeApplying'
  > & { requiredSkills: string[] }
> => {
  const skillHint = unique([...candidateSkills.slice(0, 2), ...missingSkills.slice(0, 2)]).join(' ')
  const matchingField = careerFieldDefinitions.find((field) => normalize(field.name) === normalize(roleTitle) || field.relatedTitles.some((title) => normalize(title) === normalize(roleTitle)))
  const domainRoleVariants = matchingField
    ? genericRoleTitlesByDomain[matchingField.domain]
    : Object.entries(genericRoleTitlesByDomain).find(([, roles]) => roles.some((item) => normalize(item) === normalize(roleTitle)))?.[1]
  const roleVariants = unique([
    roleTitle,
    ...(domainRoleVariants ?? []),
  ]).filter(Boolean).slice(0, 4)
  const { primary, alternatives } = buildLocationPlan(location)
  const locations = [
    { name: primary, isPreferredLocationMatch: true as const, recommendationSection: 'preferred_location' as const },
    ...alternatives.map((name) => ({
      name,
      isPreferredLocationMatch: false as const,
      recommendationSection: 'other_locations' as const,
    })),
  ]
  const suggestions = locations.flatMap(({ name, isPreferredLocationMatch, recommendationSection }) => {
    return roleVariants.flatMap((variant) => {
      const query = `${variant} ${name} ${skillHint}`.trim()
      return [
        {
          platformName: 'LinkedIn Jobs',
          jobTitle: variant,
          companyName: 'Multiple Companies',
          location: name,
          isPreferredLocationMatch,
          recommendationSection,
          requiredSkills: skillsForRole(variant),
          applyLink: `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`,
        },
        {
          platformName: 'Indeed',
          jobTitle: variant,
          companyName: 'Multiple Companies',
          location: name,
          isPreferredLocationMatch,
          recommendationSection,
          requiredSkills: skillsForRole(variant),
          applyLink: `https://in.indeed.com/jobs?q=${encodeURIComponent(query)}&l=${encodeURIComponent(name)}`,
        },
        {
          platformName: 'Naukri',
          jobTitle: variant,
          companyName: 'Multiple Companies',
          location: name,
          isPreferredLocationMatch,
          recommendationSection,
          requiredSkills: skillsForRole(variant),
          applyLink: `https://www.naukri.com/${encodeURIComponent(variant.toLowerCase().replace(/\s+/g, '-'))}-jobs-in-${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '-'))}`,
        },
        {
          platformName: 'Foundit',
          jobTitle: variant,
          companyName: 'Multiple Companies',
          location: name,
          isPreferredLocationMatch,
          recommendationSection,
          requiredSkills: skillsForRole(variant),
          applyLink: `https://www.foundit.in/srp/results?query=${encodeURIComponent(query)}&locations=${encodeURIComponent(name)}`,
        },
      ]
    })
  })

  return suggestions.filter((job, index, all) => all.findIndex((candidate) => candidate.applyLink === job.applyLink) === index)
}

const collectCandidateEvidenceText = (candidate: CandidateProfile, preferredRole: string): string =>
  normalize([
    preferredRole,
    candidate.preferredRole,
    ...candidate.projects,
    ...candidate.experience,
    ...candidate.education,
    ...candidate.certifications,
  ].join(' '))

const projectSupportScore = (evidenceText: string, projectKeywords: string[]): number =>
  projectKeywords.filter((keyword) => evidenceText.includes(normalize(keyword))).length

const fitLevelForScore = (score: number): 'Strong' | 'Moderate' | 'Emerging' => {
  if (score >= 75) return 'Strong'
  if (score >= 55) return 'Moderate'
  return 'Emerging'
}

const readinessFromScore = (
  fitScore: number,
  matchedCoreSkills: number,
  totalCoreSkills: number,
  supportScore: number,
): ReadinessCategory => {
  const coreCoverage = totalCoreSkills ? matchedCoreSkills / totalCoreSkills : 0
  if (fitScore >= 72 && coreCoverage >= 0.75 && supportScore >= 1) return 'ready_to_apply'
  if (fitScore >= 52 && coreCoverage >= 0.5) return 'near_match'
  return 'recommended_to_study'
}

const buildFieldReason = (
  field: CareerFieldDefinition,
  matchedSkills: string[],
  missingSkills: string[],
  readiness: ReadinessCategory,
  supportScore: number,
): string => {
  const matchedText = matchedSkills.slice(0, 4).join(', ')
  const missingText = missingSkills.slice(0, 3).join(', ')
  if (readiness === 'ready_to_apply') {
    return `You already show ${matchedText || 'role-aligned skills'} and project support for ${field.name}, so this is a realistic apply-now direction.`
  }
  if (readiness === 'near_match') {
    return `You are close to ${field.name} because of ${matchedText || 'your current background'}, but ${missingText || 'a few supporting skills'} still need stronger proof.`
  }
  return `Your background has some overlap with ${field.name}${supportScore ? ' and a few relevant signals' : ''}, but ${missingText || 'more core skills'} should be built before you target it seriously.`
}

const buildSuggestedImprovements = (field: CareerFieldDefinition, missingSkills: string[]): string[] =>
  unique([
    ...missingSkills.slice(0, 3).map((skill) => `Learn or strengthen ${skill} with one proof-based resume project bullet.`),
    `Tune your resume summary and project bullets toward ${field.name}.`,
  ]).slice(0, 4)

const buildNextSteps = (field: CareerFieldDefinition, readiness: ReadinessCategory, missingSkills: string[]): string[] => {
  if (readiness === 'ready_to_apply') {
    return [
      `Start applying to fresher and junior ${field.name} openings now.`,
      `Prepare interview stories around your strongest related project.`,
      `Keep improving ${missingSkills[0] ?? 'testing'} while applying.`,
    ].slice(0, 3)
  }
  if (readiness === 'near_match') {
    return [
      `Close the highest-priority gap in ${missingSkills[0] ?? field.supportSkills[0] ?? 'testing'}.`,
      `Add one targeted project or improvement tied to ${field.name}.`,
      `Apply to internships and beginner-friendly roles after that update.`,
    ]
  }
  return [
    `Treat ${field.name} as a study-next path instead of an immediate target.`,
    `Build one project focused on ${missingSkills[0] ?? field.coreSkills[0] ?? 'core skills'}.`,
    `Revisit this field after adding stronger proof to your resume.`,
  ]
}

const buildProjectIdeas = (field: CareerFieldDefinition, missingSkills: string[]): string[] =>
  unique([
    `Build a small ${field.name.toLowerCase()} portfolio project showing ${missingSkills[0] ?? field.coreSkills[0]}.`,
    `Add one end-to-end project that uses ${field.coreSkills.slice(0, 2).join(' and ')}.`,
    `Document your contribution, tech stack, and results clearly for recruiters.`,
  ]).slice(0, 3)

const buildStudyTopics = (field: CareerFieldDefinition, missingSkills: string[]): string[] =>
  unique([...missingSkills.slice(0, 4), ...field.supportSkills.slice(0, 2)]).slice(0, 5)

const evaluateCareerFields = (
  candidate: CandidateProfile,
  preferredRole: string,
  domain: DomainKey,
): CareerFieldRecommendation[] => {
  const candidateSkillSet = new Set(candidate.skills.map(canonicalSkill))
  const evidenceText = collectCandidateEvidenceText(candidate, preferredRole)
  const normalizedPreferredRole = normalize(preferredRole || candidate.preferredRole)

  return careerFieldDefinitions
    .filter((field) => domain === 'general_fresher' || field.domain === domain)
    .map((field) => {
    const matchedCore = field.coreSkills.filter((skill) => candidateSkillSet.has(canonicalSkill(skill)))
    const matchedSupport = field.supportSkills.filter((skill) => candidateSkillSet.has(canonicalSkill(skill)))
    const missingSkills = unique([...field.coreSkills, ...field.supportSkills].filter((skill) => !candidateSkillSet.has(canonicalSkill(skill))))
    const supportScore = projectSupportScore(evidenceText, [...field.projectKeywords, ...field.relatedTitles])
    const preferredRoleBoost = field.relatedTitles.some((title) => normalizedPreferredRole.includes(normalize(title))) || normalizedPreferredRole.includes(normalize(field.name)) ? 8 : 0
    const projectEvidenceBoost = Math.min(12, supportScore * 4)
    const fitScore = Math.min(
      96,
      Math.max(
        28,
        Math.round(
          ((matchedCore.length / Math.max(field.coreSkills.length, 1)) * 62)
          + ((matchedSupport.length / Math.max(field.supportSkills.length, 1)) * 18)
          + projectEvidenceBoost
          + preferredRoleBoost,
        ),
      ),
    )
    const readinessCategory = readinessFromScore(fitScore, matchedCore.length, field.coreSkills.length, supportScore)
    const matchedSkills = unique([...matchedCore, ...matchedSupport]).slice(0, 8)
    const supportingSignals = unique([
      supportScore > 0 ? `${supportScore} relevant project or experience signals detected.` : '',
      candidate.projects.length ? `${candidate.projects.length} project signal${candidate.projects.length > 1 ? 's' : ''} available in your profile or resume.` : '',
      candidate.experience.length ? 'Experience or internship evidence is available.' : '',
      preferredRoleBoost ? `Preferred role aligns with ${field.name}.` : '',
    ].filter(Boolean))

    return {
      fieldName: field.name,
      fieldKey: field.key,
      fitScore,
      fitLevel: fitLevelForScore(fitScore),
      readinessCategory,
      reasonForRecommendation: buildFieldReason(field, matchedSkills, missingSkills, readinessCategory, supportScore),
      matchedSkills,
      missingSkills: missingSkills.slice(0, 6),
      supportingSignals,
      suggestedImprovements: buildSuggestedImprovements(field, missingSkills),
      recommendedNextSteps: buildNextSteps(field, readinessCategory, missingSkills),
      projectIdeas: buildProjectIdeas(field, missingSkills),
      suggestedTopicsToStudy: buildStudyTopics(field, missingSkills),
    }
  }).sort((a, b) => b.fitScore - a.fitScore)
}

const buildFieldJobGroups = (
  fields: CareerFieldRecommendation[],
  preferredLocation: string,
  candidate: CandidateProfile,
): CareerFieldJobGroup[] =>
  fields.slice(0, 6).map((field) => {
    const jobs = createPlatformJobSuggestions(field.fieldName, preferredLocation, candidate.skills, field.missingSkills)
      .map((job) => {
        const { matched, missing } = compareSkillLists(job.requiredSkills, candidate.skills)
        const fitScore = calculateFitScore(job.requiredSkills, candidate.skills, 60)
        return {
          jobTitle: job.jobTitle,
          companyName: job.companyName,
          platformName: job.platformName,
          location: job.location,
          isPreferredLocationMatch: job.isPreferredLocationMatch,
          recommendationSection: job.recommendationSection,
          applyLink: job.applyLink,
          fitScore,
          matchedSkills: matched.slice(0, 8),
          missingSkills: missing.slice(0, 6),
          reasonForRecommendation: matched.length
            ? `${field.fieldName} is supported by ${matched.slice(0, 4).join(', ')} from your current profile.`
            : `${field.fieldName} is relevant to your current direction and recommended growth path.`,
          suggestedImprovementsBeforeApplying: field.suggestedImprovements.slice(0, 3),
        }
      })
      .sort((a, b) => {
        if (a.isPreferredLocationMatch !== b.isPreferredLocationMatch) return a.isPreferredLocationMatch ? -1 : 1
        return b.fitScore - a.fitScore
      })
      .slice(0, field.readinessCategory === 'ready_to_apply' ? 6 : 4)

    return {
      fieldName: field.fieldName,
      fieldKey: field.fieldKey,
      domain: careerFieldDefinitions.find((item) => item.key === field.fieldKey)?.domain ?? 'general_fresher',
      readinessCategory: field.readinessCategory,
      jobs,
    }
  })

const extractCandidateProfile = (profile: Record<string, unknown>, resume: Record<string, unknown>): CandidateProfile => {
  const baseSkills = unique([
    ...toStringArray(profile.skills),
    ...toStringArray(profile.technicalSkills),
    ...toStringArray(profile.softSkills),
    ...toStringArray(resume.extractedSkills),
    ...extractSkillsFromText(String(resume.extractedText ?? '')),
  ])
  return {
    skills: unique(baseSkills.map(canonicalSkill)),
    projects: unique([...toStringArray(profile.projects), ...toStringArray(resume.extractedProjects)]),
    experience: unique([...toStringArray(resume.extractedExperience), String(profile.experience ?? '').trim(), String(profile.workExperience ?? '').trim()]).filter(Boolean),
    education: unique([...toStringArray(resume.extractedEducation), String(profile.education ?? '').trim(), String(profile.degree ?? '').trim()]).filter(Boolean),
    certifications: unique([...toStringArray(profile.certifications), ...toStringArray(resume.extractedCertifications)]),
    preferredRole: String(profile.preferredJobRole ?? '').trim(),
  }
}

const inferUserLevel = (candidate: CandidateProfile): 'Beginner' | 'Intermediate' | 'Advanced' => {
  const expText = normalize(candidate.experience.join(' '))
  if (/senior|lead|architect|6 years|7 years|8 years|9 years/.test(expText)) return 'Advanced'
  if (/intern|trainee|fresher|student|0 year|1 year/.test(expText)) return 'Beginner'
  if (candidate.projects.length <= 1) return 'Beginner'
  return 'Intermediate'
}

const classifyGaps = (job: ParsedJob, candidate: CandidateProfile): SkillGap[] => {
  const candidateSkillSet = new Set(candidate.skills.map(canonicalSkill))
  const gaps: SkillGap[] = []

  job.requiredSkills.forEach((skill) => {
    const normalized = canonicalSkill(skill)
    if (candidateSkillSet.has(normalized)) {
      const hasProof = candidate.projects.some((project) => includesSkill(project, normalized)) || candidate.experience.some((item) => includesSkill(item, normalized))
      if (hasProof) {
        gaps.push({ skill: normalized, gapType: 'matched', priority: 'optional', reason: 'Skill is already present with project or experience evidence.' })
      } else {
        gaps.push({ skill: normalized, gapType: 'weak_required', priority: 'high', reason: 'Skill appears in profile but lacks strong project or experience proof.' })
      }
    } else {
      gaps.push({ skill: normalized, gapType: 'missing_required', priority: 'high', reason: 'Required skill is missing for this target job.' })
    }
  })

  job.optionalSkills.forEach((skill) => {
    const normalized = canonicalSkill(skill)
    if (candidateSkillSet.has(normalized)) {
      gaps.push({ skill: normalized, gapType: 'partial_match', priority: 'medium', reason: 'Optional skill exists and can be strengthened for better fit.' })
    } else {
      gaps.push({ skill: normalized, gapType: 'missing_optional', priority: 'medium', reason: 'Optional but useful skill is currently missing.' })
    }
  })

  return gaps
}

const languageQueryText = (language: LanguagePreference): string => {
  if (language === 'hindi') return 'Hindi'
  if (language === 'english') return 'English'
  return ''
}

const levelQueryText = (level: 'Beginner' | 'Intermediate' | 'Advanced'): string => {
  if (level === 'Beginner') return 'beginner fresher'
  if (level === 'Advanced') return 'advanced experienced'
  return 'intermediate'
}

const compactQuery = (...parts: string[]): string => unique(parts.join(' ').split(/\s+/)).join(' ')

const buildIntentQueries = (
  skill: string,
  role: string,
  language: LanguagePreference,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  type: RecommendationType,
): string[] => {
  const lang = languageQueryText(language)
  const roleHint = role || 'software developer'
  const levelHint = levelQueryText(level)
  const templates: Record<RecommendationType, string[]> = {
    concept: [
      `${skill} tutorial ${lang}`,
      `${skill} for beginners ${lang}`,
      `learn ${skill} ${roleHint} ${lang}`,
    ],
    project: [
      `${skill} project tutorial ${roleHint} ${lang}`,
      `build ${skill} project ${lang}`,
      `${skill} real world project ${lang}`,
    ],
    interview: [
      `${skill} interview questions ${lang}`,
      `${skill} viva questions ${lang}`,
      `${roleHint} interview questions ${skill} ${lang}`,
      `${skill} interview questions and answers ${lang}`,
    ],
    revision: [
      `${skill} crash course ${lang}`,
      `${skill} quick revision ${lang}`,
    ],
  }
  return unique(templates[type].map((query) => compactQuery(query, roleHint, levelHint)))
}

const buildSearchQueries = (skill: string, role: string, language: LanguagePreference, level: 'Beginner' | 'Intermediate' | 'Advanced' = 'Intermediate'): Array<{ query: string; type: RecommendationType; intent: RecommendationIntent }> => {
  return [
    { query: buildIntentQueries(skill, role, language, level, 'concept')[0], type: 'concept', intent: recommendationIntentLabel.concept },
    { query: buildIntentQueries(skill, role, language, level, 'project')[0], type: 'project', intent: recommendationIntentLabel.project },
    { query: buildIntentQueries(skill, role, language, level, 'interview')[0], type: 'interview', intent: recommendationIntentLabel.interview },
    { query: buildIntentQueries(skill, role, language, level, 'revision')[0], type: 'revision', intent: recommendationIntentLabel.revision },
  ]
}

const toEmbedLink = (videoId: string): string => `https://www.youtube.com/embed/${videoId}`
const toWatchLink = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`
const toYoutubeSearchLink = (query: string): string => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
const genericFallbackVideo: Record<'Hindi' | 'English', Record<RecommendationType, { id: string; title: string; channel: string }>> = {
  Hindi: {
    concept: { id: 'gfDE2a7MKjA', title: 'Programming Concepts for Beginners in Hindi', channel: 'CodeWithHarry' },
    project: { id: 'BsDoLVMnmZs', title: 'Build a Practical Web Project in Hindi', channel: 'CodeWithHarry' },
    interview: { id: 'bSrm9RXwBaI', title: 'Technical Interview Preparation in Hindi', channel: 'Apna College' },
    revision: { id: 'BsDoLVMnmZs', title: 'Programming Quick Revision in Hindi', channel: 'CodeWithHarry' },
  },
  English: {
    concept: { id: 'zOjov-2OZ0E', title: 'Programming Fundamentals', channel: 'freeCodeCamp.org' },
    project: { id: '3PHXvlpOkf4', title: 'Build and Deploy a Project', channel: 'freeCodeCamp.org' },
    interview: { id: '8hly31xKli0', title: 'Data Structures and Algorithms Interview Course', channel: 'freeCodeCamp.org' },
    revision: { id: 'zOjov-2OZ0E', title: 'Programming Quick Recap', channel: 'freeCodeCamp.org' },
  },
}

const languageOfVideo = (title: string, channel: string): 'Hindi' | 'English' => {
  const t = normalize(`${title} ${channel}`)
  return /(hindi|hinglish)/.test(t) ? 'Hindi' : 'English'
}

const scoreVideo = (input: {
  title: string
  description: string
  channelName: string
  publishedAt?: string
  viewCount?: number
  language: 'Hindi' | 'English'
  requiredSkill: string
  role: string
  userLevel: 'Beginner' | 'Intermediate' | 'Advanced'
  requestedLanguage: LanguagePreference
  recommendationType: RecommendationType
  isEmbeddable: boolean
  priority: SkillPriority
}): { total: number; breakdown: Record<string, number>; valid: boolean; strictValid: boolean; reason: string } => {
  const breakdown: Record<string, number> = {}
  const combined = normalize(`${input.title} ${input.description}`)
  const title = normalize(input.title)
  const role = normalize(input.role)
  const hasTopicInTitle = hasCloseTopicMatch(title, input.requiredSkill)
  const hasTopicAnywhere = hasCloseTopicMatch(combined, input.requiredSkill)
  const hasIntentInTitle = intentKeywordPatterns[input.recommendationType].test(title)
  const hasIntentAnywhere = intentKeywordPatterns[input.recommendationType].test(combined)
  const hasConflictingTitleIntent = conflictingIntentPatterns[input.recommendationType].test(title) && !hasIntentInTitle
  const strictValid = hasTopicInTitle && hasIntentInTitle
  const valid = hasTopicAnywhere && hasIntentAnywhere && !hasConflictingTitleIntent

  breakdown.topicTitle = hasTopicInTitle ? 38 : 0
  breakdown.topicDescription = !hasTopicInTitle && hasTopicAnywhere ? 18 : 0
  breakdown.intentTitle = hasIntentInTitle ? 34 : 0
  breakdown.intentDescription = !hasIntentInTitle && hasIntentAnywhere ? 14 : 0
  breakdown.language = input.requestedLanguage === 'both' || input.requestedLanguage === input.language.toLowerCase() ? 16 : -10
  breakdown.role = role && combined.includes(role) ? 8 : 0
  breakdown.level = input.userLevel === 'Beginner' && /beginner|beginners|fresher|from scratch/.test(combined) ? 8 : input.userLevel === 'Advanced' && /advanced|experienced|system design|deep dive/.test(combined) ? 8 : 0
  breakdown.priority = input.priority === 'high' ? 6 : input.priority === 'medium' ? 3 : 0
  breakdown.channelTrust = trustedChannels.has(input.channelName) ? 8 : 0
  breakdown.embeddable = input.isEmbeddable ? 6 : -8
  breakdown.intentConflict = hasConflictingTitleIntent ? -24 : 0
  breakdown.noTopic = hasTopicAnywhere ? 0 : -70
  breakdown.noIntent = hasIntentAnywhere ? 0 : -45
  if (input.publishedAt) {
    const years = (Date.now() - new Date(input.publishedAt).getTime()) / (1000 * 60 * 60 * 24 * 365)
    if (years <= 2) breakdown.freshness = 7
    else if (years <= 4) breakdown.freshness = 3
    else breakdown.freshness = -4
  }
  if (input.viewCount) {
    if (input.viewCount >= 500000) breakdown.engagement = 6
    else if (input.viewCount >= 50000) breakdown.engagement = 3
    else breakdown.engagement = 0
  }
  breakdown.lowQuality = /motivation|salary|roadmap only|clickbait|vs reality|shorts|short\b/.test(combined) ? -25 : 0
  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  return {
    total,
    breakdown,
    valid,
    strictValid,
    reason: strictValid
      ? 'title matches the topic and recommendation intent'
      : valid
        ? 'topic and intent are supported by title or description'
        : 'failed topic or intent validation',
  }
}

const searchYoutube = async (query: string): Promise<Array<Record<string, unknown>>> => {
  if (!env.youtubeApiKey) return []
  const endpoint = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=12&q=${encodeURIComponent(query)}&key=${encodeURIComponent(env.youtubeApiKey)}`
  const response = await fetch(endpoint)
  if (!response.ok) return []
  const data = (await response.json()) as { items?: Array<Record<string, unknown>> }
  return data.items ?? []
}

const fetchYoutubeVideoDetails = async (videoIds: string[]): Promise<Record<string, { embeddable: boolean; viewCount: number }>> => {
  if (!env.youtubeApiKey || videoIds.length === 0) return {}
  const ids = unique(videoIds).join(',')
  const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=status,statistics&id=${encodeURIComponent(ids)}&key=${encodeURIComponent(env.youtubeApiKey)}`
  const response = await fetch(endpoint)
  if (!response.ok) return {}
  const data = (await response.json()) as { items?: Array<Record<string, unknown>> }
  return (data.items ?? []).reduce<Record<string, { embeddable: boolean; viewCount: number }>>((acc, item) => {
    const id = String(item.id ?? '')
    const status = (item.status as Record<string, unknown> | undefined) ?? {}
    const statistics = (item.statistics as Record<string, unknown> | undefined) ?? {}
    acc[id] = {
      embeddable: status.embeddable !== false,
      viewCount: Number(statistics.viewCount ?? 0),
    }
    return acc
  }, {})
}

const createFallbackVideo = (
  skill: string,
  role: string,
  language: LanguagePreference,
  type: RecommendationType,
  priority: SkillPriority,
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced',
): RecommendedVideo => {
  const preferredLanguages: Array<'Hindi' | 'English'> = language === 'hindi' ? ['Hindi'] : language === 'english' ? ['English'] : ['Hindi', 'English']
  const bankItem = preferredLanguages
    .map((lang) => ({ lang, item: fallbackVideoBank[skill]?.[lang]?.[type] }))
    .find((entry) => entry.item)
  const fallbackLang = bankItem?.lang ?? preferredLanguages[0]
  const selected = bankItem?.item
  const langLabel = language === 'both' ? 'Both' : fallbackLang
  const query = buildSearchQueries(skill, role, language, difficulty).find((item) => item.type === type)?.query ?? `${skill} ${role}`
  const videoId = selected?.id ?? ''
  const embedUrl = selected ? toEmbedLink(videoId) : ''
  const watchUrl = selected ? toWatchLink(videoId) : ''
  const youtubeSearchUrl = toYoutubeSearchLink(query)
  const intent = recommendationIntentLabel[type]
  const scoreBreakdown = {
    topicTitle: selected ? 28 : 0,
    intentTitle: selected ? 18 : 0,
    language: langLabel === 'Both' || langLabel.toLowerCase() === language ? 16 : 0,
    fallback: selected ? -8 : -28,
    embeddable: selected ? 6 : 0,
  }
  const relevanceScore = Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0)
  const selectionReason = selected
    ? `No stronger validated ${skill} ${intent} video was selected, so a topic-specific fallback video is shown. Use Play on YouTube to open the exact generated search.`
    : `No validated ${skill} ${intent} video was selected; use Play on YouTube to open the exact generated search.`
  const title = selected ? `${skill} ${intent}: ${selected.title}` : `${skill} ${intent}`
  return {
    topic: skill,
    intent,
    searchQuery: query,
    selectedVideoId: videoId,
    selectedVideoTitle: title,
    embedUrl,
    watchUrl,
    youtubeSearchUrl,
    topicName: skill,
    weakOrMissingSkill: skill,
    videoTitle: title,
    channelName: selected?.channel ?? 'YouTube Search',
    language: langLabel,
    videoLink: selected ? watchUrl : youtubeSearchUrl,
    embedLink: selected ? embedUrl : '',
    reasonForRecommendation: selectionReason,
    recommendationType: type,
    recommendationIntent: intent,
    difficultyLevel: difficulty,
    priorityLevel: priority,
    relevanceScore,
    isEmbeddable: Boolean(selected),
    scoreBreakdown,
    selectionReason,
    auditLog: {
      topic: skill,
      intent,
      finalSearchQuery: query,
      selectedVideoTitle: title,
      selectedVideoId: videoId,
      reasonSelected: selectionReason,
      scoreBreakdown,
    },
  }
}

const findTopVideoForType = async (
  skill: string,
  role: string,
  type: RecommendationType,
  priority: SkillPriority,
  userLevel: 'Beginner' | 'Intermediate' | 'Advanced',
  language: LanguagePreference,
): Promise<RecommendedVideo> => {
  const intent = recommendationIntentLabel[type]
  const queries = buildIntentQueries(skill, role, language, userLevel, type)
  const resultGroups = await Promise.all(queries.map(async (query) => ({ query, results: await searchYoutube(query) })))
  const ids = resultGroups.flatMap(({ results }) => results.map((item) => String((item.id as Record<string, unknown> | undefined)?.videoId ?? '').trim()).filter(Boolean))
  const videoDetails = await fetchYoutubeVideoDetails(ids)
  const candidates: RecommendedVideo[] = resultGroups.flatMap(({ query, results }) => results.flatMap((item) => {
    const id = String((item.id as Record<string, unknown> | undefined)?.videoId ?? '').trim()
    if (!id) return []
    const snippet = (item.snippet as Record<string, unknown> | undefined) ?? {}
    const title = String(snippet.title ?? '').trim()
    const channel = String(snippet.channelTitle ?? '').trim()
    const description = String(snippet.description ?? '').trim()
    const publishedAt = String(snippet.publishedAt ?? '').trim()
    const lang = languageOfVideo(title, channel)
    const details = videoDetails[id] ?? { embeddable: true, viewCount: 0 }
    const score = scoreVideo({
      title,
      description,
      channelName: channel,
      publishedAt,
      viewCount: details.viewCount,
      language: lang,
      requiredSkill: skill,
      role,
      userLevel,
      requestedLanguage: language,
      recommendationType: type,
      isEmbeddable: details.embeddable,
      priority,
    })
    if (!score.valid) return []
    const embedUrl = toEmbedLink(id)
    const watchUrl = toWatchLink(id)
    const youtubeSearchUrl = toYoutubeSearchLink(query)
    const selectionReason = `${intent} match for ${skill}: ${score.reason}; score ${score.total}.`
    return [{
      topic: skill,
      intent,
      searchQuery: query,
      selectedVideoId: id,
      selectedVideoTitle: title,
      embedUrl,
      watchUrl,
      youtubeSearchUrl,
      topicName: skill,
      weakOrMissingSkill: skill,
      videoTitle: title,
      channelName: channel || 'Unknown Channel',
      language: lang,
      videoLink: watchUrl,
      embedLink: embedUrl,
      reasonForRecommendation: selectionReason,
      recommendationType: type,
      recommendationIntent: intent,
      difficultyLevel: userLevel,
      priorityLevel: priority,
      relevanceScore: score.total,
      isEmbeddable: details.embeddable,
      scoreBreakdown: score.breakdown,
      selectionReason,
      auditLog: {
        topic: skill,
        intent,
        finalSearchQuery: query,
        selectedVideoTitle: title,
        selectedVideoId: id,
        reasonSelected: selectionReason,
        scoreBreakdown: score.breakdown,
      },
    }]
  }))
  const strictMatches = candidates.filter((video) => {
    const title = normalize(video.videoTitle)
    return hasCloseTopicMatch(title, skill) && intentKeywordPatterns[type].test(title)
  })
  const filtered = (strictMatches.length ? strictMatches : candidates)
    .filter((video) => video.relevanceScore >= 45 && hasCloseTopicMatch(`${video.videoTitle} ${video.reasonForRecommendation}`, skill))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
  return filtered[0] ?? createFallbackVideo(skill, role, language, type, priority, userLevel)
}

export const recommendationService = {
  async generate(input: RecommendationInput) {
    const [profileDoc, selectedResume, fallbackResume] = await Promise.all([
      Profile.findOne({ userId: input.userId }).lean<Record<string, unknown>>(),
      input.resumeId ? Resume.findOne({ _id: input.resumeId, userId: input.userId }).lean<Record<string, unknown>>() : null,
      Resume.findOne({ userId: input.userId }).sort({ createdAt: -1 }).lean<Record<string, unknown>>(),
    ])
    const resume = selectedResume ?? fallbackResume
    const resumeId = String(resume?._id ?? input.resumeId ?? '')
    if (!resume || !resumeId) throw new Error('No resume found for recommendation generation.')

    const savedJobDescription = input.jobDescriptionId
      ? await SavedJobDescription.findOne({ _id: input.jobDescriptionId, userId: input.userId }).lean()
      : await SavedJobDescription.findOne({ userId: input.userId, resumeId }).sort({ createdAt: -1 }).lean()
    const effectiveJobText = String(input.jobDescriptionText ?? savedJobDescription?.jobDescriptionText ?? '').trim()
    const requestedTargetRole = String(input.targetRole ?? savedJobDescription?.targetRole ?? profileDoc?.preferredJobRole ?? '').trim()
    const preferredLocation = String(input.preferredLocation ?? savedJobDescription?.preferredLocation ?? profileDoc?.currentLocation ?? '').trim()
    const candidate = extractCandidateProfile(profileDoc ?? {}, resume)
    const domainDetection = detectPrimaryDomain(
      profileDoc ?? {},
      resume,
      candidate,
      requestedTargetRole || String(profileDoc?.preferredJobRole ?? ''),
      input.selectedDomain,
    )
    const careerFieldRecommendations = evaluateCareerFields(
      candidate,
      requestedTargetRole || String(profileDoc?.preferredJobRole ?? ''),
      domainDetection.domain,
    )
    const targetRole = requestedTargetRole
      || (effectiveJobText.trim() ? careerFieldRecommendations[0]?.fieldName : '')
      || defaultRolesForDomain(domainDetection.domain)[0]
      || 'Graduate Trainee'
    const parsedJob = parseJobDescription(effectiveJobText, targetRole, domainDetection.domain)
    const userLevel = inferUserLevel(candidate)
    const gaps = classifyGaps(parsedJob, candidate)

    const matchedSkills = gaps.filter((item) => item.gapType === 'matched').map((item) => item.skill)
    const missingRequiredSkills = gaps.filter((item) => item.gapType === 'missing_required').map((item) => item.skill)
    const weakRequiredSkills = gaps.filter((item) => item.gapType === 'weak_required').map((item) => item.skill)
    const partiallyMatchedSkills = gaps.filter((item) => item.gapType === 'partial_match').map((item) => item.skill)
    const missingOptionalSkills = gaps.filter((item) => item.gapType === 'missing_optional').map((item) => item.skill)
    const roleAlignmentGaps = parsedJob.jobRole && candidate.preferredRole && !normalize(parsedJob.jobRole).includes(normalize(candidate.preferredRole))
      ? [`Preferred role "${candidate.preferredRole}" differs from target job role "${parsedJob.jobRole}".`]
      : []

    const prioritizedTopics = [
      ...gaps.filter((gap) => gap.priority === 'high' && (gap.gapType === 'missing_required' || gap.gapType === 'weak_required')),
      ...gaps.filter((gap) => gap.priority === 'medium'),
      ...gaps.filter((gap) => gap.gapType === 'matched').slice(0, 2).map((gap) => ({
        ...gap,
        gapType: 'partial_match' as GapType,
        priority: 'medium' as SkillPriority,
        reason: `You already show ${gap.skill}; use interview-focused practice to make it job-ready for ${parsedJob.jobRole}.`,
      })),
    ].slice(0, 8)

    const groupedRecommendations: GroupedRecommendations[] = []
    for (const gap of prioritizedTopics) {
      const videos = await Promise.all([
        findTopVideoForType(gap.skill, parsedJob.jobRole, 'concept', gap.priority, userLevel, input.language),
        findTopVideoForType(gap.skill, parsedJob.jobRole, 'project', gap.priority, userLevel, input.language),
        findTopVideoForType(gap.skill, parsedJob.jobRole, 'interview', gap.priority, userLevel, input.language),
        findTopVideoForType(gap.skill, parsedJob.jobRole, 'revision', gap.priority, userLevel, input.language),
      ])
      groupedRecommendations.push({
        topicName: gap.skill,
        weakOrMissingSkill: gap.skill,
        priorityLevel: gap.priority,
        gapType: gap.gapType,
        whyThisTopicMatters: gap.reason,
        videos,
      })
    }

    const learningRecommendations = groupedRecommendations.flatMap((group) => group.videos)
    const roleMissingSkills = unique([...missingRequiredSkills, ...weakRequiredSkills])
    const jobRecommendations: JobRecommendation[] = createPlatformJobSuggestions(parsedJob.jobRole, preferredLocation, candidate.skills, roleMissingSkills)
      .map((job) => {
        const { matched, missing } = compareSkillLists(job.requiredSkills, candidate.skills)
        const fitScore = calculateFitScore(job.requiredSkills, candidate.skills, Number(profileDoc?.completion ?? 55))
        return {
          jobTitle: job.jobTitle,
          companyName: job.companyName,
          platformName: job.platformName,
          location: job.location,
          isPreferredLocationMatch: job.isPreferredLocationMatch,
          recommendationSection: job.recommendationSection,
          applyLink: job.applyLink,
          fitScore,
          matchedSkills: matched.slice(0, 10),
          missingSkills: missing.slice(0, 10),
          reasonForRecommendation: matched.length
            ? `${job.isPreferredLocationMatch ? 'Preferred location match with' : 'Role match supported by'} ${matched.slice(0, 4).join(', ')} for ${parsedJob.jobRole}.`
            : `${job.isPreferredLocationMatch ? 'Preferred location result for' : 'Additional location result for'} ${parsedJob.jobRole}.`,
          suggestedImprovementsBeforeApplying: missing.slice(0, 3).map((skill) => `Add one project bullet or proof point showcasing ${skill}.`),
        }
      })
      .sort((a, b) => {
        if (a.isPreferredLocationMatch !== b.isPreferredLocationMatch) return a.isPreferredLocationMatch ? -1 : 1
        return b.fitScore - a.fitScore
      })
      .slice(0, 24)

    const fieldRecommendations = careerFieldRecommendations.slice(0, 8)
    const readyToApplyFields = fieldRecommendations.filter((field) => field.readinessCategory === 'ready_to_apply')
    const nearMatchFields = fieldRecommendations.filter((field) => field.readinessCategory === 'near_match')
    const recommendedToStudyFields = fieldRecommendations.filter((field) => field.readinessCategory === 'recommended_to_study')
    const fieldJobGroups = buildFieldJobGroups(fieldRecommendations, preferredLocation, candidate)
    const jobsByField = fieldJobGroups.flatMap((group) => group.jobs)
    const topMissingSkill =
      readyToApplyFields.concat(nearMatchFields, recommendedToStudyFields)
        .flatMap((field) => field.missingSkills)
        .find(Boolean)
      ?? roleMissingSkills[0]
      ?? ''

    return {
      generatedAt: new Date().toISOString(),
      resumeId,
      jobDescriptionId: String(savedJobDescription?._id ?? input.jobDescriptionId ?? ''),
      preferredLearningLanguage: input.language,
      targetRole,
      preferredLocation,
      confirmedDomain: domainDetection.confirmed ? domainDetection.domain : '',
      activeDomain: domainDetection.domain,
      detectedDomain: {
        key: domainDetection.domain,
        label: domainDetection.label,
        confidence: domainDetection.confidence,
        confirmed: domainDetection.confirmed,
        topDomains: domainDetection.topDomains,
        alternativeSuggestions: domainDetection.fallbackSuggestions,
        topScores: domainDetection.scores,
      },
      parsedJobDescription: parsedJob,
      extractedCandidateProfile: candidate,
      careerFieldSummary: {
        topFields: fieldRecommendations.slice(0, 3).map((field) => field.fieldName),
        readyToApplyCount: readyToApplyFields.length,
        nearMatchCount: nearMatchFields.length,
        recommendedToStudyCount: recommendedToStudyFields.length,
        topMissingSkill,
        overallCareerFit: fieldRecommendations[0]
          ? `${fieldRecommendations[0].fieldName} is your strongest current direction with a ${fieldRecommendations[0].fitScore}% fit.`
          : 'Upload a stronger resume and profile to unlock career fit guidance.',
        detectedDomain: domainDetection.label,
        activeDomain: domainDetection.label,
      },
      careerFieldRecommendations: fieldRecommendations,
      readyToApplyFields,
      nearMatchFields,
      recommendedToStudyFields,
      skillGapAnalysis: {
        matchedSkills,
        missingRequiredSkills,
        weakRequiredSkills,
        partiallyMatchedSkills,
        missingOptionalSkills,
        roleAlignmentGaps,
      },
      groupedLearningRecommendations: groupedRecommendations,
      learningRecommendations,
      youtubeRecommendationAuditLogs: learningRecommendations.map((video) => video.auditLog),
      jobRecommendations,
      fieldJobGroups,
      jobsByField,
      generatedSearchStrategy: prioritizedTopics.flatMap((gap) => buildSearchQueries(gap.skill, parsedJob.jobRole, input.language, userLevel).map((item) => ({ skill: gap.skill, intent: item.intent, type: item.type, query: item.query }))),
    }
  },
}
