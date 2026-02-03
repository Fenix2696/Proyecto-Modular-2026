import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🔥 ErrorBoundary atrapó un error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: 'white',
          padding: '40px',
          textAlign: 'center'
        }}>
          <h1>⚠️ Algo salió mal</h1>
          <p>Ocurrió un error inesperado en el dashboard.</p>
          <pre style={{
            background: '#020617',
            padding: '15px',
            borderRadius: '8px',
            maxWidth: '800px',
            overflow: 'auto',
            marginTop: '20px',
            color: '#38bdf8'
          }}>
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '25px',
              padding: '12px 20px',
              borderRadius: '8px',
              border: 'none',
              background: '#3b82f6',
              color: 'white',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            🔄 Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
