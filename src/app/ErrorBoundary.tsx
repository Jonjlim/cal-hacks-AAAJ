import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (error: Error) => ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack);
  }

  override render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}
