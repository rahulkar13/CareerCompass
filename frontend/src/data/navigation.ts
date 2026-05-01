import type { MenuItem } from '../types'

export const studentMenu: MenuItem[] = [
  { label: 'Dashboard', path: '/student/dashboard', icon: 'LayoutDashboard' },
  { label: 'My Applications', path: '/student/applications', icon: 'FileCheck2' },
  { label: 'My Profile', path: '/student/profile', icon: 'UserCircle2' },
  { label: 'Upload Resume', path: '/student/upload-resume', icon: 'Upload' },
  { label: 'Career Field Match', path: '/student/job-match', icon: 'ScanSearch' },
  { label: 'Skill Gap Report', path: '/student/skill-gap', icon: 'BrainCircuit' },
  { label: 'Interview Preparation', path: '/student/interview-prep', icon: 'BookOpenText' },
  { label: 'Mock Interview', path: '/student/mock-interview', icon: 'Mic' },
  { label: 'My Reports', path: '/student/reports', icon: 'FileBarChart' },
  { label: 'Settings', path: '/student/settings', icon: 'Settings' },
]

export const recruiterMenu: MenuItem[] = [
  { label: 'Dashboard', path: '/recruiter/dashboard', icon: 'LayoutDashboard' },
  { label: 'Jobs', path: '/recruiter/jobs', icon: 'BriefcaseBusiness' },
  { label: 'Candidates', path: '/recruiter/candidates', icon: 'Users' },
  { label: 'Company', path: '/recruiter/company', icon: 'Building2' },
  { label: 'Settings', path: '/recruiter/settings', icon: 'Settings' },
]

export const adminMenu: MenuItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: 'LayoutDashboard' },
  { label: 'User Management', path: '/admin/users', icon: 'ShieldCheck' },
  { label: 'Students', path: '/admin/students', icon: 'Users' },
  { label: 'Recruiters', path: '/admin/recruiters', icon: 'BadgeCheck' },
  { label: 'Field & Role Management', path: '/admin/fields', icon: 'ScanSearch' },
  { label: 'Question Bank', path: '/admin/question-bank', icon: 'MessagesSquare' },
  { label: 'Job Management', path: '/admin/jobs', icon: 'BriefcaseBusiness' },
  { label: 'Notifications', path: '/admin/notifications', icon: 'MessageSquareMore' },
  { label: 'Contact Messages', path: '/admin/contact-messages', icon: 'BookOpenText' },
  { label: 'Settings', path: '/admin/settings', icon: 'Settings' },
]
