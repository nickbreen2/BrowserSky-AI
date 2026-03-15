'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InfiniteGridBg } from '@/components/ui/infinite-grid-bg'
import { Header } from '@/components/ui/header-2'
import { Footer } from '@/components/ui/footer'

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

    if (!extId) {
      setStatus('done')
      return
    }

    if (!isSignedIn) {
      const redirectBack = `/auth-bridge?extId=${extId}&mode=${mode}`
      const dest = mode === 'sign-up' ? '/sign-up' : '/sign-in'
      router.push(`${dest}?redirect_url=${encodeURIComponent(redirectBack)}`)
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
        minHeight: '100vh',
        fontFamily: 'var(--font-gelasio), serif',
        backgroundColor: '#0f1f27',
        display: 'flex',
        flexDirection: 'column',
        color: 'white',
      }}
    >
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <InfiniteGridBg />

        <Header />

      {/* Page content */}
      {showSetupGuide ? (
        <div className="relative z-10 flex flex-1 flex-col gap-10 px-6 pt-28 pb-16 md:flex-row md:gap-16 md:px-16 md:pt-36 lg:px-20">
          {/* Left column */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingBottom: 40,
            }}
          >
            {/* Badge */}
            <div
              style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                backgroundColor: 'rgba(99,102,241,0.15)',
                color: '#a5b4fc',
                fontSize: 13,
                fontWeight: 600,
                padding: '5px 14px',
                borderRadius: 999,
                marginBottom: 14,
                border: '1px solid rgba(99,102,241,0.3)',
              }}
            >
              BrowserSky Chrome Extension
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-gelasio), serif',
                fontSize: 'clamp(28px, 5vw, 44px)',
                fontWeight: 800,
                color: '#ffffff',
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

            <p style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
              Chat with any page
            </p>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
              Press Command + B (Mac) or Ctrl + M (Windows) to summon BrowserSky on any website.
            </p>
          </div>

          {/* Right column */}
          <div
            className="w-full md:w-auto md:flex-none"
            style={{
              flex: '0 0 340px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 16,
              paddingBottom: 40,
            }}
          >
            {/* Step 1 */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                Step 1: Press the Command Key
              </p>
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
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
              <p style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                Step 2: Pin BrowserSky AI
              </p>
              <div
                style={{
                  borderRadius: 14,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 2px 20px rgba(0,0,0,0.3)',
                }}
              >
                <img
                  src="/icons/Pin-Extension-Image.svg"
                  alt="Pin BrowserSky AI in the extensions menu"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              Need assistance?{' '}
              <a
                href="mailto:support@browsersky.ai"
                style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}
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
            position: 'relative',
            zIndex: 1,
          }}
        >
          {!isError && (
            <div
              style={{
                width: 24,
                height: 24,
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          )}
          <p style={{ color: isError ? '#f87171' : 'rgba(255,255,255,0.7)', fontSize: 16 }}>{status}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      </div>
      <Footer />
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
            backgroundColor: '#0f1f27',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-gelasio), serif',
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
