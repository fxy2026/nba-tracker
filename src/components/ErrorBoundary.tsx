"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; fallbackMessage?: string; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-text-secondary">
          <AlertTriangle size={32} className="text-danger mb-3" />
          <p className="text-lg font-medium text-text-primary mb-1">Something went wrong</p>
          <p className="text-sm mb-4">{this.props.fallbackMessage || "Failed to load this section"}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors text-sm"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
