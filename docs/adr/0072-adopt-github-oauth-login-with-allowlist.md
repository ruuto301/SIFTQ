# ADR 0072: 認証を GitHub OAuth と login allowlist に置き換える

## 決定

- Worker のアクセス制御は、共有パスワード認証ではなく GitHub OAuth App による OAuth 2.0 認証で行う。
- login allowlist に一致する GitHub アカウントのみログインを許可する。
- 認証成功後のセッションは、既存の署名付き HttpOnly Cookie を維持する。
- 単一ユーザー前提を維持し、ユーザー別のデータ分割は行わない。
- 将来のユーザー別認証の移行先は Better Auth のままとする (ADR 0036)。

### 決定の理由

- パスワードを自前で保管・管理する必要がなくなり、漏えい時の影響を認証基盤側へ移せる。
- GitHub アカウントで本人確認でき、login allowlist で許可したアカウントに限定できる。
- 既存の Cookie セッションと保護 middleware を流用でき、認証方式の置き換えに留められる。

## 不採用

- 共有パスワード認証を継続する (ADR 0032)
  - パスワードを自前で保管・管理する必要があり、利用者を識別できないため。
- Cloudflare Access (ADR 0031)
  - Zero Trust の設定が必要で、個人利用には導入コストが上回るため。
- GitHub App を採用する
  - 単一アカウントの認証には OAuth App で十分で、インストールと権限管理が追加で必要になるため。
- Better Auth を今回導入する (ADR 0036)
  - 今回は単一ユーザー前提で足り、ユーザー別データ分割と併せて移行すべきため。

## 補足情報

### 背景

- 現行の認証は ADR 0032 の共有パスワード認証で、パスワードを Worker の secret に保管していた。
- パスワードを自前で保管・管理したくない。
- GitHub アカウントで認証し、特定 login のみ許可したい。

### 制約事項

- login allowlist 方式は単一ユーザー前提で、ユーザーごとの識別やデータ分割は提供しない。
- GitHub の client secret と既存のセッション署名鍵はリポジトリに commit せず、デプロイ時の secret として注入する。
- ユーザー登録・プロフィール管理・パスワードリセットは実装しない。
- allowlist の変更は secret の更新を伴う。
- OAuth の認可・トークン交換・ユーザー取得の宛先は設定で差し替え可能にし、テスト seam とする。

### 判断ごとの根拠と検証

| 検証ID | 判断・主張 | 根拠の種類 | 観測データ | データ充足条件 | 完了条件 | 許容できない結果 | 状態 | 再評価条件 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-072-001 | login allowlist 外の GitHub アカウントではセッションを発行しない | 要求 | 許可 login と非許可 login でのログイン応答 | 許可・非許可の両応答が取得できる | 非許可でセッション Cookie が発行されない | 非許可でもセッションが発行される | 確認済み | allowlist 照合またはテスト seam の変更時 |
| V-072-002 | state が一致しない callback を拒否する | 要求 | 正規 state と改ざん state での callback 応答 | 正規・改ざんの両応答が取得できる | 改ざんでセッションが発行されない | 改ざんでもセッションが発行される | 確認済み | state 検証またはセッション発行の変更時 |

### 限界と再検討条件

- 限界: GitHub OAuth の可用性・障害時の挙動と、allowlist 運用の実運用負荷は未確認。
- 再検討条件: ユーザー別認証・データ分割を開始する時、または GitHub 依存を避ける要件が出た時。

## 参考リンク

- [ADR 0032: Adopt Worker-managed shared-password authentication](0032-adopt-worker-managed-shared-password-authentication.md)
- [ADR 0036: Adopt Better Auth as future authentication migration target](0036-adopt-better-auth-as-future-auth-migration-target.md)
- [GitHub: Authorizing OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)
- 検証証拠: [GitHub OAuth contract tests](../../tests/github-oauth.test.ts)
