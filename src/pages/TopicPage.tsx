import { Navigate, useParams } from "react-router-dom";
import { useTaxonomy } from "../components/layout/TaxonomyContext";
import RecoveryPanel from "../components/feedback/RecoveryPanel";
import Loading from "../components/feedback/Loading";
import { DataApiError } from "../lib/neon-data-api/errors";
export default function TopicPage() {
  const { kind, slug } = useParams(),
    taxonomy = useTaxonomy();
  if (taxonomy.status === "loading")
    return (
      <div className="simple">
        <Loading />
      </div>
    );
  if (taxonomy.status === "error")
    return (
      <div className="simple">
        <RecoveryPanel error={taxonomy.error} retry={taxonomy.retry} />
      </div>
    );
  const term = taxonomy.value.find((t) => t.kind === kind && t.slug === slug);
  return term ? (
    <Navigate to={`/jokes?${term.kind}=${term.id}`} replace />
  ) : (
    <div className="simple">
      <RecoveryPanel error={new DataApiError("not-found", 404)} />
    </div>
  );
}
