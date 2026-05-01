import { Outlet } from 'react-router-dom'
import type { MenuItem } from '../types'
import { Sidebar, TopNav } from '../components/ui'

interface DashboardLayoutProps {
  menu: MenuItem[]
  roleTitle: string
}

export const DashboardLayout = ({ menu, roleTitle }: DashboardLayoutProps) => (
  <div className="app-layout min-h-screen md:flex md:h-screen md:overflow-hidden">
    <Sidebar items={menu} />
    <div className="app-main-shell flex-1 md:flex md:min-h-0 md:flex-col md:overflow-hidden">
      <TopNav roleTitle={roleTitle} />
      <main className="dashboard-surface p-4 md:min-h-0 md:flex-1 md:overflow-y-auto md:p-6">
        <Outlet />
      </main>
    </div>
  </div>
)
