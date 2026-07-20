import { Component } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
class ErrorBoundaryInner extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, refId: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const refId = Math.random().toString(36).substring(2, 9).toUpperCase();
    this.setState({ refId });
    // In production, log the reference ID with the error
    console.error(`[ErrorBoundary] Reference ID: ${refId}`);
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    // FAST-FOLLOW: wire caught frontend errors into Sentry once frontend SDK is added
  }

  componentDidUpdate(prevProps) {
    // Reset the error boundary if the user navigates away
    if (this.state.hasError && this.props.location !== prevProps.location) {
      this.setState({ hasError: false, error: null, refId: null });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, refId: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, refId: null });
    this.props.navigate('/dashboard');
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;

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
            maxWidth: '32rem',
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
              marginBottom: '1.5rem',
            }}>
              An unexpected error occurred. Your data is safe. Please try reloading the page.
            </p>

            {/* Production reference ID */}
            {!isDev && this.state.refId && (
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '0.75rem',
                padding: '0.75rem',
                marginBottom: '2rem',
                display: 'inline-block',
                border: '1px dashed rgba(255,255,255,0.2)'
              }}>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Reference ID: </span>
                <span style={{ color: '#ffffff', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                  {this.state.refId}
                </span>
              </div>
            )}

            {/* Development Error detail */}
            {isDev && this.state.error && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '2rem',
                textAlign: 'left',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                <p style={{
                  color: '#f87171',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  marginBottom: '0.5rem',
                  wordBreak: 'break-word',
                  margin: 0,
                }}>
                  {this.state.error.toString()}
                </p>
                {this.state.error.stack && (
                  <pre style={{
                    color: '#fca5a5',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    marginTop: '0.5rem'
                  }}>
                    {this.state.error.stack}
                  </pre>
                )}
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

export default function ErrorBoundary(props) {
  const location = useLocation();
  const navigate = useNavigate();
  return <ErrorBoundaryInner location={location.pathname} navigate={navigate} {...props} />;
}
