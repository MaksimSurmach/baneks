import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import App from "./App";
import CatalogPage from "../pages/CatalogPage";
import JokePage from "../pages/JokePage";
import RandomPage from "../pages/RandomPage";
import TopicPage from "../pages/TopicPage";
import RecoveryPanel from "../components/feedback/RecoveryPanel";
import { DataApiError } from "../lib/neon-data-api/errors";
import { routeErrorPaths } from "./routes";
const Atlas = lazy(() => import("../pages/AtlasPlaceholder"));
const fallback = (
  <div className="simple">
    <RecoveryPanel error={new DataApiError("not-found", 404)} />
  </div>
);
export const router = createBrowserRouter([
  {
    element: <App />,
    errorElement: (
      <div className="simple">
        <RecoveryPanel error={new DataApiError("server", 500)} />
      </div>
    ),
    children: [
      { path: "/", element: <Navigate to="/jokes" replace /> },
      { path: "/jokes", element: <CatalogPage /> },
      { path: "/jokes/random", element: <RandomPage /> },
      { path: "/jokes/:id", element: <JokePage /> },
      { path: "/topics/:kind/:slug", element: <TopicPage /> },
      {
        path: "/atlas",
        element: (
          <Suspense
            fallback={
              <div className="simple" role="status">
                Загрузка…
              </div>
            }
          >
            <Atlas />
          </Suspense>
        ),
      },
      ...routeErrorPaths.map((path) => ({
        path: "/" + path,
        element:
          path === "404" ? (
            fallback
          ) : (
            <div className="simple">
              <RecoveryPanel error={new DataApiError("server", 500)} />
            </div>
          ),
      })),
      { path: "*", element: fallback },
    ],
  },
]);
