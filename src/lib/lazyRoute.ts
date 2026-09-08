import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const ROUTE_RELOAD_KEY = 'cg-route-import-reload-v1'

// React's own lazy() contract uses ComponentType<any>; preserving that generic
// lets each route keep its real prop type while the loader is wrapped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RouteComponent = ComponentType<any>
type RouteModule<T extends RouteComponent> = { default: T }

/**
 * Recovers a long-lived browser tab after a deployment replaces its lazy route
 * chunks. One automatic reload gets the current asset manifest; a second
 * failure reaches RouteLoadBoundary instead of looping or leaving a blank page.
 */
export function lazyRoute<T extends RouteComponent>(
  load: () => Promise<RouteModule<T>>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    const routeKey = `${window.location.pathname}${window.location.search}`

    try {
      const loaded = await load()
      window.sessionStorage.removeItem(ROUTE_RELOAD_KEY)
      return loaded
    } catch (error) {
      const attemptedRoute = window.sessionStorage.getItem(ROUTE_RELOAD_KEY)
      if (attemptedRoute !== routeKey) {
        window.sessionStorage.setItem(ROUTE_RELOAD_KEY, routeKey)
        window.location.reload()
        return new Promise<RouteModule<T>>(() => undefined)
      }

      window.sessionStorage.removeItem(ROUTE_RELOAD_KEY)
      throw error
    }
  })
}
