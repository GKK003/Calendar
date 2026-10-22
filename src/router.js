import { useCallback, useEffect, useState } from 'react'

// view name <-> URL path
export const PATHS = {
  today: '/',
  month: '/month',
  year: '/year',
  gallery: '/gallery',
  games: '/games',
  chat: '/chat',
  profile: '/profile',
}

export function viewFromPath(pathname) {
  const seg = '/' + (pathname.split('/')[1] || '')
  return Object.keys(PATHS).find((k) => PATHS[k] === seg) || 'today'
}

export function navigate(path, { replace = false } = {}) {
  if (path === window.location.pathname) return
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
  window.dispatchEvent(new Event('app:navigate'))
}

export function usePath() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    window.addEventListener('popstate', sync) // back / forward buttons
    window.addEventListener('app:navigate', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('app:navigate', sync)
    }
  }, [])
  return path
}

export function useView() {
  const path = usePath()
  const view = viewFromPath(path)
  const setView = useCallback((v) => navigate(PATHS[v] || '/'), [])
  return [view, setView]
}
