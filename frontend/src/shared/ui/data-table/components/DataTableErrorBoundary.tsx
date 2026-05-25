import { Component, type ErrorInfo, type ReactNode } from "react";

// Last-resort guard around the DataTable subtree. A bug in a cell
// renderer or editor must not blank the whole app — render an inline
// panel instead, and surface the error to the console so developers
// still see the stack.
type Props = { children: ReactNode };
type State = { error: Error | null };

export class DataTableErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("DataTable crashed:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="data-table-error-boundary" role="alert">
        <p className="data-table-error-boundary__title">
          Something went wrong rendering this table.
        </p>
        <p className="data-table-error-boundary__message">{this.state.error.message}</p>
        <button type="button" onClick={this.reset}>
          Try again
        </button>
      </div>
    );
  }
}
