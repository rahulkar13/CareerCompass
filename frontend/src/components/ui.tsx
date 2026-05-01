import { Bell, Check, ChevronDown, LogOut, Moon, Sun, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'
import type { ChartPoint, DashboardStats, MenuItem } from '../types'
import { classNames } from '../utils/helpers'
import { iconMap } from './icons'
import { BrandLogo } from './brandLogos'
import { isValidElement, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PropsWithChildren, type ReactNode } from 'react'
import { authApi, recruiterApi, studentApi } from '../services/api'

type TopNavNotification = {
  id: string
  title: string
  body: string
  href?: string
  tone: 'info' | 'warning' | 'success'
  createdAt: string
  read: boolean
}

const notificationToneClass: Record<TopNavNotification['tone'], string> = {
  info: 'app-notification-tag app-notification-tag-info',
  warning: 'app-notification-tag app-notification-tag-warning',
  success: 'app-notification-tag app-notification-tag-success',
}

const getRecordId = (value: Record<string, unknown> | null | undefined) => String(value?._id ?? value?.id ?? '')

type PaginationToken = number | 'ellipsis-left' | 'ellipsis-right'

export const estimateContentWeight = (value: unknown): number => {
  if (typeof value === 'string') return Math.max(40, Math.min(320, value.trim().length * 1.35))
  if (typeof value === 'number') return 48
  if (typeof value === 'boolean') return 36
  if (Array.isArray(value)) return Math.max(60, value.reduce((sum, item) => sum + estimateContentWeight(item), 0))
  if (isValidElement(value)) return 120
  if (value && typeof value === 'object') {
    const nestedWeight = Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => sum + estimateContentWeight(item), 0)
    return Math.max(80, nestedWeight * 0.45)
  }
  return 40
}

export const getCompactPaginationItems = (page: number, totalPages: number): PaginationToken[] => {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (page <= 4) {
    const leadingPages = Array.from({ length: Math.min(5, totalPages - 1) }, (_, index) => index + 1)
    return [...leadingPages, 'ellipsis-right', totalPages]
  }

  if (page >= totalPages - 3) {
    const trailingStart = Math.max(4, totalPages - 4)
    const trailingPages = Array.from({ length: totalPages - trailingStart + 1 }, (_, index) => trailingStart + index)
    return [1, 2, 3, 'ellipsis-left', ...trailingPages]
  }

  return [1, 2, 3, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', totalPages]
}

export const getAdaptivePageSize = <T,>(
  items: T[],
  preferredPageSize: number,
  options?: {
    minPageSize?: number
    maxVisibleWeight?: number
    sampleSize?: number
  },
) => {
  const minPageSize = options?.minPageSize ?? Math.min(4, preferredPageSize)
  const maxVisibleWeight = options?.maxVisibleWeight ?? preferredPageSize * 220
  const sampleSize = options?.sampleSize ?? Math.min(items.length, preferredPageSize)

  if (!items.length) return preferredPageSize

  const sample = items.slice(0, Math.max(1, sampleSize))
  const averageWeight = sample.reduce((sum, item) => sum + estimateContentWeight(item), 0) / sample.length
  const adaptiveSize = Math.floor(maxVisibleWeight / Math.max(averageWeight, 80))
  return Math.max(minPageSize, Math.min(preferredPageSize, adaptiveSize || preferredPageSize))
}

export const paginateAdaptiveItems = <T,>(
  items: T[],
  page: number,
  preferredPageSize: number,
  options?: {
    minPageSize?: number
    maxVisibleWeight?: number
  },
) => {
  const pageSize = getAdaptivePageSize(items, preferredPageSize, options)
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
    safePage,
    pageSize,
    start,
  }
}

export const CompactPagination = ({
  page,
  totalPages,
  onChange,
  className = '',
}: {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}) => {
  if (totalPages <= 1) return null

  return (
    <div className={classNames('flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-sm', className)}>
      <p className="text-slate-500">Page {page} of {totalPages}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {getCompactPaginationItems(page, totalPages).map((item, index) => (
            typeof item === 'number' ? (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => onChange(item)}
                className={classNames(
                  'min-w-10 rounded-xl border px-3 py-2 text-sm font-medium transition',
                  item === page
                    ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                    : 'text-slate-600 hover:border-slate-300 hover:text-slate-900',
                )}
              >
                {item}
              </button>
            ) : (
              <span key={`${item}-${index}`} className="px-1 text-slate-400">...</span>
            )
          ))}
        </div>
        <button
          type="button"
          className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export const AppSelect = ({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  menuClassName = '',
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string; helper?: string }>
  placeholder?: string
  className?: string
  menuClassName?: string
}) => {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()
  const [menuStyle, setMenuStyle] = useState<{
    top?: number
    bottom?: number
    left: number
    width: number
    maxHeight: number
    placement: 'top' | 'bottom'
  } | null>(null)
  const selected = options.find((option) => option.value === value)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    requestAnimationFrame(() => {
      triggerRef.current?.focus()
    })
  }

  useEffect(() => {
    if (!open || !rootRef.current) return
    const updatePosition = () => {
      if (!rootRef.current) return
      const rect = rootRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const spaceBelow = viewportHeight - rect.bottom - 12
      const spaceAbove = rect.top - 12
      const estimatedMenuHeight = Math.min(Math.max(options.length * 52 + 16, 160), 360)
      const shouldOpenUp = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow
      const maxHeight = Math.max(140, Math.min(estimatedMenuHeight, shouldOpenUp ? spaceAbove : spaceBelow))
      const clampedLeft = Math.min(Math.max(12, rect.left), Math.max(12, viewportWidth - rect.width - 12))
      setMenuStyle({
        left: clampedLeft,
        width: rect.width,
        maxHeight,
        placement: shouldOpenUp ? 'top' : 'bottom',
        ...(shouldOpenUp
          ? { bottom: viewportHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, options.length])

  useEffect(() => {
    if (!open) return
    setActiveIndex(selectedIndex)
  }, [open, selectedIndex])

  useEffect(() => {
    if (!open) return
    const activeOption = optionRefs.current[activeIndex]
    if (!activeOption) return
    requestAnimationFrame(() => {
      activeOption.focus()
      activeOption.scrollIntoView({ block: 'nearest' })
    })
  }, [activeIndex, open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const openMenu = (index = selectedIndex) => {
    setActiveIndex(Math.min(Math.max(index, 0), Math.max(options.length - 1, 0)))
    setOpen(true)
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!options.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        openMenu(selectedIndex)
        return
      }
      setActiveIndex((current) => Math.min(current + 1, options.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openMenu(selectedIndex)
        return
      }
      setActiveIndex((current) => Math.max(current - 1, 0))
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openMenu(selectedIndex)
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
    }
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!options.length) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, options.length - 1))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(options.length - 1)
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const activeOption = options[activeIndex]
      if (activeOption) selectOption(activeOption.value)
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false)
            return
          }
          openMenu(selectedIndex)
        }}
        onKeyDown={handleTriggerKeyDown}
        className={classNames('app-select-trigger flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition', className)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{selected?.label ?? placeholder ?? 'Select option'}</span>
          {selected?.helper ? <span className="mt-0.5 block truncate text-xs">{selected.helper}</span> : null}
        </span>
        <ChevronDown size={18} className={classNames('app-select-caret flex-shrink-0 transition', open ? 'rotate-180' : '')} />
      </button>
      {open && menuStyle ? createPortal(
        <div
          ref={menuRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
          className={classNames('app-select-menu fixed z-[200] rounded-2xl border p-2 shadow-xl', menuClassName)}
          style={{
            ...(menuStyle.top !== undefined ? { top: `${menuStyle.top}px` } : {}),
            ...(menuStyle.bottom !== undefined ? { bottom: `${menuStyle.bottom}px` } : {}),
            left: `${menuStyle.left}px`,
            width: `${menuStyle.width}px`,
            maxHeight: `${menuStyle.maxHeight}px`,
          }}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              ref={(node) => {
                optionRefs.current[index] = node
              }}
              role="option"
              aria-selected={option.value === value}
              tabIndex={index === activeIndex ? 0 : -1}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onClick={() => selectOption(option.value)}
              className={classNames(
                'app-select-option flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition',
                option.value === value ? 'app-select-option-active' : '',
                index === activeIndex ? 'app-select-option-highlighted' : '',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.label}</span>
                {option.helper ? <span className="mt-1 block text-xs">{option.helper}</span> : null}
              </span>
              {option.value === value ? <Check size={16} className="mt-0.5 flex-shrink-0" /> : null}
            </button>
          ))}
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

export const Card = ({ children, className = '' }: PropsWithChildren<{ className?: string }>) => (
  <div className={classNames('app-card rounded-2xl border p-5 backdrop-blur-sm', className)}>{children}</div>
)

export const StatCards = ({ stats }: { stats: DashboardStats[] }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {stats.map((stat) => (
      <Card key={stat.label}>
        <p className="text-sm text-slate-400">{stat.label}</p>
        <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
        {stat.trend ? <p className="mt-1 text-xs font-medium text-fuchsia-300">{stat.trend} this month</p> : null}
      </Card>
    ))}
  </div>
)

export const PageHeader = ({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
    {action}
  </div>
)

export const Sidebar = ({ items }: { items: MenuItem[] }) => (
  <aside className="app-sidebar w-full border-r md:h-screen md:w-72 md:flex-shrink-0 md:overflow-y-auto">
    <div className="border-b p-4">
      <Link to="/" className="inline-flex items-center">
        <BrandLogo compact />
      </Link>
      <p className="text-xs text-indigo-200/75">Interview Prep System</p>
    </div>
    <nav className="space-y-1 p-3">
      {items.map((item) => {
        const Icon = iconMap[item.icon]
        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              classNames(
                'app-nav-link flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition',
                isActive ? 'app-nav-link-active font-semibold text-slate-950' : 'text-indigo-100',
              )
            }
          >
            <Icon size={17} />
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  </aside>
)

export const TopNav = ({ roleTitle }: { roleTitle: string }) => {
  const navigate = useNavigate()
  const session = authApi.getSession()
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  })
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState('')
  const [notifications, setNotifications] = useState<TopNavNotification[]>([])
  const [notificationPage, setNotificationPage] = useState(1)

  const loadNotifications = async () => {
    if (!session) {
      setNotifications([])
      return
    }

    setNotificationsLoading(true)
    setNotificationsError('')
    try {
      if (session.user.role === 'student') {
        const [profile, resumes, reports, mockSessions] = await Promise.all([
          studentApi.getProfile(),
          studentApi.listResumes(),
          studentApi.listReports(),
          studentApi.listMockInterviewSessions(),
        ])
        const items: TopNavNotification[] = []

        if ((profile.completion ?? 0) < 100) {
          items.push({
            id: 'profile-completion',
            title: 'Complete your profile',
            body: `Your profile is ${profile.completion}% complete. Fill the missing details to improve recommendations.`,
            href: '/student/profile',
            tone: 'warning',
            createdAt: new Date().toISOString(),
            read: false,
          })
        }

        if (!resumes.length) {
          items.push({
            id: 'resume-missing',
            title: 'Upload your resume',
            body: 'Add your latest resume to unlock analysis, skill gap reports, and better role suggestions.',
            href: '/student/upload-resume',
            tone: 'warning',
            createdAt: new Date().toISOString(),
            read: false,
          })
        }

        const latestReport = reports[0]
        if (latestReport) {
          items.push({
            id: `report-${getRecordId(latestReport)}`,
            title: `Latest report: ${String(latestReport.title ?? latestReport.reportType ?? 'Career report')}`,
            body: String(latestReport.summary ?? 'A new report is ready to review.'),
            href: '/student/reports',
            tone: 'success',
            createdAt: String(latestReport.createdAt ?? latestReport.generatedAt ?? new Date().toISOString()),
            read: false,
          })
        }

        if (!mockSessions.length) {
          items.push({
            id: 'mock-start',
            title: 'Start a mock interview',
            body: 'Practice one mock interview session to build confidence before applying.',
            href: '/student/mock-interview',
            tone: 'info',
            createdAt: new Date().toISOString(),
            read: false,
          })
        } else {
          const latestMock = mockSessions[0]
          items.push({
            id: `mock-${getRecordId(latestMock)}`,
            title: 'Latest mock interview activity',
            body: `Your latest mock score is ${String(latestMock.score ?? '0')}%. Review it and continue improving weak areas.`,
            href: '/student/mock-interview',
            tone: 'info',
            createdAt: String(latestMock.createdAt ?? new Date().toISOString()),
            read: false,
          })
        }

        if (profile.needsDomainConfirmation) {
          items.push({
            id: 'domain-confirmation',
            title: 'Confirm your career field',
            body: 'Review your detected field so future recommendations and interview preparation stay more relevant.',
            href: '/student/profile',
            tone: 'info',
            createdAt: new Date().toISOString(),
            read: false,
          })
        }

        setNotifications(items)
      } else if (session.user.role === 'recruiter') {
        const profile = await recruiterApi.getProfile()
        setNotifications([
          {
            id: 'recruiter-profile',
            title: profile ? 'Recruiter workspace is ready' : 'Complete recruiter profile',
            body: profile
              ? 'Use the dashboard to post a job, review resumes, and rank candidates.'
              : 'Add your company and hiring details to start using recruiter tools properly.',
            href: '/recruiter/settings',
            tone: profile ? 'success' : 'warning',
            createdAt: new Date().toISOString(),
            read: false,
          },
        ])
      } else {
        setNotifications([
          {
            id: 'admin-overview',
            title: 'Admin tools are available',
            body: 'Review reports, system analytics, and feedback from the admin dashboard.',
            href: '/admin/dashboard',
            tone: 'info',
            createdAt: new Date().toISOString(),
            read: false,
          },
        ])
      }
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : 'Could not load notifications.')
    } finally {
      setNotificationsLoading(false)
    }
  }

  const logout = () => {
    authApi.logout()
    navigate('/')
  }
  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    localStorage.setItem('interview-prep-theme', nextTheme)
  }
  const openNotifications = () => {
    setNotificationsOpen((current) => {
      const next = !current
      if (!current) void loadNotifications()
      return next
    })
  }
  const handleNotificationClick = (href?: string) => {
    setNotifications((current) => current.map((item) => (item.href === href ? { ...item, read: true } : item)))
    setNotificationsOpen(false)
    if (href) navigate(href)
  }
  const dismissNotification = (id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id))
  }
  const clearNotifications = () => {
    setNotifications([])
  }
  const markAsRead = (id: string) => {
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
  }

  useEffect(() => {
    if (!session) return
    void loadNotifications()
  }, [])

  useEffect(() => {
    if (!notificationsOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current) return
      if (!notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [notificationsOpen])

  useEffect(() => {
    setNotificationPage(1)
  }, [notificationsOpen, notifications.length])

  const unreadCount = notifications.filter((item) => !item.read).length
  const paginatedNotifications = useMemo(
    () => paginateAdaptiveItems(notifications, notificationPage, 5, { minPageSize: 3, maxVisibleWeight: 920 }),
    [notificationPage, notifications],
  )
  const formatNotificationTime = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const now = Date.now()
    const diffMs = now - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <header className="app-topnav sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="app-role-pill rounded-full border px-3 py-1 text-xs font-semibold">{roleTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark and light theme"
            className="theme-toggle rounded-full border p-1"
          >
            <span className={classNames('theme-toggle-thumb', theme === 'light' ? 'translate-x-6' : 'translate-x-0')}>
              {theme === 'light' ? <Sun size={13} /> : <Moon size={13} />}
            </span>
          </button>
          <div ref={notificationsRef} className="relative">
            <button
              onClick={openNotifications}
              className={classNames('app-icon-button relative rounded-xl border p-2', notificationsOpen ? 'app-icon-button-active' : '')}
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
            >
              <Bell size={16} />
              {unreadCount ? (
                <span className="app-notification-badge">
                  {Math.min(unreadCount, 9)}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <div className="app-notification-dropdown absolute right-0 top-[calc(100%+0.65rem)] z-30 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Notifications</p>
                    <p className="text-xs text-slate-400">{unreadCount ? `${unreadCount} unread` : 'All caught up'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {notifications.length ? (
                      <button type="button" onClick={clearNotifications} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">
                        Clear All
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setNotificationsOpen(false)} className="rounded-lg border border-indigo-400/20 p-1 text-slate-300 hover:bg-white/5 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                </div>
                <div className="p-2">
                  {notificationsLoading ? <p className="px-3 py-3 text-sm text-slate-300">Loading notifications...</p> : null}
                  {notificationsError ? <p className="m-1 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-200">{notificationsError}</p> : null}
                  {!notificationsLoading && !notificationsError && notifications.length === 0 ? (
                    <p className="m-1 rounded-xl border border-indigo-400/20 bg-slate-950/35 px-3 py-3 text-sm text-slate-300">No notifications right now.</p>
                  ) : null}
                  {!notificationsLoading && !notificationsError
                    ? paginatedNotifications.items.map((item) => (
                      <div
                        key={item.id}
                        className={classNames(
                          'app-notification-item m-1 rounded-xl border p-3 text-left',
                          !item.read ? 'app-notification-item-unread' : '',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={classNames('inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide', notificationToneClass[item.tone])}>
                                {item.tone}
                              </span>
                              {!item.read ? <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300" /> : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                markAsRead(item.id)
                                handleNotificationClick(item.href)
                              }}
                              className="mt-3 block text-left"
                            >
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-1 text-sm text-slate-300">{item.body}</p>
                            </button>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <p className="text-xs text-slate-500">{formatNotificationTime(item.createdAt)}</p>
                              {item.href ? <button type="button" onClick={() => {
                                markAsRead(item.id)
                                handleNotificationClick(item.href)
                              }} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Open</button> : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => dismissNotification(item.id)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white"
                            aria-label="Dismiss notification"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                    : null}
                  {!notificationsLoading && !notificationsError && notifications.length > 0 ? (
                    <div className="px-1 pb-1 pt-2">
                      <CompactPagination
                        page={paginatedNotifications.safePage}
                        totalPages={paginatedNotifications.totalPages}
                        onChange={setNotificationPage}
                        className="border-indigo-400/20 bg-transparent"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <button onClick={logout} className="app-logout-button flex items-center gap-2 rounded-xl border px-3 py-1.5">
            <LogOut size={17} />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </header>
    </>
  )
}

export const DataTable = ({
  columns,
  rows,
  enablePagination = true,
  preferredPageSize = 10,
  minPageSize = 5,
  maxVisibleWeight,
}: {
  columns: string[]
  rows: Array<Record<string, string | number | ReactNode>>
  enablePagination?: boolean
  preferredPageSize?: number
  minPageSize?: number
  maxVisibleWeight?: number
}) => {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        Object.values(row).some((value) => String(value).toLowerCase().includes(query.toLowerCase())),
      ),
    [query, rows],
  )
  const shouldPaginate = enablePagination && filtered.length > preferredPageSize
  const paginated = useMemo(
    () => shouldPaginate
      ? paginateAdaptiveItems(filtered, page, preferredPageSize, { minPageSize, maxVisibleWeight })
      : { items: filtered, safePage: 1, totalPages: 1, pageSize: filtered.length, start: 0 },
    [filtered, maxVisibleWeight, minPageSize, page, preferredPageSize, shouldPaginate],
  )

  useEffect(() => {
    setPage(1)
  }, [query, rows])

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <input
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
          placeholder="Search or filter..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-indigo-200/75">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-medium">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td className="px-3 py-8 text-center text-indigo-200/70" colSpan={columns.length}>No records found</td></tr>
            ) : (
              paginated.items.map((row, index) => (
                <tr key={index} className="app-table-row border-b border-indigo-500/15">
                  {columns.map((column) => (
                    <td key={column} className="px-3 py-3 align-top whitespace-normal break-words">{row[column] ?? '-'}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {shouldPaginate ? (
        <div className="mt-4">
          <CompactPagination page={paginated.safePage} totalPages={paginated.totalPages} onChange={setPage} />
        </div>
      ) : null}
    </Card>
  )
}

export const CircularScore = ({ score }: { score: number }) => {
  const data = [{ name: 'score', value: score }, { name: 'rest', value: 100 - score }]
  return (
    <Card className="flex items-center justify-center">
      <div className="relative h-40 w-40">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} innerRadius={48} outerRadius={70} dataKey="value">
              <Cell fill="var(--chart-primary)" />
              <Cell fill="var(--chart-track)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center text-2xl font-semibold text-white">{score}%</div>
      </div>
    </Card>
  )
}

export const ProgressBar = ({ label, value }: { label: string; value: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-sm"><span>{label}</span><span>{value}%</span></div>
    <div className="app-progress-track h-2 rounded-full">
      <div className="app-progress-fill h-2 rounded-full" style={{ width: `${value}%` }} />
    </div>
  </div>
)

export const TrendChart = ({ data }: { data: ChartPoint[] }) => (
  <Card className="h-72">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
        <XAxis dataKey="name" stroke="var(--chart-axis)" />
        <YAxis stroke="var(--chart-axis)" />
        <Tooltip contentStyle={{ backgroundColor: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: '0.75rem', color: 'var(--tooltip-text)' }} />
        <Line type="monotone" dataKey="value" stroke="var(--chart-primary)" strokeWidth={3} dot={false} />
        <Line type="monotone" dataKey="secondary" stroke="var(--chart-secondary)" strokeWidth={3} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </Card>
)

export const AppModal = ({
  open,
  title,
  onClose,
  children,
  panelClassName = '',
  headerClassName = '',
  titleClassName = '',
  closeClassName = '',
  bodyClassName = '',
}: PropsWithChildren<{
  open: boolean
  title: string
  onClose: () => void
  panelClassName?: string
  headerClassName?: string
  titleClassName?: string
  closeClassName?: string
  bodyClassName?: string
}>) =>
  !open ? null : (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#050a1a]/85 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={classNames('flex max-h-[calc(100vh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border shadow-2xl sm:max-h-[calc(100vh-2rem)]', panelClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={classNames('flex shrink-0 items-center justify-between border-b px-5 py-4', headerClassName)}>
          <h3 className={classNames('text-lg font-semibold', titleClassName)}>{title}</h3>
          <button type="button" className={classNames('app-icon-button rounded-lg border p-1.5', closeClassName)} onClick={onClose}><X size={18} /></button>
        </div>
        <div className={classNames('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>
          {children}
        </div>
      </div>
    </div>
  )

export const FileDrop = ({ onSelect }: { onSelect: (file: File) => void }) => (
  <label className="app-file-drop block rounded-2xl border-2 border-dashed p-7 text-center">
    <input
      type="file"
      className="hidden"
      accept=".pdf,.docx,.txt,.rtf"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) onSelect(file)
      }}
    />
    <p className="text-sm text-indigo-100">Drag & drop resume here or click to upload</p>
    <p className="mt-1 text-xs text-indigo-200/75">Supported formats: PDF, DOCX, TXT, RTF</p>
  </label>
)
