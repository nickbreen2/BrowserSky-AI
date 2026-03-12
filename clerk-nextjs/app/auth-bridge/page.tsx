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
          setStatus('done')
        })
      } catch (err: unknown) {
        setStatus('Error: ' + (err instanceof Error ? err.message : 'Unknown error'))
      }
    }

    sendToken()
  }, [isLoaded, isSignedIn, searchParams, getToken, router])

  const showSetupGuide = status === 'done'
  const isError = status.startsWith('Error:')

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header logo */}
      <div style={{ position: 'fixed', top: 20, left: 24, zIndex: 10 }}>
        <img src="/icons/Browsersky-1.svg" alt="BrowserSky AI" style={{ height: 36 }} />
      </div>

      {showSetupGuide ? (
        /* How to set up the extension */
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 48,
            maxWidth: 1100,
            margin: '0 auto',
            padding: '100px 48px 80px',
            alignItems: 'flex-start',
          }}
        >
          {/* Left column */}
          <div style={{ flex: 1 }}>
            <h1
              style={{
                fontFamily: 'var(--font-gelasio), serif',
                fontSize: 28,
                fontWeight: 600,
                color: '#111827',
                marginBottom: 48,
                lineHeight: 1.2,
              }}
            >
              Enhance Your Browsing Experience with BrowserSky AI
            </h1>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <img
                src="/icons/command-b-keys.png"
                alt="Command B keyboard shortcut"
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
              />
              <div>
                <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                  Chat with any page
                </p>
                <p style={{ fontSize: 14, color: '#6B7280', margin: '8px 0 0 0', lineHeight: 1.5 }}>
                  Press Command B (Mac) or Ctrl + M (Windows) to open BrowserSky.
                </p>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 40 }}>
            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: 16,
                }}
              >
                Step 1: Press the Command Key
              </h2>
              <img
                src="/icons/Command-Key-Image.svg"
                alt="Click the extensions puzzle piece icon in the browser toolbar"
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
              />
            </div>

            <div>
              <h2
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: 16,
                }}
              >
                Step 2: Pin BrowserSky AI
              </h2>
              <img
                src="/icons/Pin-Extension-Image.svg"
                alt="Pin the BrowserSky AI extension in the extensions menu"
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Loading or error state */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            gap: 12,
          }}
        >
          {!isError && (
            <div
              style={{
                width: 24,
                height: 24,
                border: '3px solid #111827',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          <p style={{ color: isError ? '#DC2626' : '#374151', fontSize: 16 }}>{status}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}

export default function AuthBridgePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          Loading...
        </div>
      }
    >
      <AuthBridge />
    </Suspense>
  )
}
