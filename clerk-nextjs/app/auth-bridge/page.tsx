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
  const [done, setDone] = useState(false)

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
          setDone(true)
          setStatus('Done! You can close this tab.')
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
      gap: '12px'
    }}>
      {done && (
        <img src="/icons/Browsersky.svg" alt="Browsersky" style={{ width: 80, height: 80, marginBottom: 4 }} />
      )}
      {!done && (
        <div style={{ width: 24, height: 24, border: '3px solid #111827', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      )}
      <p style={{ color: done ? '#16a34a' : '#374151', fontSize: 16 }}>{status}</p>
      {done && (
        <button onClick={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const runtime = (window as any).chrome?.runtime
          const extId = searchParams.get('extId')
          if (runtime && extId) {
            runtime.sendMessage(extId, { type: 'CLOSE_AUTH_TAB' }, () => {})
          }
        }} style={{ marginTop: 8, padding: '10px 24px', background: '#111827', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          Close tab
        </button>
      )}
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
