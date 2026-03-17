import { SignUp } from '@clerk/nextjs'
import { Footer } from '@/components/ui/footer'
import { InfiniteGridBg } from '@/components/ui/infinite-grid-bg'
import Image from 'next/image'
import Link from 'next/link'

export default function SignUpPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a1520',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <InfiniteGridBg />

      {/* Center content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 'clamp(32px, 6vw, 60px) 16px 40px',
        position: 'relative',
        zIndex: 1,
        gap: '24px',
      }}>
        {/* Logo */}
        <Link href="/">
          <Image
            src="/icons/BrowserSky-white-mode.svg"
            alt="BrowserSky"
            width={140}
            height={24}
            className="h-6 w-auto"
          />
        </Link>

        <SignUp
          appearance={{
            variables: {
              colorPrimary: '#3b82f6',
              colorBackground: '#192431',
              colorInputBackground: '#0f1a26',
              colorInputText: '#f1f5f9',
              colorText: '#f1f5f9',
              colorTextSecondary: 'rgba(241,245,249,0.75)',
              colorNeutral: '#f1f5f9',
              borderRadius: '14px',
              fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
              fontSize: '15px',
            },
            elements: {
              logoBox: {
                display: 'none',
              },
              cardBox: {
                background: '#192431',
                border: '1px solid rgba(255,255,255,0.16)',
                boxShadow: '0 4px 40px rgba(0,0,0,0.5)',
                borderRadius: '14px',
                width: '100%',
                maxWidth: '400px',
                overflow: 'hidden',
              },
              card: {
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                padding: '32px',
                width: '100%',
              },
              headerTitle: {
                color: '#f1f5f9',
                fontSize: '20px',
                fontWeight: '600',
                letterSpacing: '-0.01em',
              },
              headerSubtitle: {
                color: 'rgba(241,245,249,0.45)',
                fontSize: '14px',
              },
              socialButtonsBlockButton: {
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: '#1a2b3c',
                color: '#f1f5f9',
                borderRadius: '10px',
                height: '44px',
                transition: 'background 0.15s',
              },
              socialButtonsBlockButtonText: {
                color: '#f1f5f9',
                fontWeight: '500',
              },
              dividerLine: {
                backgroundColor: 'rgba(255,255,255,0.08)',
              },
              dividerText: {
                color: 'rgba(241,245,249,0.5)',
                fontSize: '13px',
              },
              formFieldLabel: {
                color: 'rgba(241,245,249,0.6)',
                fontSize: '13px',
                fontWeight: '500',
              },
              formFieldInput: {
                backgroundColor: '#0f1a26',
                border: '1px solid transparent',
                borderRadius: '10px',
                color: '#f1f5f9',
                height: '44px',
              },
              formButtonPrimary: {
                backgroundColor: '#3b82f6',
                borderRadius: '10px',
                height: '44px',
                fontSize: '15px',
                fontWeight: '500',
              },
              footerActionLink: {
                color: '#60a5fa',
              },
              footerActionText: {
                color: 'rgba(241,245,249,0.75)',
              },
              footerAction: {
                paddingTop: '8px',
              },
              identityPreviewText: {
                color: '#f1f5f9',
              },
              identityPreviewEditButton: {
                color: '#60a5fa',
              },
            },
          }}
        />
      </div>

      <Footer />
    </div>
  )
}
