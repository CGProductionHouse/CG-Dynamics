import type { BusinessOAuthConfig } from './tiktokBusinessOAuth.ts'

export function businessOAuthConfig(env: (name: string) => string | undefined): BusinessOAuthConfig {
  const url = env('SUPABASE_URL')
  const redirectUri = env('TIKTOK_BUSINESS_REDIRECT_URI') ?? ''
  if (!url || redirectUri !== `${url.replace(/\/$/, '')}/functions/v1/tiktok-business-oauth-callback`) throw new Error('TikTok Business callback configuration unavailable.')
  return { appId: env('TIKTOK_BUSINESS_APP_ID') ?? '', appSecret: env('TIKTOK_BUSINESS_APP_SECRET') ?? '', redirectUri,
    key: env('TIKTOK_BUSINESS_TOKEN_ENCRYPTION_KEY') ?? '', keyVersion: env('TIKTOK_BUSINESS_TOKEN_KEY_VERSION') ?? '',
    appUrl: env('APP_URL') ?? 'https://www.cgdynamics.co.za' }
}
