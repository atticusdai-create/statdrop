import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'pwa-banner-dismissed'

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    if (standalone) return

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    if (ios) {
      // Only show on iOS Safari (not Chrome iOS which can't install PWAs)
      const isSafari = /^((?!CriOS|FxiOS|OPiOS|mercury).)*Safari/.test(navigator.userAgent)
      if (isSafari) setShow(true)
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
    }
    dismiss()
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '12px 16px',
        background: '#0f172a',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      {/* App icon */}
      <img
        src="/favicon.svg"
        alt="StatDrop"
        style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
      />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, color: '#fff', fontWeight: 600, fontSize: 14 }}>
          Add StatDrop to your home screen
        </p>
        {isIOS ? (
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            Tap <span style={{ fontSize: 16 }}>⎋</span> Share, then &ldquo;Add to Home Screen&rdquo;
          </p>
        ) : (
          <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
            Install for quick access, offline use &amp; full screen
          </p>
        )}
      </div>

      {/* CTA / dismiss */}
      {!isIOS && (
        <button
          onClick={handleInstall}
          style={{
            flexShrink: 0,
            background: '#1A5CFF',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontFamily: 'inherit',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Install
        </button>
      )}

      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          background: 'transparent',
          color: 'rgba(255,255,255,0.5)',
          border: 'none',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '4px 6px',
        }}
      >
        ×
      </button>
    </div>
  )
}
