import { Component, ErrorInfo, ReactNode } from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleReturnToSafety = () => {
    this.setState({ hasError: false, error: null });
    // Clear potentially corrupted local draft storage safely
    try {
      window.location.href = window.location.pathname;
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 text-text-primary">
          <div className="max-w-md w-full bg-surface border border-status-error/30 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-status-error/15 text-status-error flex items-center justify-center mb-4">
              <FiAlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-semibold text-text-primary mb-2">
              Something unexpected occurred
            </h2>

            <p className="text-xs text-text-secondary leading-relaxed mb-4">
              Askable encountered an unexpected view error. Rather than breaking your session, you can reload the view or return to the safe demo sandbox.
            </p>

            {this.state.error?.message && (
              <div className="p-3 rounded-lg bg-bg-primary border border-border text-[11px] font-mono text-status-error break-all mb-5">
                {this.state.error.message}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors"
              >
                <FiRefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>
              <button
                onClick={this.handleReturnToSafety}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-bg-secondary hover:bg-bg-hover text-text-primary border border-border text-xs font-medium transition-colors"
              >
                <FiHome className="w-3.5 h-3.5" />
                Demo Sandbox
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
