# poc ローカルアプリ実装計画

## 目的

`poc/` のUIプロトタイプを、ローカルで動く実アプリにする。
タスク管理UIは現在のものを維持し、チャットとモデル選択の実体を DSH に任せる。

## 決定事項

| 項目 | 内容 |
| --- | --- |
| 場所 | 同一リポジトリの `poc/` |
| 名前 | フォルダ/アプリは `poc`、画面は `siftq` |
| 実行 | ローカルWebアプリ。`127.0.0.1` のみ |
| エージェント | グループの接続先ごとに DSH を `dsh --profile acp` で起動し、ACPで接続 |
| UI | 現在の `poc/` を維持 |
| モデル選択 | ACPのconfig optionsからselectを生成 |
| 権限 | モデルselectと同じ行に「確認する / すべて許可」select。会話ごとに保持 |
| 使用量 | 実装しない。下部バーを削除 |
| リモート | 実装しない |
| 設定画面 | グループ管理とDSH接続状態 |
| グループ保存 | JSON |
| 接続先 | グループごとに `ローカル` または SSHホスト名（例: `yoriwake.sbx`）を選ぶ |
| グループ操作 | 追加・名前変更・削除と接続先の変更を設定画面で行う。タスク作成時の新規グループもJSONに追加 |
| グループ削除 | タスクが残っている場合は「その他へ移動」してから削除する |
| チャット表示 | ACPの確定メッセージを表示。必要なら見た目だけタイピング風 |
| モック | `POC_DSH=mock` でテスト用に残す |

## 構成

```text
poc/
  server/
    main.ts        # 起動、静的配信、API、SSE
    acp.ts         # DSH ACP 子プロセスとJSON-RPC
    store.ts       # JSON永続化
    routes.ts      # tasks / groups / conversations
  public/          # index.html / app.js / styles.css
  tests/
  data/            # 実行時に生成。git管理外
  package.json
  tsconfig.json
  仕様.md
```

- `bun run dev` で `http://127.0.0.1:8099` を開く。
- サーバは `127.0.0.1` にのみバインドする。
- DSH は1プロセス。会話ごとに `session/new` し、セッションIDを保存する。
- クライアントとの通信は HTTP + SSE。チャット送信は POST、応答とツール更新は SSE。

## 保存ファイル

- `poc/data/groups.json`
  - グループ名、接続先、並び順
  - 接続先は `""`（ローカル）または SSHホスト名
- `poc/data/state.json`
  - タスク、メモ、ブラウザタブ、会話のメタ情報、画面設定
- `poc/data/chats/<conversationId>.json`
  - チャット履歴のミラー
  - 会話ごとに分けて、1ファイルが大きくなりすぎないようにする

DBは使わず、すべてJSONにします。書き込みは一時ファイルに書いてからrenameし、途中で壊れないようにします。

## グループ

- 設定画面でグループを追加する。接続先はローカルまたはSSHホストを選ぶ。
- グループ名を変更すると、そのグループに属するタスクのグループ名も更新する。
- SSHホストの一覧は `~/.ssh/config` から取得する。
- グループを削除するとき、タスクが残っていれば「その他へ移動する」か「削除をやめる」を選ぶ。
- タスク作成欄の「+ 新しいグループ」でも `groups.json` にグループを追加する。
- グループの並び順は左ペインのDnDで変更し、`groups.json` に保存する。
- 接続先を変更した場合、選択中の会話は新しい接続先でセッションを作り直す。
- `その他` グループは削除できない。

## 画面

- 上部: `siftq`、DSH接続状態、設定ボタン。
- 左: タスク一覧。グループの折りたたみ、DnD、仮タスク、右クリック状態変更は維持。
- 中央: チャット / メモ。
  - 送信欄の上に `モデルselect` と `権限select` を並べる。
  - 応答はACPの更新を受けて表示する。
  - 停止は `session/cancel`。
  - 承認が必要なときはダイアログを出す。`すべて許可` の会話では自動で許可する。
- 右: ブラウザ（モック表示のまま）。
- 下部: 使用量バーを削除。上部 + 3ペインになる。
- 設定画面: モーダル。
  - グループ一覧（名前、接続先、追加、名前変更、削除）
  - DSH接続状態、プロファイル名、エラー内容、再試行

## DSH接続

- グループの接続先ごとに `dsh --profile acp` を起動して `initialize` を試す。
- ローカルはアプリの起動ディレクトリで `dsh --profile acp` を起動する。
- SSHホスト名（例: `yoriwake.sbx`）は `ssh <host> dsh --profile acp` を起動する。作業ディレクトリはSSH先のホーム。
- SSHホストは `~/.ssh/config` の `Host` から選ぶ。カスタム入力ではホスト名だけを入れる。
- 失敗してもアプリは開く。設定画面に接続先ごとの状態と再試行を出す。
- 会話ごとに `session/new`。接続先とセッションIDを保存する。
- アプリ再起動後は `session/resume` で会話を復元する。
- モデル変更は `session/set_config_option`。
- 権限は `session/request_permission` に応答する。
- モックモードではDSHを起動せず、固定応答を返す。

## API

- `GET /api/state` 状態、チャット履歴、DSH状態
- `PUT /api/state` タスク、グループ、メモ、ブラウザタブの保存
- `POST /api/conversations/:id/prompt` チャット送信
- `POST /api/conversations/:id/cancel` 停止
- `POST /api/conversations/:id/config` モデル変更
- `PATCH /api/conversations/:id` 権限モード変更
- `POST /api/permissions/:requestId` 承認応答
- `GET /api/events` SSE
- `GET /api/health` DSH接続状態
- `POST /api/dsh/retry` DSH再接続

## 実装フェーズ

1. JSON保存、ローカルサーバ、設定画面、使用量バー削除
2. DSH起動確認、接続状態表示、エラー案内
3. チャット（セッション作成、送信、応答、停止、再開）
4. モデルselect、権限select、承認ダイアログ
5. グループ管理と接続先のセッションへの反映
6. テスト、仕様書更新、起動手順

## 検証

- 単体: タスク/グループの並び、DnD、JSON保存、ACPイベント変換
- 結合: モックACPで、送信・停止・モデル変更・承認
- E2E: Playwrightで、タスク追加、グループ操作、設定画面、チャット
- 手動: 実際の `dsh --profile acp` と接続して確認

## 非スコープ

- 使用量表示
- リモートアクセス
- デスクトップアプリ化
- 実ブラウザ操作
- スレッド表示
- GitHub連携の実装
