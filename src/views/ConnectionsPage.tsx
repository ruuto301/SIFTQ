import type { JSX } from "hono/jsx/jsx-runtime";
import { StandalonePage } from "../components/StandalonePage";

export type ConnectionView = {
  clientId: string;
  clientName: string;
  redirectUris: readonly string[];
  activeTokens: number;
  createdAt: string;
};

function ConnectionItem({ connection }: { connection: ConnectionView }) {
  return (
    <li class="connection">
      <h2>{connection.clientName}</h2>
      <p>{connection.redirectUris.join(", ")}</p>
      <p>有効なトークン: {connection.activeTokens}</p>
      <form method="post" action="/connections/revoke">
        <input type="hidden" name="client_id" value={connection.clientId} />
        <button class="button" type="submit">
          失効
        </button>
      </form>
    </li>
  );
}

/** Lists the MCP clients linked to this account and lets the user revoke them. */
export function ConnectionsPage({ connections }: { connections: readonly ConnectionView[] }): JSX.Element {
  return (
    <StandalonePage>
      <main class="page">
        <h1 class="page-title">連携アプリ</h1>
        <p>
          <a href="/tasks">タスク一覧へ戻る</a>
        </p>
        {connections.length === 0 ? (
          <p>連携しているアプリはありません。</p>
        ) : (
          <ul class="connection-list">
            {connections.map((connection) => (
              <ConnectionItem connection={connection} key={connection.clientId} />
            ))}
          </ul>
        )}
      </main>
    </StandalonePage>
  );
}
