import { supabase } from './supabase'

export type WebPushState = {
  supported: boolean
  standalone: boolean
  permission: NotificationPermission | 'unsupported'
  browserSubscription: boolean
  serverSubscription: boolean
  configured: boolean
}

type PushConfigResponse = { ok: boolean; configured: boolean; publicKey?: string; error?: string }

function isStandaloneApp() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true
}

export function webPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)))
}

async function registration() {
  await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  return navigator.serviceWorker.ready
}

async function config(): Promise<PushConfigResponse> {
  const { data, error } = await supabase.functions.invoke('web-push-config', { body: {} })
  if (error) return { ok: false, configured: false, error: error.message }
  return data as PushConfigResponse
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!webPushSupported()) return {
    supported: false, standalone: isStandaloneApp(), permission: 'unsupported',
    browserSubscription: false, serverSubscription: false, configured: false,
  }
  const [reg, cfg] = await Promise.all([registration(), config()])
  const subscription = await reg.pushManager.getSubscription()
  let serverSubscription = false
  if (subscription) {
    const { data } = await supabase.rpc('my_web_push_subscription_status', { p_endpoint: subscription.endpoint })
    const row = Array.isArray(data) ? data[0] : data
    serverSubscription = Boolean(row?.active)
  }
  return {
    supported: true,
    standalone: isStandaloneApp(),
    permission: Notification.permission,
    browserSubscription: Boolean(subscription),
    serverSubscription,
    configured: Boolean(cfg.ok && cfg.configured && cfg.publicKey),
  }
}

export async function enableWebPush(deviceLabel = 'CG Dynamics device') {
  if (!webPushSupported()) throw new Error('This browser does not support Web Push.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked in device settings.' : 'Notification permission was not granted.')
  const cfg = await config()
  if (!cfg.ok || !cfg.configured || !cfg.publicKey) throw new Error(cfg.error ?? 'Push delivery is not configured yet.')
  const reg = await registration()
  const existing = await reg.pushManager.getSubscription()
  const subscription = existing ?? await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
  })
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('The device returned an incomplete push subscription.')
  const { error } = await supabase.rpc('register_my_web_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth_secret: json.keys.auth,
    p_user_agent: navigator.userAgent,
    p_device_label: deviceLabel,
  })
  if (error) throw new Error(error.message)
  return getWebPushState()
}

export async function disableWebPush() {
  if (!webPushSupported()) return
  const reg = await registration()
  const subscription = await reg.pushManager.getSubscription()
  if (!subscription) return
  const { error } = await supabase.rpc('unregister_my_web_push_subscription', { p_endpoint: subscription.endpoint })
  if (error) throw new Error(error.message)
  await subscription.unsubscribe()
}

export async function sendWebPushTest() {
  const { data, error } = await supabase.rpc('send_my_test_push_notification')
  if (error) throw new Error(error.message)
  return data as string
}
