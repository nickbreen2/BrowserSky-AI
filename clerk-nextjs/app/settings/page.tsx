'use client'

import { useUser, useClerk } from '@clerk/nextjs'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SettingsContent() {
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const searchParams = useSearchParams()
  const [clearStatus, setClearStatus] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const extId = searchParams.get('extId')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getRuntime = () => (window as any).chrome?.runtime

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      const extParam = extId ? `?extId=${extId}` : ''
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(`/settings${extParam}`)}`
    }
  }, [isLoaded, isSignedIn, extId])

  const handleSignOut = async () => {
    setSigningOut(true)
    if (extId) {
      const runtime = getRuntime()
      if (runtime) {
        runtime.sendMessage(extId, { type: 'SIGN_OUT' }, () => {})
      }
    }
    await signOut()
  }

  const handleClearData = () => {
    if (!extId) {
      setClearStatus('Error: Extension ID missing. Open settings from the extension.')
      return
    }
    const runtime = getRuntime()
    if (!runtime) {
      setClearStatus('Error: Chrome extension API not available.')
      return
    }
    runtime.sendMessage(extId, { type: 'CLEAR_ALL_DATA' }, () => {
      if (runtime.lastError) {
        setClearStatus('Error: Could not reach extension.')
        return
      }
      setClearStatus('All conversations cleared.')
    })
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Loading...
      </div>
    )
  }

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'User'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''
  const initial = fullName.charAt(0).toUpperCase()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <img src="/icons/Browsersky.svg" alt="Browsersky" style={{ width: 28, height: 28 }} />
        <span style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>Browsersky AI — Settings</span>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 480, margin: '32px auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Account section */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>
            Account
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: '#2563eb', color: 'white',
              fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{fullName}</span>
              <span style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            style={{
              width: '100%', padding: '9px 16px',
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: signingOut ? 'not-allowed' : 'pointer',
              opacity: signingOut ? 0.6 : 1,
              transition: 'background 0.15s',
            }}
          >
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>

        {/* Data section */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af' }}>
            Data
          </span>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            Clear all conversation history across all tabs.
          </p>
          <button
            onClick={handleClearData}
            style={{
              width: '100%', padding: '9px 16px',
              background: '#f3f4f6', color: '#374151',
              border: '1px solid #e5e7eb', borderRadius: 8,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            Clear All Conversations
          </button>
          {clearStatus && (
            <p style={{
              margin: 0, fontSize: 13, fontWeight: 500,
              color: clearStatus.startsWith('Error') ? '#dc2626' : '#16a34a',
            }}>
              {clearStatus}
            </p>
          )}
        </div>

      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
