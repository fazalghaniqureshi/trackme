import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container-fluid p-4">
          <div className="alert alert-danger">
            <h5 className="alert-heading mb-2">Something went wrong</h5>
            <p className="mb-3" style={{ fontFamily: 'monospace', fontSize: 13 }}>
              {this.state.error.message}
            </p>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
