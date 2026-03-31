import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Bio-Ledger] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <div className="max-w-md p-8 text-center">
            <h2 className="font-terminal text-lg font-bold text-red-400 mb-4">
              Something went wrong
            </h2>
            <p className="font-terminal text-sm text-muted-foreground mb-4">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-3 font-terminal text-sm font-semibold text-white rounded-xl border border-violet-400/50 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.28), rgba(99,102,241,0.20))' }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
