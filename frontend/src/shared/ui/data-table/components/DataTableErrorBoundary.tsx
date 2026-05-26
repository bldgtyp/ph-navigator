import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Component, type ErrorInfo, type ReactNode } from "react";

// Last-resort guard around the DataTable subtree. A bug in a cell
// renderer or editor must not blank the whole app — surface a small
// dismissible dialog instead, and log the underlying error so devs
// still see the stack.
//
// On dismiss we reload the route: a render-loop error means the
// component tree is unsalvageable in this session (clearing the
// boundary state would just re-throw on the next render), so a hard
// refresh is the only way back to a working table.
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

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <AlertDialog.Root open>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="data-table-alert-overlay" />
          <AlertDialog.Content className="data-table-alert-content">
            <AlertDialog.Title className="data-table-alert-title">
              Something went wrong
            </AlertDialog.Title>
            <AlertDialog.Description className="data-table-alert-description">
              The table couldn't render. Reload the page to recover.
            </AlertDialog.Description>
            <div className="data-table-alert-actions">
              <AlertDialog.Action asChild>
                <button type="button" className="primary-button" onClick={this.reload}>
                  Reload page
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    );
  }
}
