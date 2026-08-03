import { useEffect, useEffectEvent, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import BrandMark from '../../components/BrandMark'
import { roleLabel } from '../../lib/roles'
import { primaryNavItems, performanceNavItems, adminNavItems, canShowNavItem, isNavItemActive, isSharedNavZonePath, resolveNavZone, type NavItem, type NavZone } from './adminNavigation'
import { GlobalAssistantComposer } from '../../components/assistant/GlobalAssistantComposer'
import { dismissAssistantNotification, listMyNotifications, markAllNotificationsRead, markNotificationRead, refreshAssistantDayNotifications, safeNotificationLink, snoozeAssistantNotification, unreadNotificationCount, type AppNotification } from '../../lib/notifications'

const NOTIFICATION_POLL_MS = 30_000
const ZONE_STORAGE_KEY = 'cg-nav-zone-v1'

function notificationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function notificationFallback(type: string) {
  if (type === 'background_job_succeeded') return 'The background job finished successfully.'
  if (type === 'background_job_failed') return 'The background job reached a terminal failure.'
  if (type === 'schedule_change_applied') return 'Your Client Schedule change was approved and applied.'
  if (type === 'schedule_change_rejected') return 'Your Client Schedule change was declined.'
  if (type === 'schedule_change_proposed') return 'A Client Schedule change is waiting for review.'
  if (type === 'task_assigned') return 'A Planner task was assigned to you.'
  return 'There is an update to your work.'
}

function ZoneSwitcher({ zone, onChange, className = '' }: { zone: NavZone; onChange: (zone: NavZone) => void; className?: string }) {
  const base = 'min-h-11 flex-1 rounded-md px-2 py-2 text-xs font-black uppercase tracking-[0.08em] transition-colors'
  return (
    <div className={`flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1 ${className}`} role="tablist" aria-label="Workspace zone">
      <button type="button" role="tab" aria-selected={zone === 'hub'} onClick={() => onChange('hub')} className={`${base} ${zone === 'hub' ? 'bg-brand-teal/15 text-brand-teal' : 'text-brand-primary/60 hover:text-white'}`}>Hub</button>
      <button type="button" role="tab" aria-selected={zone === 'performance'} onClick={() => onChange('performance')} className={`${base} ${zone === 'performance' ? 'bg-brand-teal/15 text-brand-teal' : 'text-brand-primary/60 hover:text-white'}`}>Performance</button>
    </div>
  )
}

const CG_HOURS_URL = 'https://cg-hours.vercel.app'

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? parts.at(-1)?.[0] ?? '' : ''}`.toUpperCase()
}

function NavSection({ label, collapsed = false }: { label: string; collapsed?: boolean }) {
  return (
    <p className={`${collapsed ? 'sr-only' : 'mb-1 mt-3 px-3'} text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/40`}>
      {label}
    </p>
  )
}

function NavigationLink({ item, active, collapsed = false, onClick }: { item: NavItem; active: boolean; collapsed?: boolean; onClick?: () => void }) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex min-h-11 items-center rounded-md px-3 text-sm font-bold transition-colors ${collapsed ? 'justify-center' : 'justify-between'} ${
        active
          ? 'bg-white/[0.07] text-white shadow-[inset_3px_0_0_rgba(45,212,191,0.75)]'
          : 'text-brand-primary hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      {collapsed ? <span className="text-[11px] font-black tracking-tight">{item.marker}</span> : <span>{item.label}</span>}
    </Link>
  )
}

function ExternalHoursLink({ collapsed = false, onClick }: { collapsed?: boolean; onClick?: () => void }) {
  return (
    <a
      href={CG_HOURS_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={collapsed ? 'CG Hours, external' : undefined}
      title={collapsed ? 'CG Hours, external' : undefined}
      className={`group flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-brand-primary transition-colors hover:bg-white/[0.05] hover:text-white ${collapsed ? 'justify-center' : 'justify-between'}`}
    >
      <span>{collapsed ? 'CH' : 'CG Hours'}</span>
      {!collapsed && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-brand-primary/80 group-hover:border-white/20 group-hover:text-white">Ext</span>}
    </a>
  )
}

export default function AdminLayout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(true)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)
  const [zone, setZone] = useState<NavZone>(() => {
    const routeZone = resolveNavZone(location.pathname)
    if (!isSharedNavZonePath(location.pathname)) return routeZone
    const stored = window.localStorage.getItem(ZONE_STORAGE_KEY)
    return stored === 'performance' || stored === 'hub' ? stored : routeZone
  })
  const currentRole = profile?.role ?? 'team'
  const displayRole = roleLabel(profile?.role)
  const primaryItems = primaryNavItems.filter(item => canShowNavItem(item, currentRole))
  const performanceItems = performanceNavItems.filter(item => canShowNavItem(item, currentRole))
  const adminItems = adminNavItems.filter(item => canShowNavItem(item, currentRole))
  const zoneItems = zone === 'performance' ? performanceItems : primaryItems
  const mobilePrimaryItems = zoneItems.slice(0, 4)
  const assistantVisible = location.pathname !== '/admin/assistant'
  const closeMobile = () => setMobileMenuOpen(false)

  useEffect(() => {
    if (!isSharedNavZonePath(location.pathname)) setZone(resolveNavZone(location.pathname))
  }, [location.pathname])

  useEffect(() => {
    window.localStorage.setItem(ZONE_STORAGE_KEY, zone)
  }, [zone])

  async function refreshNotifications(showLoading = false) {
    if (showLoading) setNotificationsLoading(true)
    await refreshAssistantDayNotifications().catch(() => null)
    const [listResult, countResult] = await Promise.all([listMyNotifications(), unreadNotificationCount()])
    const error = listResult.error ?? countResult.error
    if (error) {
      setNotificationsError(error.message || 'Could not load notifications.')
    } else {
      setNotifications((listResult.data ?? []) as AppNotification[])
      setUnreadCount(countResult.count)
      setNotificationsError(null)
    }
    setNotificationsLoading(false)
  }

  const pollNotifications = useEffectEvent(() => {
    void refreshNotifications()
  })

  useEffect(() => {
    const initial = window.setTimeout(pollNotifications, 0)
    const poll = window.setInterval(pollNotifications, NOTIFICATION_POLL_MS)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') pollNotifications()
    }
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(poll)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  async function readNotification(notification: AppNotification) {
    if (notification.read_at) return true
    const result = await markNotificationRead(notification.id)
    if (result.error) {
      setNotificationsError(result.error.message || 'Could not mark the notification read.')
      return false
    }
    const readAt = new Date().toISOString()
    setNotifications(current => current.map(item => item.id === notification.id ? { ...item, read_at: readAt } : item))
    setUnreadCount(current => Math.max(0, current - 1))
    return true
  }

  async function readAllNotifications() {
    const result = await markAllNotificationsRead()
    if (result.error) {
      setNotificationsError(result.error.message || 'Could not mark notifications read.')
      return
    }
    const readAt = new Date().toISOString()
    setNotifications(current => current.map(item => item.read_at ? item : { ...item, read_at: readAt }))
    setUnreadCount(0)
  }

  async function snoozeNotification(notification: AppNotification) {
    const result = await snoozeAssistantNotification(notification.id, 30)
    if (result.error) { setNotificationsError(result.error.message); return }
    await refreshNotifications()
  }

  async function dismissNotification(notification: AppNotification) {
    const result = await dismissAssistantNotification(notification.id)
    if (result.error) { setNotificationsError(result.error.message); return }
    await refreshNotifications()
  }

  async function openNotification(notification: AppNotification) {
    const link = safeNotificationLink(notification)
    if (!link) return
    await readNotification(notification)
    setNotificationOpen(false)
    navigate(link)
  }

  function notificationButton(className = '', text?: string) {
    const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
    return (
      <button
        type="button"
        onClick={() => setNotificationOpen(open => !open)}
        className={`relative flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-lg text-brand-primary transition-colors hover:text-white ${className}`}
        aria-label={label}
        aria-expanded={notificationOpen}
        aria-controls="staff-notification-center"
        title={label}
      >
        <span aria-hidden="true">&#128276;</span>
        {text && <span className="text-sm font-bold">{text}</span>}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-brand-teal px-1 text-[10px] font-black text-black">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    )
  }

  function changeZone(nextZone: NavZone) {
    setZone(nextZone)
    navigate(nextZone === 'performance' ? '/admin/client-performance' : '/admin/cg-hub')
    closeMobile()
  }

  function renderNav(collapsed = false, onClick?: () => void) {
    return (
      <>
        {!collapsed && <ZoneSwitcher zone={zone} onChange={changeZone} className="mb-2" />}
        <NavSection label={zone === 'performance' ? 'Client performance' : 'Daily work'} collapsed={collapsed} />
        {zoneItems.map(item => <NavigationLink key={item.to} item={item} active={isNavItemActive(location.pathname, item)} collapsed={collapsed} onClick={onClick} />)}
        <div className={`${collapsed ? 'my-2' : 'mt-2'} border-t border-white/10 pt-2`}>
          <ExternalHoursLink collapsed={collapsed} onClick={onClick} />
        </div>
        {zone === 'hub' && adminItems.length > 0 && (
          <div className="mt-3 border-t border-white/10 pt-1" data-testid="admin-navigation">
            <NavSection label="Admin" collapsed={collapsed} />
            {adminItems.map(item => <NavigationLink key={item.to} item={item} active={isNavItemActive(location.pathname, item)} collapsed={collapsed} onClick={onClick} />)}
          </div>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg md:flex md:h-screen md:overflow-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-px bg-gradient-to-r from-transparent via-brand-teal/70 to-transparent" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur md:hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <BrandMark subtitle={displayRole} compact />
          <ZoneSwitcher zone={zone} onChange={changeZone} className="ml-auto hidden max-w-[12.5rem] shrink min-[560px]:flex" />
          <div className="ml-auto min-[560px]:ml-0">{notificationButton()}</div>
          <button type="button" onClick={() => setMobileMenuOpen(true)} className="min-h-11 shrink-0 rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm font-bold text-white" aria-expanded={mobileMenuOpen} aria-controls="staff-mobile-navigation">
            Menu
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/70" onClick={closeMobile} />
          <aside id="staff-mobile-navigation" className="absolute right-0 top-0 flex h-full w-[min(21rem,88vw)] max-w-full flex-col border-l border-white/10 bg-brand-surface shadow-2xl" aria-label="Staff navigation">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <BrandMark subtitle={displayRole} compact />
              <button type="button" onClick={closeMobile} className="min-h-11 rounded-md border border-white/10 px-3 text-sm font-semibold text-brand-primary hover:text-white">Close</button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">{renderNav(false, closeMobile)}</nav>
            <div className="border-t border-white/10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <UserBlock name={profile?.full_name ?? 'Staff user'} role={displayRole} onSignOut={signOut} />
            </div>
          </aside>
        </div>
      )}

      <aside className={`${desktopCollapsed ? 'w-20' : 'w-60'} hidden shrink-0 border-r border-white/10 bg-black/72 transition-[width] md:flex md:h-screen md:flex-col`} aria-label="Staff navigation">
        <div className={`flex items-center border-b border-white/10 py-4 ${desktopCollapsed ? 'flex-col justify-center gap-2 px-2' : 'justify-between gap-2 px-4'}`}>
          {desktopCollapsed ? <div className="w-9 overflow-hidden" title="CG Dynamics"><BrandMark subtitle="" compact /></div> : <BrandMark subtitle={displayRole} compact />}
          <button type="button" onClick={() => setDesktopCollapsed(value => !value)} className="min-h-9 min-w-9 rounded-md border border-white/10 px-2 text-xs font-black text-brand-primary hover:text-white" aria-label={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'} title={desktopCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
            {desktopCollapsed ? '>' : '<'}
          </button>
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2.5">{renderNav(desktopCollapsed)}</nav>
        <div className="border-t border-white/10 p-2.5">
          <div className={`mb-2 ${desktopCollapsed ? 'flex justify-center' : ''}`}>
            {notificationButton(desktopCollapsed ? '' : 'w-full justify-start gap-2 px-3', desktopCollapsed ? undefined : 'Notifications')}
          </div>
          <UserBlock name={profile?.full_name ?? 'Staff user'} role={displayRole} onSignOut={signOut} collapsed={desktopCollapsed} />
        </div>
      </aside>

      <main className={`min-w-0 flex-1 overflow-auto md:h-screen ${assistantVisible ? 'pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-16' : 'pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0'}`}>
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/92 backdrop-blur md:hidden" aria-label="Primary mobile navigation">
        <div className="grid grid-cols-5 gap-1 px-2 pt-1.5" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
          {mobilePrimaryItems.map(item => <MobileNavItem key={item.to} item={item} active={isNavItemActive(location.pathname, item)} />)}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="min-h-11 min-w-11 rounded-md px-1 text-center text-[11px] font-bold text-brand-primary transition-colors hover:text-white"
            aria-expanded={mobileMenuOpen}
            aria-controls="staff-mobile-navigation"
          >
            More
          </button>
        </div>
      </nav>

      {notificationOpen && (
        <section
          id="staff-notification-center"
          aria-label="Notifications"
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] top-[4.5rem] z-50 flex flex-col overflow-hidden rounded-xl border border-white/12 bg-brand-surface shadow-2xl md:inset-x-auto md:bottom-4 md:right-4 md:top-4 md:w-[25rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h2 className="font-black text-white">Notifications</h2>
              <p className="text-xs text-brand-primary/60">{unreadCount > 0 ? `${unreadCount} unread` : 'You are up to date'}</p>
            </div>
            <button type="button" onClick={() => setNotificationOpen(false)} className="min-h-11 min-w-11 rounded-md border border-white/10 px-2 text-sm font-bold text-brand-primary hover:text-white">Close</button>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
            <button type="button" onClick={() => void refreshNotifications(true)} className="min-h-11 rounded-md px-2 text-sm font-bold text-brand-teal hover:bg-white/[0.05]">Refresh</button>
            <button type="button" onClick={() => void readAllNotifications()} disabled={unreadCount === 0} className="min-h-11 rounded-md px-2 text-sm font-bold text-brand-primary hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40">Mark all read</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
            {notificationsLoading && <p className="px-2 py-8 text-center text-sm text-brand-primary/70">Loading notifications...</p>}
            {!notificationsLoading && notificationsError && (
              <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-100">
                <p>{notificationsError}</p>
                <button type="button" onClick={() => void refreshNotifications(true)} className="mt-2 min-h-11 font-bold underline">Try again</button>
              </div>
            )}
            {!notificationsLoading && !notificationsError && notifications.length === 0 && (
              <div className="px-3 py-10 text-center">
                <p className="font-bold text-white">No notifications yet</p>
                <p className="mt-1 text-sm text-brand-primary/60">Job, schedule, and task updates will appear here.</p>
              </div>
            )}
            {!notificationsLoading && notifications.length > 0 && (
              <ul className="space-y-2">
                {notifications.map(notification => {
                  const link = safeNotificationLink(notification)
                  return (
                    <li key={notification.id} className={`rounded-lg border p-3 ${notification.read_at ? 'border-white/8 bg-white/[0.02]' : 'border-brand-teal/25 bg-brand-teal/[0.06]'}`}>
                      <div className="flex items-start gap-2">
                        {!notification.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-teal" aria-label="Unread" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black text-white">{notification.title}</p>
                          <p className="mt-1 text-sm leading-5 text-brand-primary/75">{notification.body?.trim() || notificationFallback(notification.type)}</p>
                          <p className="mt-2 text-xs text-brand-primary/45">{notificationTime(notification.created_at)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap justify-end gap-2">
                        {(notification.type === 'assistant_day' || notification.type === 'assistant_reminder') && <button type="button" onClick={() => void snoozeNotification(notification)} className="min-h-11 rounded-md px-3 text-xs font-bold text-brand-primary hover:bg-white/[0.05] hover:text-white">Snooze 30m</button>}
                        {(notification.type === 'assistant_day' || notification.type === 'assistant_reminder') && <button type="button" onClick={() => void dismissNotification(notification)} className="min-h-11 rounded-md px-3 text-xs font-bold text-brand-primary hover:bg-white/[0.05] hover:text-white">Dismiss</button>}
                        {!notification.read_at && <button type="button" onClick={() => void readNotification(notification)} className="min-h-11 rounded-md px-3 text-xs font-bold text-brand-primary hover:bg-white/[0.05] hover:text-white">Mark read</button>}
                        {link && <button type="button" onClick={() => void openNotification(notification)} className="min-h-11 rounded-md bg-brand-teal/15 px-3 text-xs font-black text-brand-teal hover:bg-brand-teal/25">Open</button>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      <GlobalAssistantComposer />
    </div>
  )
}

function UserBlock({ name, role, onSignOut, collapsed = false }: { name: string; role: string; onSignOut: () => void; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="space-y-1.5 text-center" title={`${name}, ${role}`}>
        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal/10 text-xs font-black text-brand-teal" aria-label={`${name}, ${role}`}>{initials(name)}</div>
        <button onClick={onSignOut} className="min-h-9 w-full rounded-md text-xs font-black text-brand-primary hover:bg-white/[0.06] hover:text-white" aria-label="Sign out" title="Sign out">X</button>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 rounded-lg bg-white/[0.035] px-3 py-2">
        <p className="min-w-0 truncate text-sm font-bold text-white">{name}</p>
        <p className="shrink-0 text-xs text-brand-primary/65">{role}</p>
      </div>
      <button onClick={onSignOut} className="min-h-11 w-full rounded-md px-3 text-left text-sm font-semibold text-brand-primary transition-colors hover:bg-white/[0.06] hover:text-white">Sign out</button>
    </div>
  )
}

function MobileNavItem({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-11 min-w-11 items-center justify-center rounded-md px-1 py-2 text-center text-[11px] font-bold transition-colors ${active ? 'bg-white/[0.08] text-white shadow-[inset_0_2px_0_rgba(45,212,191,0.85)]' : 'text-brand-primary hover:text-white'}`}
    >
      {item.shortLabel}
    </Link>
  )
}
