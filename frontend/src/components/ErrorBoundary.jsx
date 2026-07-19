import { Component } from 'react';

/**
 * ErrorBoundary — Global React crash handler.
 *
 * Catches JavaScript errors anywhere in the component tree below it,
 * logs the error, and renders a user-friendly fallback UI instead of
 * a blank white screen.
 *
 * This is a class component because React does not yet support
 * componentDidCatch / getDerivedStateFromError via hooks.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.replace('/dashboard');
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '1.5rem',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '2rem',
            padding: '3rem',
            maxWidth: '28rem',
            width: '100%',
            textAlign: 'center',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Icon */}
            <div style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '1rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto',
              fontSize: '1.5rem',
            }}>
              ⚠️
            </div>

            <h1 style={{
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 800,
              marginBottom: '0.5rem',
              letterSpacing: '-0.025em',
            }}>
              Something Went Wrong
            </h1>

            <p style={{
              color: '#94a3b8',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              marginBottom: '2rem',
            }}>
              An unexpected error occurred. Your data is safe. Please try reloading the page.
            </p>

            {/* Error detail (collapsed for production) */}
            {this.state.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '0.75rem',
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
              }}>
                <p style={{
                  color: '#f87171',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6366f1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.target.style.background = '#4f46e5'; }}
                onMouseOut={(e) => { e.target.style.background = '#6366f1'; }}
              >
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { e.target.style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseOut={(e) => { e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              >
                Go to Dashboard
              </button>
            </div>

            <p style={{
              color: '#475569',
              fontSize: '0.65rem',
              marginTop: '2rem',
              fontFamily: 'monospace',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Quranific Security • Error Boundary
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
