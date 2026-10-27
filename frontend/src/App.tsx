import { HealthStatus } from "./features/core/HealthStatus";
import { EpisodeDetailPrototype } from "./features/episodes/prototypeEpisodeDetail/EpisodeDetailPrototype";

export function App() {
  if (window.location.pathname.startsWith("/prototype/episode-detail")) {
    return <EpisodeDetailPrototype />;
  }
  return (
    <main>
      <h1>Winnow</h1>
      <HealthStatus />
    </main>
  );
}
