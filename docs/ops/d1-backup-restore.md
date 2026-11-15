# D1 バックアップと復元

D1 を毎日 R2 へ暗号化バックアップする仕組みと、復元手順を定める。決定の理由は [ADR 0077](../adr/0077-d1-backup-to-r2-with-hkdf-key.md) に従う。

## 方針

- 実行環境は Cloudflare のみ（Worker の Cron Trigger + R2）。GitHub Actions は使わない。
- 毎日 1 回（03:00 JST = `0 18 * * *` UTC）`scheduled` が D1 を SQL ダンプ → gzip → AES-256-GCM 暗号化して R2 へ保存する。
- 鍵は既存の `SESSION_SECRET` から HKDF-SHA256（salt `siftq-d1-backup` / info `aes-256-gcm-v1`）で導出する。追加の secret は登録しない。
- 保存先は R2 バケット `siftq-backups`（非公開）。プレフィックスは `d1/`。
- 保持は 30 日。日次実行時に古いアーカイブを削除する。

## 保存物

| 種別 | パス | 内容 |
| --- | --- | --- |
| アーカイブ | `d1/<YYYY>/<MM>/<DD>/siftq.sql.gz.enc` | `SIFTBK1` + IV(12B) + AES-GCM 暗号文（平文は gzip 済み SQL） |
| マニフェスト | `d1/manifest.json` | 日時・keyId・IV・平文 sha256・サイズ・各テーブル行数 |

## 鍵の保管

- 鍵は **保存しない**（Worker と復元スクリプトが毎回導出する）。
- 原本は `SESSION_SECRET`。Cloudflare の secret は値を後から確認できないため、**パスワードマネージャ等に控えを残す**。
- `SESSION_SECRET` を変更すると新しい鍵になる。旧アーカイブ（30 日）を復号するために、旧値を保持期間中は保管する。
- manifest の `keyId`（導出鍵の SHA-256 先頭 8 バイト）で、どの鍵のアーカイブか判別できる。

## 初回セットアップ

```bash
bun x cf r2 bucket create siftq-backups
```

R2 バケット作成のみ。secret の追加登録は不要（`SESSION_SECRET` を利用）。

## 復元（既定はローカル訓練）

```bash
# 1. 対象アーカイブを確認して取得
bun x cf r2 object list siftq-backups --prefix d1/
bun x cf r2 object get siftq-backups/d1/2026/11/16/siftq.sql.gz.enc --file tmp/siftq.sql.gz.enc

# 2. 復号 + gunzip（.env か環境変数の SESSION_SECRET を使用）
SESSION_SECRET=... bun scripts/d1_restore.ts --file tmp/siftq.sql.gz.enc --out tmp/siftq.sql

# 3. ローカル D1 へ投入して起動確認
bun x cf d1 execute siftq --local --persist-to .wrangler/state --file tmp/siftq.sql
bun run dev
```

`d1_restore.ts` は magic と keyId を検証し、`--expect-sha256` を渡すと復号後 SQL の sha256 も照合する。

## 本番への復元（明示 + 確認）

```bash
# 実行前に現状を再バックアップする（Cron を待たずに手元で実行する場合は production の scheduled を再実行するか、下の手順で先に取得する）
SESSION_SECRET=... bun scripts/d1_restore.ts --file tmp/siftq.sql.gz.enc --out tmp/siftq.sql
bun x cf d1 execute siftq --remote --file tmp/siftq.sql --yes
```

- 本番への投入は**全置換**。実行前に必ず最新アーカイブを取得し、実行後にもう一度バックアップを取る。
- 誤投入を避けるため、`--remote` を付ける前に `--local` で同じ SQL を検証する。

## 月次訓練

- 毎月 1 回、最新アーカイブをローカルへ復元し `bun run dev` で主要画面（Tasks / DS / MK）を確認する（目安 10 分）。
- 結果をこの表に記録する。

| 日付 | 対象アーカイブ | 結果 | メモ |
| --- | --- | --- | --- |
| - | - | 未実施 | - |

## トラブルシュート

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| `keyId mismatch` | `SESSION_SECRET` がアーカイブ作成時と違う | 旧シークレットを設定して再実行 |
| `unknown format` | アーカイブが壊れている / 別形式 | R2 の別世代を使う |
| `sha256 mismatch` | 復号結果が壊れている | アーカイブを再取得する |
| Cron が動かない | トリガー未反映 / デプロイ未完了 | `cf deploy` の反映を確認し、Worker のログを見る |
