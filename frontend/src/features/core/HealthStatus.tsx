import { useHealth } from "./useHealth";

export function HealthStatus() {
  const health = useHealth();

  if (health.isPending) return <p>Connecting to backend…</p>;
  if (health.isError) return <p role="alert">Backend unreachable</p>;

  return (
    <p data-testid="health-status">
      Backend ok · Meta API key {health.data.meta_api_key_configured ? "configured" : "missing"}
    </p>
  );
}
