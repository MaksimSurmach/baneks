import { Component, type ReactNode } from "react";
import ErrorPage from "../../pages/errors/ErrorPage";
import { DataApiError } from "../../lib/neon-data-api/errors";
export default class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="simple">
        <ErrorPage
          error={new DataApiError("server", 500)}
          retry={() => this.setState({ failed: false })}
        />
      </div>
    ) : (
      this.props.children
    );
  }
}
