import { Component, type ReactNode } from "react";
import ErrorPage from "../../pages/errors/ErrorPage";
import { DataApiError } from "../../lib/neon-data-api/errors";
export default class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; chunk: boolean }
> {
  state = { failed: false, chunk: false };
  static getDerivedStateFromError(error: unknown) {
    // A lazy chunk deleted by a new deploy stays rejected until a full reload.
    const chunk =
      error instanceof Error &&
      /dynamically imported module|module script failed/i.test(error.message);
    return { failed: true, chunk };
  }
  render() {
    return this.state.failed ? (
      <div className="simple">
        <ErrorPage
          error={new DataApiError("app")}
          retry={() =>
            this.state.chunk
              ? window.location.reload()
              : this.setState({ failed: false })
          }
        />
      </div>
    ) : (
      this.props.children
    );
  }
}
