"use client";

import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** Section name for error context */
  section?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary that catches React render crashes.
 * Shows a clean error card instead of killing the entire page.
 * Used around charts, sections, and data-dependent components.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? ` — ${this.props.section}` : ''}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-500 mb-1">
            {this.props.section ? `${this.props.section} failed to render` : 'Something went wrong'}
          </p>
          <p className="text-xs text-zinc-400 mb-3">
            {this.state.error?.message?.slice(0, 100) ?? 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-600 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
