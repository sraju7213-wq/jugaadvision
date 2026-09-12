import React, { Component, ErrorInfo, ReactNode } from 'react';

export interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

export interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    constructor(props: Props) {
        super(props);
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-8 motion-fade">
                    <div className="w-14 h-14 bg-[var(--ui-error-soft)] border border-[var(--ui-error)]/30 flex items-center justify-center mb-4">
                        <svg className="w-6 h-6 text-[var(--ui-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="font-serif text-xl text-[var(--ui-ink)] mb-2">
                        Something went wrong
                    </h3>
                    <p className="text-xs font-mono text-[var(--ui-muted)] mb-5 max-w-md">
                        We encountered an error loading this creative module. Try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="editorial-button editorial-button--primary editorial-button--sm"
                    >
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
