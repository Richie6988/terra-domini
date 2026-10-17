// BUILD_TS: 1773933303
import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/** Last-resort crash screen: shows the error instead of an empty page (and lets the player recover). */
class RootErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[HEXOD crash]', error, info.componentStack) }
  render() {
    const e = this.state.error
    if (!e) return this.props.children
    const box: React.CSSProperties = { maxWidth: 560, margin: '12vh auto', padding: 24, borderRadius: 20, background: '#1b3f85',
      border: '3px solid #071533', boxShadow: '0 6px 0 #0a1838', color: '#fff', fontFamily: 'system-ui, sans-serif' }
    const btn: React.CSSProperties = { padding: '12px 18px', borderRadius: 12, border: '2px solid rgba(0,0,0,.35)', fontWeight: 800, cursor: 'pointer', marginRight: 10 }
    return (
      <div style={{ minHeight: '100vh', background: '#0c1a36', padding: 16 }}>
        <div style={box}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>HEXOD hit an error</div>
          <div style={{ fontSize: 14, opacity: .9, marginBottom: 12 }}>Please send this message to the team:</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'rgba(0,0,0,.35)', padding: 12, borderRadius: 10, maxHeight: 220, overflow: 'auto' }}>
            {String(e?.message || e)}{'\n'}{(e?.stack || '').split('\n').slice(0, 6).join('\n')}
          </pre>
          <div style={{ marginTop: 14 }}>
            <button style={{ ...btn, background: '#34d058', color: '#fff' }} onClick={() => location.reload()}>Reload</button>
            <button style={{ ...btn, background: '#f59e0b', color: '#fff' }} onClick={() => {
              try { localStorage.removeItem('hexod-store') } catch { /* ignore */ }
              location.href = '/login'
            }}>Reset & log in again</button>
          </div>
        </div>
      </div>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)
