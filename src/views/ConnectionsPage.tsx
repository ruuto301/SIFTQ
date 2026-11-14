import type { JSX } from "hono/jsx/jsx-runtime";
import { BRAND_NAME, FAVICON_HREF } from "../brand";

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
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{BRAND_NAME}</title>
        <link rel="icon" type="image/svg+xml" href={FAVICON_HREF} />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
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
      </body>
    </html>
  );
}
