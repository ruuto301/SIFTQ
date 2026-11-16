# Task Management 要求分析

## 目的

Task Management MVP の振る舞いを、要求 ID、仕様 ID、BDD ID で追跡できる
形に整理する。この文書は BDD シナリオの根拠となる要求分析の正本とし、
実装方式や内部設計は扱わない。

## 入力資料

- [Task Management Domain](domain.md)
- [Task Management Screens](screens.md)
- [ユーザーストーリーマップ](user-story-map.md)

テスト要求仕様の方式と因子表は [テスト要求仕様（TRS）](trs.md) を参照する。

## ID 管理

- `REQ-TM-xxx`: ユーザーが達成したいこと、またはプロダクト上の要求。
- `SPEC-TM-xxx`: 外部から観測できる振る舞い、状態、制約。
- `BDD-TM-xxx`: 仕様を具体例として確認するシナリオ。

## 要求

| ID | 要求 | 根拠 |
| --- | --- | --- |
| REQ-TM-001 | ユーザーは、実行対象のタスクを project で整理したい。 | user-story-map.md, screens.md |
| REQ-TM-002 | ユーザーは、完了したタスクと見送ったタスクを一覧で確認したい。 | domain.md, screens.md |
| REQ-TM-003 | ユーザーは、タスクの内容、状態、分類先を作成後に確認・編集したい。 | domain.md, screens.md |
| REQ-TM-004 | ユーザーは、複数タスクの分類先をまとめて変更し、project ごとに一覧したい。 | domain.md, screens.md |
| REQ-TM-005 | 開発者は、固定データを使って本番 UI の操作をローカルで確認したい。 | screens.md |
| REQ-TM-006 | ユーザーは、タスクを完了、見送り、削除したい。 | domain.md, screens.md |
| REQ-TM-007 | ユーザーは、Task list で確認したい status のタスクだけを表示したい。 | domain.md, screens.md |
| REQ-TM-008 | ユーザーは、Taskとは独立したIdeaを記録・整理したい。 | domain.md, screens.md |
| REQ-TM-009 | ユーザーは、重要なIdeaを固定し、不要なIdeaを削除したい。 | domain.md, screens.md |
| REQ-TM-010 | ユーザーは、DS でタスクの分類先と project の並び順をドラッグ&ドロップで変更したい。 | screens.md |
| REQ-TM-011 | ユーザーは、DS の project 内でタスクの表示順を変えたい。 | screens.md |
| REQ-TM-012 | ユーザーは、DS のチャットで選択中タスクのタイトルを確認したい。 | screens.md |
| REQ-TM-013 | ユーザーは、DS の左ペインからタスクを追加したい。 | screens.md |
| REQ-TM-014 | ユーザーは、DS の左ペインで project ごとのまとまりを見分けたい。 | screens.md |
| REQ-TM-015 | ユーザーは、DS の task を右クリックして状態や作業中を切り替え、タイトルをコピーしたい。 | screens.md |
| REQ-TM-016 | ユーザーは、DS で追加した task をすぐ見つけたい。 | screens.md |
| REQ-TM-017 | ユーザーは、外部の MCP クライアントに SIFTQ の操作を委任したい。 | screens.md |
| REQ-TM-017 | ユーザーは、DS の中央ペインでタスクの description を確認したい。 | screens.md |
| REQ-TM-018 | ユーザーは、DS でタスクを削除する前に画面中央で確認したい。 | screens.md |
| REQ-TM-019 | ユーザーは、タスクを用途（リポジトリ・生活）ごとのプロジェクトに分けて整理したい。 | screens.md |
| REQ-TM-020 | ユーザーは、アプリを離れずにプロジェクトを追加・改名・削除・並べ替えしたい。 | screens.md |
| REQ-TM-021 | ユーザーは、DS を見ながら選択中タスクの title と description を直したい。 | screens.md |
| REQ-TM-022 | ユーザーは、メモ画面を参照元と同じ色数と導線で使いたい。 | screens.md |
| REQ-TM-023 | ユーザーは、長時間の利用でも目が疲れにくい画面で SIFTQ を使いたい。 | screens.md |
| REQ-TM-024 | ユーザーは、作成したタスクを DS の同じプロジェクトの先頭で見つけたい。 | screens.md |
| REQ-TM-025 | ユーザーは、Tasks のラベル絞り込みを検索と同じ場所から使いたい。 | screens.md |
| REQ-TM-026 | ユーザーは、DS で編集中に手早く保存したい。 | screens.md |
| REQ-TM-027 | ユーザーは、Tasks の連続した複数をまとめて選択したい。 | screens.md |
| REQ-TM-028 | ユーザーは、Tasks の選択チェックボックスを押し間違えずに操作したい。 | screens.md |
| REQ-TM-029 | ユーザーは、メモを開いてタイトル・本文・色・画像をまとめて直したい。 | screens.md |
| REQ-TM-030 | ユーザーは、Cloudflare 障害や誤削除に備えて D1 を退避しておきたい。 | docs/ops/d1-backup-restore.md |
| REQ-TM-031 | ユーザーは、DS の description に画像を貼り付けて残したい。 | screens.md |
## 仕様

| ID | 親要求 | 仕様 | BDD |
| --- | --- | --- | --- |
| SPEC-TM-001 | REQ-TM-001 | Task は title、description、status、project、working、order を持つ。 | BDD-TM-001 |
| SPEC-TM-002 | REQ-TM-001, REQ-TM-003 | Task は project を 1 つ持ち、`projects.id` または未設定をとる。未知の project は受け付けない。 | BDD-TM-002 |
| SPEC-TM-003 | REQ-TM-001 | Task list の検索は `project:<id>` で指定 project、`project:none` で未設定の Task に絞り込む。 | BDD-TM-003 |
| SPEC-TM-004 | REQ-TM-004 | ユーザーは選択した複数 Task の project を一括で設定し、未設定へ戻せる。 | BDD-TM-004 |
| SPEC-TM-005 | REQ-TM-003 | ユーザーは Task の title と description を作成・編集できる。 | BDD-TM-005 |
| SPEC-TM-006 | REQ-TM-004 | DS の Task 一覧は project ごとにグループ化し、`sort_order` の昇順、未設定を最後に表示する。 | BDD-TM-006 |
| SPEC-TM-007 | REQ-TM-003 | status を完了または見送りに変更しても、Task の project は保持される。 | BDD-TM-007 |
| SPEC-TM-008 | REQ-TM-005 | モック BE プレビューはログイン後にTask listとDSの固定初期データを表示する。Idea listの作成・編集・削除・ピン留め・並べ替えはブラウザのlocalStorageに保持する。 | BDD-TM-010 |
| SPEC-TM-009 | REQ-TM-006 | 選択タスクの delete は確認ダイアログを表示し、確認後に完全削除する。 | BDD-TM-015 |
| SPEC-TM-010 | REQ-TM-007 | Task list は `do`、`done`、`skip` の status filter を持ち、選択した status の task だけを表示する。初期値は `do` とし、選択状態を再読み込み後も維持する。 | BDD-TM-016 |
| SPEC-TM-011 | REQ-TM-003 | New task と Task detail の description 編集領域では http/https URL をリンクとして表示し、通常クリックは同じタブ、Ctrl/Command クリックは別タブで開く。保存値はプレーンテキストとする。 | BDD-TM-017 |
| SPEC-TM-012 | REQ-TM-003 | description に http/https URL を貼り付けると編集領域内でリンクとして表示する。Markdown、HTML、その他のリッチテキスト記法は解釈しない。 | BDD-TM-018 |
| SPEC-TM-013 | REQ-TM-007 | Task list は status 絞り込み後の件数を25件単位でページ分割し、ページ番号と前へ/次へで移動する。不正なページ指定は1ページ目へ、範囲超過は最終ページへ寄せる。 | BDD-TM-019 |
| SPEC-TM-014 | REQ-TM-008 | Idea は title、description、order、pinned を持ち、pinned を先にして各グループ内を order の昇順で表示する。 | BDD-TM-020 |
| SPEC-TM-015 | REQ-TM-008 | ユーザーは Idea の作成、編集、並べ替えを行え、変更はブラウザの再読み込み後も保持する。 | BDD-TM-021 |
| SPEC-TM-016 | REQ-TM-009 | ユーザーは Idea のピン留め切り替えと削除を行え、削除前に確認する。 | BDD-TM-022 |
| SPEC-TM-017 | REQ-TM-008 | Idea 詳細（詳細モーダルと `/ideas/:id`）の description 編集領域では http/https URL をリンクとして表示し、通常クリックは同じタブ、Ctrl/Command クリックは別タブで開く。保存値はプレーンテキストとする。 | BDD-TM-023 |
| SPEC-TM-018 | REQ-TM-008 | Idea の description に http/https URL を貼り付けると編集領域内でリンクとして表示する。Markdown、HTML、その他のリッチテキスト記法は解釈しない。 | BDD-TM-024 |
| SPEC-TM-019 | REQ-TM-010 | DS の左ペインは task を project 間でドラッグ&ドロップして project を変更でき、project 見出しをドラッグ&ドロップして `sort_order` を並び替えられる。`未分類` は並び替えの対象外とし、失敗時は元の表示へ戻す。 | BDD-TM-025 |
| SPEC-TM-020 | REQ-TM-011 | DS の project グループ内の task は `order` の昇順（同値は id 順）で並び、ドラッグ&ドロップした位置の順序を `order` として保存する。失敗時は元の表示へ戻す。 | BDD-TM-026 |
| SPEC-TM-021 | REQ-TM-012 | DS の中央ペインは、選択中 task の title を `task` タブの title 入力欄に表示する。タブ行の直下には重複して表示しない。未選択時は選択を促す案内を表示する。 | BDD-TM-027 |
| SPEC-TM-022 | REQ-TM-013 | DS 左ペインの status タブ直下で task を作成できる。status は選択中タブ、project は追加先 select（既定は選択中 task、`未分類` も選べる）とし、作成した task は該当 project グループへ追加して件数を更新する。失敗時は入力内容を保持してエラーを表示する。 | BDD-TM-028 |
| SPEC-TM-023 | REQ-TM-014 | DS 左ペインの project グループは 2px の黒枠で囲み、見出しバーを枠の上辺にする。枠は中身の高さに追従し、task の追加・削除・折りたたみで伸縮する。task が増えても他のグループは潰れず、一覧側がスクロールする。 | BDD-TM-029 |
| SPEC-TM-024 | REQ-TM-015 | DS の task 行の右クリックメニューは、先頭に task 名と `status ・ project` を表示する。`status` は `do` / `done` / `skip` のピル（現在値は黒地 + 白文字）、`project` は現在の project 名と `▸`、続いて `copy title` と `copy id`、区切りの下に `working`（`on` / `off`）と `delete` を表示する。`copy id` は選択行の task id をクリップボードへ入れ、成功 / 失敗を通知する。文言は英語に統一し、task detail を開く / リンクをコピーは持たない。 | BDD-TM-030 |
| SPEC-TM-025 | REQ-TM-016 | DS の composer で作成した task は所属 project グループの先頭に挿入し、既存 task の `order` は `+1` する。グループが折りたたまれている場合は折りたたんだまま件数だけを更新する。`/tasks` の新規作成は従来どおり末尾に追加する。 | BDD-TM-031 |
| SPEC-TM-026 | REQ-TM-017 | `POST /mcp` は OAuth のアクセストークンで認可し、`initialize` / `notifications/initialized` / `ping` / `tools/list` / `tools/call` を提供する。`read` スコープは読み取りツールのみ、`write` スコープは tasks / projects / ideas の全操作を実行できる。書き込みは `version` 必須で、不一致はエラー結果を返す。未認証は 401 と `WWW-Authenticate: Bearer resource_metadata=...` を返す。 | BDD-TM-032 |
| SPEC-TM-027 | REQ-TM-017 | 外部クライアントへの委任は OAuth 2.1（認可コード + PKCE + 動的クライアント登録）で行う。ユーザーは同意画面で `read` / `write` を許可し、`/connections` からいつでも失効できる。トークンはハッシュのみ保存し、更新トークンは回転する。 | BDD-TM-033 |
| SPEC-TM-026 | REQ-TM-017 | DS 中央ペインの `description` タブは、選択中 task の description を初期表示から描画する。DSH transport が使える場合は `desc.get` の応答を優先し、使えない場合は task の description を表示する。description が空のときはプレースホルダを表示する。 | BDD-TM-032 |
| SPEC-TM-027 | REQ-TM-018 | DS のタスク削除は、既存の中央モーダル（`.matrix-modal`）を使った確認ダイアログを経由する。ダイアログはビューポート中央に表示し、`キャンセル`・`Escape`・背景クリックでは削除せず、`削除` で削除する。ブラウザ標準の `window.confirm` は使わない。 | BDD-TM-033 |
| SPEC-TM-028 | REQ-TM-019 | project の一覧は `Yoriwake` / `affiliate` / `customer_portal` / `生活` とし、未設定は `未分類` として扱う。`生活` は id `life`・表示名 `生活` を持つ。タスク一覧の project ラベルは id ではなく表示名を表示する。 | BDD-TM-034 |
| SPEC-TM-029 | REQ-TM-020 | `/settings` にプロジェクト一覧を表示し、追加・改名・並べ替え・削除を行える。削除するとそのプロジェクトのタスクは未分類（`project = NULL`）へ移り、タスクは削除しない。確認ダイアログには移動するタスク件数を表示する。 | BDD-TM-035 |
| SPEC-TM-030 | REQ-TM-021 | DS の中央ペインは `task` / `Chat` / `設定` の順にタブを表示し、`task` タブで選択中 task の title と description を編集して `PATCH /api/tasks/<id>` で保存する。保存に成功したら version と左ペインのカード title を更新し、409 のときは入力を保持してエラーを表示する。 | BDD-TM-036 |
| SPEC-TM-031 | REQ-TM-022 | MK 画面の色絞り込みは 7 色のみとし、選択中の色をもう一度押すと解除する。サイドバーに `＋ 新規メモ` を置き、検索は `メモを検索（タイトル / 本文）` と解除の × を、選択は `☑ 選択` を、入力欄は `新しいメモのタイトル` と `本文。Ctrl+V で画像を貼り付けできます。` を表示する。 | BDD-TM-037 |
| SPEC-TM-032 | REQ-TM-023 | 全画面は無彩色（彩度 0）のモノクロームとし、ページ `#cccccc`、面板 `#d8d8d8`、操作要素 `#e4e4e4`、本文 `#303030`、補助 `#555555` を使う。一覧・パネル・ポップオーバー・操作要素は 2px `#1f1f1f` の黒縁、黒地の要素は `#262626` + 2px `#dcdcdc` の軟白縁、タスク一覧は外周 1 枠で行間は 1px `#bdbdbd` のヘアライン、ドロップダウンは本体 2px・項目 1px の黒縁とする。本文は Atkinson Hyperlegible と Noto Sans JP を優先するフォントスタック、行間 1.7 とし、文字コントラスト 4.5:1 以上・境界 3:1 以上を満たす（外部フォントは読み込まない）。 | BDD-TM-038 |
| SPEC-TM-033 | REQ-TM-024 | task の作成は、既存 task の `order` を 1 つずつ繰り下げてから新しい task を `order = 1` で挿入する。`/tasks` の新規作成フォームと `POST /api/tasks` の `position: "first"` で同じ並びになる。 | BDD-TM-039 |
| SPEC-TM-034 | REQ-TM-025 | Tasks のラベル絞り込みは `Filter` という表示名で、検索入力欄と 🔍 の間（🔍 の左）に置く。`All labels` / `working:on` / `working:off` と Projects 節の選択肢は変えない。絞り込み中は `Filter` を黒地 `#262626` + 2px `#dcdcdc` 縁 + `#dcdcdc` 文字で反転表示する。絞り込みは検索と同じ 1 行に収まり、入力欄が縮んで並ぶ。 | BDD-TM-040 |
| SPEC-TM-035 | REQ-TM-026 | DS の画面では `Ctrl`/`⌘` + `S` で選択中 task の未保存の変更を保存する。ブラウザ既定の保存は行わず、未保存の変更が無いときはリクエストを送らない。 | BDD-TM-041 |
| SPEC-TM-036 | REQ-TM-027 | Tasks 一覧の checkbox は、直前にクリックした行を起点として Shift + クリックで起点から対象行までの範囲をまとめて選択する。範囲は対象行の新しい状態（選択 / 解除）に揃え、起点が無いときは通常の 1 件トグルとして扱う。全選択の変更と一括操作の完了で起点をリセットする。範囲選択は checkbox のみを対象とし、ページをまたがない。 | BDD-TM-042 |
| SPEC-TM-037 | REQ-TM-028 | Tasks の選択 checkbox は当たり判定を 44×44px、チェック本体を 24px とし、hover で背景 `#dcdcdc` を表示する。一覧の checkbox 列は 44px 幅で、タイトルのリンクと重ならない。ツールバーの全選択 checkbox も 44×44px で、一覧の checkbox と同じ中心 x に揃える。行の余白（`a, button, input, label, summary, details` 以外）のクリックで選択をトグルし、ページ遷移しない。 | BDD-TM-043 |
| SPEC-TM-038 | REQ-TM-029 | MK のカード押下で中央の詳細ダイアログを開く。ダイアログはメモの色で表示し、タイトル・本文・色・画像・ピン・アーカイブ・ゴミ箱・削除を編集できる。編集は自動保存し、閉じても破棄しない。 | BDD-TM-044 |
| SPEC-TM-039 | REQ-TM-030 | Worker の Cron Trigger（毎日 03:00 JST）が D1 を SQL ダンプにし、gzip 後 AES-256-GCM で暗号化して R2 `siftq-backups` の `d1/<YYYY>/<MM>/<DD>/siftq.sql.gz.enc` へ保存する。鍵は `SESSION_SECRET` から HKDF-SHA256 で導出し、追加の secret を持たない。`d1/manifest.json` に keyId・IV・平文 sha256・行数を記録し、30 日より古いアーカイブは削除する。復元は手元で復号し、既定はローカル・本番は明示指定と確認を必須とする。 | BDD-TM-046 |
| SPEC-TM-040 | REQ-TM-029 | MK の本文欄は内容に合わせて自動で伸びる（本文欄自身はスクロールしない）。短いメモでは詳細ダイアログも縮み、長文では上限 `86vh` まで伸びる。上限を超えたときは詳細ダイアログの本文側だけが 1 本の細いスクロールバーでスクロールする。「メモを取る...」の本文も 2 行から書いた分だけ伸び、12 行で止まる。 | BDD-TM-048 |
| SPEC-TM-042 | REQ-TM-029 | MK のページは最大幅 1400px で中央に寄せる。メモ一覧は固定の列数ではなく、カード 1 枚が 220px を下回らない範囲で入る分だけ並べ、余れば次の行へ折り返す。| BDD-TM-050 |
| SPEC-TM-041 | REQ-TM-031 | DS の description はタスク詳細と同じリッチエディタを使い、貼り付け / ドラッグ&ドロップで PNG / JPEG / WebP を追加できる。画像は `/api/images` にアップロードして本文へ `/api/images/<id>` トークンとして保存する。1 MiB 超は最大辺 1600px・品質 0.8 に縮小し、縮小後も超える場合とアニメーション画像はエラーにする。画像だけの description を許可する。保存時に本文から消えた画像が他のタスク・Idea から参照されていなければ画像レコードを削除する。 | BDD-TM-049 |## BDD 候補

BDD の ID を受け入れ基準（AC）の ID として扱い、振る舞いを正常・準正常・例外に分類する。該当が無い分類は「なし」と明示する。例外は現状なしとし、認証失敗や 5xx は専用の契約テストが担当する。期待値と因子水準は [テスト要求仕様（TRS）](trs.md) の因子表を正本とする。

| ID | 対象仕様 | シナリオ | 振る舞い |
| --- | --- | --- | --- |
| BDD-TM-001 | SPEC-TM-001 | Task を作成すると、表示と編集に必要な属性を持つ。 | 正常 |
| BDD-TM-002 | SPEC-TM-002 | Task に既知の project を設定でき、未知の project は拒否される。 | 正常 |
| BDD-TM-003 | SPEC-TM-003 | 検索で `project:<id>` は指定 project、`project:none` は未設定の Task だけを表示する。 | 正常 |
| BDD-TM-004 | SPEC-TM-004 | 選択した複数 Task の project を一括で設定し、未設定へ戻せる。 | 正常 |
| BDD-TM-005 | SPEC-TM-005 | ユーザーは Task の title と description を保存できる。 | 正常 |
| BDD-TM-006 | SPEC-TM-006 | DS は Task を project ごとにグループ化し、未設定を最後に表示する。 | 正常 |
| BDD-TM-007 | SPEC-TM-007 | status を完了または見送りにしても project は保持される。 | 正常 |
| BDD-TM-010 | SPEC-TM-008 | モック BE プレビューにログインすると、固定初期データを Task list と DS で確認できる。 | 正常 |
| BDD-TM-015 | SPEC-TM-009 | delete confirmation で削除を確定すると task が Task list から消える。 | 正常 |
| BDD-TM-016 | SPEC-TM-010 | Task list で status を切り替えると、選択した status の task だけが表示され、再読み込み後も選択状態が維持される。 | 正常 |
| BDD-TM-017 | SPEC-TM-011 | description のURLを通常クリックすると同じタブで開き、Ctrl/Command クリックでは別タブで開く。保存後もリンク表示が維持される。 | 正常 |
| BDD-TM-018 | SPEC-TM-012 | description に貼り付けた http/https URL はリンクになり、保存時は `<a>` などのHTMLタグを含まないプレーンテキストになる。 | 正常 |
| BDD-TM-019 | SPEC-TM-013 | Task list は25件ごとにページを分け、番号と前へ/次へで移動できる。不正指定と範囲超過は矛盾のないページに寄せる。 | 準正常 |
| BDD-TM-020 | SPEC-TM-014 | Idea list はピン留めしたIdeaを先に、各グループ内をorder順に表示する。 | 正常 |
| BDD-TM-021 | SPEC-TM-015 | Ideaを作成・編集・並べ替えすると表示中の一覧に反映され、再読み込み後も変更後の一覧を確認できる。 | 正常 |
| BDD-TM-022 | SPEC-TM-016 | Ideaのピン留めを切り替え、削除確認を経て一覧から削除できる。 | 正常 |
| BDD-TM-023 | SPEC-TM-017 | Idea 詳細の description のURLを通常クリックすると同じタブで開き、Ctrl/Command クリックでは別タブで開く。保存後もリンク表示が維持される。 | 正常 |
| BDD-TM-024 | SPEC-TM-018 | Idea の description に貼り付けた http/https URL はリンクになり、保存時は `<a>` などのHTMLタグを含まないプレーンテキストになる。 | 正常 |
| BDD-TM-025 | SPEC-TM-019 | DS で task を別の project グループへドラッグ&ドロップすると project が変わり、project 見出しをドラッグ&ドロップすると並び順が変わる。 | 正常 |
| BDD-TM-026 | SPEC-TM-020 | project グループ内で task をドラッグ&ドロップすると表示順が変わり、再読み込み後も維持される。 | 正常 |
| BDD-TM-027 | SPEC-TM-021 | DS で task を選択すると、`task` タブの title 入力欄にその title が 1 か所だけ表示される。 | 正常 |
| BDD-TM-028 | SPEC-TM-022 | DS 左ペインで task を追加すると、選択中 status と追加先 project で作成され、その project グループに表示される。 | 正常 |
| BDD-TM-029 | SPEC-TM-023 | DS 左ペインの project ごとに黒枠が付き、task を追加すると枠が伸びて他の project は縮まない。折りたたむと枠は見出し 1 行に縮む。 | 正常 |
| BDD-TM-030 | SPEC-TM-024 | DS 左ペインの task を右クリックすると英語の action menu が開き、status ピルで状態を変更でき、`copy title` でタイトルが、`copy id` で task id がクリップボードに入る。 | 正常 |
| BDD-TM-031 | SPEC-TM-025 | DS で task を追加すると、その project グループの先頭に表示され、リロード後も先頭のままになる。折りたたみ中のグループでは折りたたみが維持され件数だけ増える。 | 正常 |
| BDD-TM-032 | SPEC-TM-026 | MCP クライアントが tools/call で task の一覧・作成・更新・削除と project / idea の操作を実行でき、version 不一致は CONFLICT のエラー結果になる。 | 正常 |
| BDD-TM-033 | SPEC-TM-027 | MCP クライアントが動的登録 → 同意 → トークン取得で /mcp を呼べる。連携アプリ画面で失効すると以後の呼び出しが 401 になる。 | 正常 |
| BDD-TM-032 | SPEC-TM-026 | DS の `description` タブを開くと、task の description が transport の接続有無にかかわらず表示される。 | 正常 |
| BDD-TM-033 | SPEC-TM-027 | DS でタスクを右クリックして delete を選ぶと確認ダイアログが画面中央に表示され、キャンセルでは消えず、削除でタスクが消える。 | 正常 |
| BDD-TM-034 | SPEC-TM-028 | タスク一覧の project ラベルが表示名（例: `#生活`）で表示され、DS のグループにも `生活` が並ぶ。 | 正常 |
| BDD-TM-035 | SPEC-TM-029 | `/settings` でプロジェクトを追加・改名・削除でき、削除したプロジェクトのタスクは未分類に残る。 | 正常 |
| BDD-TM-036 | SPEC-TM-030 | DS の `task` タブで title と description を編集して保存すると、その内容がタスクに反映され、左ペインのカードも更新される。 | 正常 |
| BDD-TM-037 | SPEC-TM-031 | MK 画面の入力欄が「メモを取る...」から開き、検索・選択・入力欄の文言が合意どおりである。 | 正常 |
| BDD-TM-038 | SPEC-TM-032 | Tasks・New task・DS・ログインのいずれでもモノクロームの色・2px 黒縁・1 枠のタスク一覧・黒縁のドロップダウンが適用され、フォントスタックに Atkinson Hyperlegible と Noto Sans JP が含まれる。 | 正常 |
| BDD-TM-039 | SPEC-TM-033 | `/tasks` から新規作成した task が、DS の同じ project グループの先頭に表示される。 | 正常 |
| BDD-TM-040 | SPEC-TM-034 | Tasks 画面の検索行が 入力欄 → `Filter` → 🔍 の順で並び、ツールバーには `Filter` が無い。`working:on` を選ぶと `Filter` が反転表示になる。 | 正常 |
| BDD-TM-041 | SPEC-TM-035 | DS で title を編集して `Ctrl` + `S` を押すと保存され、再読み込み後も反映されている。 | 正常 |
| BDD-TM-042 | SPEC-TM-036 | Tasks 一覧で 2 行目をチェックして 5 行目を Shift + クリックすると 4 件が選択され、`4 of M selected` と `is-selected` 4 行になる。上向きでも同じ範囲になり、選択済みの行への Shift + クリックで範囲を解除できる。 | 正常 |
| BDD-TM-043 | SPEC-TM-037 | Tasks 一覧で行の checkbox の当たり判定が 44×44px・本体が 24px で、全選択の checkbox と同じ中心に並ぶ。行の右余白をクリックすると選択がトグルされ、遷移しない。 | 正常 |
| BDD-TM-044 | SPEC-TM-038 | メモのカードを押すと詳細ダイアログが開き、編集した内容が保存されて再読み込み後も反映される。 | 正常 |
| BDD-TM-045 | SPEC-TM-038 | MK のツールバーに一括選択の切替が無く、検索欄がツールバーの幅いっぱいに広がる。 | 正常 |
| BDD-TM-047 | SPEC-TM-038 | MK にラベル関連の UI が無く、`/api/mk/labels` 系のエンドポイントは 404 を返す。 | 正常 |
| BDD-TM-048 | SPEC-TM-040 | 短いメモでは詳細ダイアログが小さく本文欄にスクロールが出ない。長文ではダイアログが伸び、上限では本文側だけが 1 本のスクロールバーになる。 | 正常 |
| BDD-TM-050 | SPEC-TM-042 | 1920px の画面で MK の本文が 1400px に収まり、カードが 4 列で折り返す。1024px では 3 列になる。 | 正常 |
| BDD-TM-046 | SPEC-TM-039 | 日次実行で暗号化アーカイブと manifest が作成され、復号すると元の SQL と sha256 が一致する。30 日を超えたアーカイブは削除される。 | 正常 |
| BDD-TM-049 | SPEC-TM-041 | DS の description に画像を貼り付けて保存すると、再読み込み後も画像が表示される。本文から画像を削除して保存すると、参照されていない画像レコードが削除される。 | 正常 |
## 未決事項

- `Do`、`Done`、`Skipped` をユーザー表示名の正とするか、日本語表示名を正とするか。
- project の `archived` を一覧・DS のグループ表示でどう扱うか。
