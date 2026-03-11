'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function AuthBridge() {
  const { getToken, isSignedIn, isLoaded } = useAuth()
  const { user } = useUser()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState('Connecting to extension...')

  useEffect(() => {
    if (!isLoaded) return

    const extId = searchParams.get('extId')
    const mode = searchParams.get('mode') ?? 'sign-in'

    if (!isSignedIn) {
      const redirectBack = `/auth-bridge?extId=${extId}&mode=${mode}`
      const dest = mode === 'sign-up' ? '/sign-up' : '/sign-in'
      router.push(`${dest}?redirect_url=${encodeURIComponent(redirectBack)}`)
      return
    }

    if (!extId) {
      setStatus('Error: Extension ID missing. Please try again from the extension.')
      return
    }

    async function sendToken() {
      try {
        const token = await getToken()
        if (!token) {
          setStatus('Error: Could not get auth token. Please sign in again.')
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chromeRuntime = (window as any).chrome?.runtime
        if (!chromeRuntime) {
          setStatus('Error: Chrome extension API not available.')
          return
        }

        const userInfo = {
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
          email: user?.primaryEmailAddress?.emailAddress ?? '',
        }

        chromeRuntime.sendMessage(extId, { type: 'CLERK_TOKEN', token, user: userInfo }, () => {
          if (chromeRuntime.lastError) {
            setStatus('Error: Could not reach extension. Make sure it is installed and active.')
            return
          }
          window.close()
        })
      } catch (err: unknown) {
        setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
    }

    sendToken()
  }, [isLoaded, isSignedIn, searchParams, getToken, router])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      gap: '12px',
      backgroundImage: 'url(/icons/Browsersky-background.svg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <div style={{ position: 'fixed', top: 20, left: 24 }}>
        <img src="/icons/BrowserSky.svg" alt="Browsersky" style={{ height: 36 }} />
      </div>
      <div style={{ width: 24, height: 24, border: '3px solid #111827', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: '#374151', fontSize: 16 }}>{status}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function AuthBridgePage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>}>
      <AuthBridge />
    </Suspense>
  )
}
