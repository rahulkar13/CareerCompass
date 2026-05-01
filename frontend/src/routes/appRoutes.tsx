import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute } from '../components/AuthGuards'
import { LandingPage } from '../pages/public/LandingPage'
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, RoleSelectionPage } from '../pages/auth/AuthPages'
import { DashboardLayout } from '../layouts/DashboardLayout'
import { adminMenu, recruiterMenu, studentMenu } from '../data/navigation'
import {
  CodingTestPage,
  InterviewPreparationPage,
  JobMatchPage,
  MockInterviewPage,
  MyApplicationsPage,
  MyProfilePage,
  MyReportsPage,
  ResumeAnalysisPage,
  SkillGapPage,
  StudentDashboardPage,
  StudentSettingsPage,
  UploadResumePage,
} from '../pages/student/StudentPages'
import {
  RecruiterAccessStatusPage,
  RecruiterCandidatesPage,
  RecruiterCompanyPage,
  RecruiterDashboardPage,
  RecruiterJobsPage,
  RecruiterSettingsPage,
} from '../pages/recruiter/RecruiterPages'
import {
  AdminDashboardPage,
  AdminContactMessagesPage,
  AdminFieldRoleManagementPage,
  AdminJobManagementPage,
  AdminNotificationsManagementPage,
  AdminQuestionBankManagementPage,
  AdminRecruiterDetailPage,
  AdminRecruitersManagementPage,
  AdminSettingsPage,
  AdminStudentDetailPage,
  AdminStudentsManagementPage,
  AdminUserManagementPage,
} from '../pages/admin/AdminPages'

export const appRouter = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/recruiter/access-status', element: <RecruiterAccessStatusPage /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/role-selection', element: <RoleSelectionPage /> },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['student']} />,
    children: [
      {
        path: '/student',
        element: <DashboardLayout menu={studentMenu} roleTitle="Student / Job Seeker" />,
        children: [
          { index: true, element: <Navigate to="/student/dashboard" replace /> },
          { path: 'dashboard', element: <StudentDashboardPage /> },
          { path: 'applications', element: <MyApplicationsPage /> },
          { path: 'profile', element: <MyProfilePage /> },
          { path: 'upload-resume', element: <UploadResumePage /> },
          { path: 'job-match', element: <JobMatchPage /> },
          { path: 'resume-analysis', element: <ResumeAnalysisPage /> },
          { path: 'skill-gap', element: <SkillGapPage /> },
          { path: 'interview-prep', element: <InterviewPreparationPage /> },
          { path: 'mock-interview', element: <MockInterviewPage /> },
          { path: 'mock-interview/coding-test', element: <CodingTestPage /> },
          { path: 'reports', element: <MyReportsPage /> },
          { path: 'settings', element: <StudentSettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['recruiter']} />,
    children: [
      {
        path: '/recruiter',
        element: <DashboardLayout menu={recruiterMenu} roleTitle="Recruiter / HR" />,
        children: [
          { index: true, element: <Navigate to="/recruiter/dashboard" replace /> },
          { path: 'dashboard', element: <RecruiterDashboardPage /> },
          { path: 'jobs', element: <RecruiterJobsPage /> },
          { path: 'candidates', element: <RecruiterCandidatesPage /> },
          { path: 'company', element: <RecruiterCompanyPage /> },
          { path: 'settings', element: <RecruiterSettingsPage /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={['admin']} />,
    children: [
      {
        path: '/admin',
        element: <DashboardLayout menu={adminMenu} roleTitle="Admin / Placement Officer" />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboardPage /> },
          { path: 'users', element: <AdminUserManagementPage /> },
          { path: 'students', element: <AdminStudentsManagementPage /> },
          { path: 'students/:studentId', element: <AdminStudentDetailPage /> },
          { path: 'recruiters', element: <AdminRecruitersManagementPage /> },
          { path: 'recruiters/:recruiterId', element: <AdminRecruiterDetailPage /> },
          { path: 'fields', element: <AdminFieldRoleManagementPage /> },
          { path: 'question-bank', element: <AdminQuestionBankManagementPage /> },
          { path: 'jobs', element: <AdminJobManagementPage /> },
          { path: 'notifications', element: <AdminNotificationsManagementPage /> },
          { path: 'contact-messages', element: <AdminContactMessagesPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
