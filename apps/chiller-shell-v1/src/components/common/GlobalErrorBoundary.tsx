import { Component, type ErrorInfo, type ReactNode } from "react";

type GlobalErrorBoundaryProps = {
  children: ReactNode;
};

type GlobalErrorBoundaryState = {
  errorMessage: string | null;
};

export default class GlobalErrorBoundary extends Component<
  GlobalErrorBoundaryProps,
  GlobalErrorBoundaryState
> {
  state: GlobalErrorBoundaryState = {
    errorMessage: null
  };

  static getDerivedStateFromError(error: unknown): GlobalErrorBoundaryState {
    return {
      errorMessage: error instanceof Error ? error.stack || error.message : String(error)
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    const details = [
      error instanceof Error ? error.stack || error.message : String(error),
      info.componentStack
    ]
      .filter(Boolean)
      .join("\n");
    this.setState({ errorMessage: details || "Unknown render error" });
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <pre
          style={{
            position: "fixed",
            inset: "24px",
            zIndex: 99998,
            margin: 0,
            padding: "16px 18px",
            overflow: "auto",
            borderRadius: "18px",
            background: "rgba(13, 19, 32, 0.96)",
            color: "#f7fbff",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
            whiteSpace: "pre-wrap",
            font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace"
          }}
        >
          {"渲染失败\n" + this.state.errorMessage}
        </pre>
      );
    }
    return this.props.children;
  }
}
