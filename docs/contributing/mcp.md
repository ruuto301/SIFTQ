# MCP 連携（外部クライアントから SIFTQ を操作する）

SIFTQ は `POST /mcp`（Streamable HTTP + JSON-RPC 2.0）で MCP サーバーを公開する。認証は OAuth 2.1 の委任で、ユーザーが同意画面で許可したクライアントだけがツールを呼べる。

## クライアント設定

```json
{
  "mcpServers": {
    "siftq": {
      "url": "https://app.siftq-app.workers.dev/mcp"
    }
  }
}
```

MCP クライアントが OAuth に対応していれば、接続時に次が自動で進む。

1. `/mcp` が 401 と `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"` を返す
2. クライアントがメタデータを取得し `POST /oauth/register` で自分を登録する
3. ブラウザで `GET /oauth/authorize` を開き、同意画面で `read` / `write` を許可する
4. `POST /oauth/token` でアクセストークン（1 時間）と更新トークン（30 日）を受け取る

OAuth に対応していないツールからは、同じエンドポイントを手動で叩いてトークンを得る。

```bash
# 1. クライアント登録
curl -s https://app.siftq-app.workers.dev/oauth/register \
  -H 'content-type: application/json' \
  -d '{"client_name":"My Tool","redirect_uris":["http://127.0.0.1:8765/callback"]}'

# 2. ブラウザで同意（code_challenge は PKCE S256）
open 'https://app.siftq-app.workers.dev/oauth/authorize?response_type=code&client_id=<client_id>&redirect_uri=http://127.0.0.1:8765/callback&code_challenge=<challenge>&code_challenge_method=S256&scope=read%20write'

# 3. コードをトークンに交換
curl -s https://app.siftq-app.workers.dev/oauth/token \
  -H 'content-type: application/x-www-form-urlencoded' \
  -d 'grant_type=authorization_code&code=<code>&client_id=<client_id>&redirect_uri=http://127.0.0.1:8765/callback&code_verifier=<verifier>'
```

## ツール

`tools/list` が返すツールは tasks / projects / ideas の全操作。`read` スコープは読み取りツールのみ、`write` スコープは作成・更新・削除・並び替え・一括操作を実行できる。書き込みツールは `version` が必須で、不一致は `CONFLICT` のエラー結果になる。

```
curl -s https://app.siftq-app.workers.dev/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"list_tasks","arguments":{"status":"do","limit":5}}}'
```

## 失効

`/connections` に連携済みクライアントの一覧があり、`失効` で有効なトークンをすべて無効化できる。失効後の呼び出しは 401 になる。

## 監査ログ

`tools/call` のたびに `mcp_audit` テーブルへ client_id・ツール名・対象・結果を記録する。
