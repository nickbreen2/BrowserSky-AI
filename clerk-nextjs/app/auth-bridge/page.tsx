'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InfiniteGridBg } from '@/components/ui/infinite-grid-bg'

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
    const sourceTabId = searchParams.get('sourceTabId')

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

        const sourceTabIdNum = sourceTabId ? parseInt(sourceTabId, 10) : null
        chromeRuntime.sendMessage(extId, { type: 'CLERK_TOKEN', token, user: userInfo, sourceTabId: sourceTabIdNum }, () => {
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
        height: '100vh',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <InfiniteGridBg />
      {/* Navbar */}
      <nav
        style={{
          height: 64,
          borderBottom: '1px solid #F3F4F6',
          display: 'flex',
          alignItems: 'center',
          padding: '0 78px',
          flexShrink: 0,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <img src="/icons/Browsersky-1.svg" alt="BrowserSky AI" style={{ height: 32 }} />
      </nav>

      {/* Page content */}
      {showSetupGuide ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            padding: '0 78px',
            gap: 64,
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Left column */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingBottom: 80,
            }}
          >
            {/* Badge */}
            <div
              style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                backgroundColor: '#EEF2FF',
                color: '#4F46E5',
                fontSize: 13,
                fontWeight: 600,
                padding: '5px 14px',
                borderRadius: 999,
                marginBottom: 14,
              }}
            >
              BrowserSky Chrome Extension
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-gelasio), serif',
                fontSize: 44,
                fontWeight: 800,
                color: '#111827',
                lineHeight: 1.1,
                margin: '0 0 20px 0',
                maxWidth: 560,
              }}
            >
              Your AI browsing assistant is ready to help.
            </h1>

            <img
              src="/icons/command-b-closeup.png"
              alt="Command B keyboard shortcut"
              style={{
                width: '100%',
                maxWidth: 420,
                height: 'auto',
                borderRadius: 14,
                marginBottom: 14,
              }}
            />

            <p style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px 0' }}>
              Chat with any page
            </p>
            <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.6 }}>
              Press Command + B (Mac) or Ctrl + M (Windows) to summon BrowserSky on any website.
            </p>
          </div>

          {/* Right column */}
          <div
            style={{
              flex: '0 0 340px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 16,
              paddingTop: 24,
              paddingBottom: 80,
            }}
          >
            {/* Step 1 */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>
                Step 1: Press the Command Key
              </p>
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
              >
                <img
                  src="/icons/Command-Key-Image.svg"
                  alt="Press the command key in the browser toolbar"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>

            {/* Step 2 */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', margin: '0 0 8px 0' }}>
                Step 2: Pin BrowserSky AI
              </p>
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
              >
                <img
                  src="/icons/Pin-Extension-Image.svg"
                  alt="Pin BrowserSky AI in the extensions menu"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>
              Need assistance?{' '}
              <a
                href="mailto:support@browsersky.ai"
                style={{ color: '#4F46E5', fontWeight: 600, textDecoration: 'none' }}
              >
                Feel free to reach out!
              </a>
            </p>
          </div>
        </div>
      ) : (
        /* Loading or error state */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
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
