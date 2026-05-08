import { TvHeaderStrip } from './components/TvHeaderStrip';
import { TvSceneRotator } from './components/TvSceneRotator';
import { TvTicker } from './components/TvTicker';
import { SceneAtendimento } from './components/scenes/SceneAtendimento';
import { SceneSaudeTecnica } from './components/scenes/SceneSaudeTecnica';
import { SceneClientesCanais } from './components/scenes/SceneClientesCanais';
import { SceneInfraCloud } from './components/scenes/SceneInfraCloud';
import { ScenePerformance } from './components/scenes/ScenePerformance';

/**
 * Painel master para TV 55" — visão consolidada de todos os clientes.
 * Acesso: /tv/master (admin-only via ProtectedRoute).
 *
 * Layout: 1920×1080 — header strip fixo (saúde) + corpo rotativo (3 cenas) + ticker.
 * Atualização: realtime via React Query polling (5-60s conforme dado).
 */
export default function TvMasterPage() {
  const scenes = [
    { key: 'atendimento', title: 'Atendimento — Últimas 24h', node: <SceneAtendimento /> },
    { key: 'saude', title: 'Saúde Técnica — Julia & Webhooks', node: <SceneSaudeTecnica /> },
    { key: 'clientes', title: 'Clientes & Canais', node: <SceneClientesCanais /> },
    { key: 'infra', title: 'Infraestrutura & Cloud', node: <SceneInfraCloud /> },
    { key: 'performance', title: 'Performance — Worker & Banco', node: <ScenePerformance /> },
  ];

  return (
    <div className="dark fixed inset-0 bg-zinc-950 text-zinc-100 p-8 flex flex-col gap-6 overflow-hidden">
      {/* Faixa fixa de saúde */}
      <TvHeaderStrip />

      {/* Corpo rotativo */}
      <TvSceneRotator scenes={scenes} />

      {/* Ticker rolante */}
      <TvTicker />
    </div>
  );
}
