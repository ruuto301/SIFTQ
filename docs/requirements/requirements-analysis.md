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
| REQ-TM-017 | ユーザーは、DS の中央ペインでタスクの description を確認したい。 | screens.md |
| REQ-TM-018 | ユーザーは、DS でタスクを削除する前に画面中央で確認したい。 | screens.md |

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
| SPEC-TM-021 | REQ-TM-012 | DS の中央ペインはタブ行の直下に選択中 task の title をラベルなしで表示する。未選択時は表示せず、長い title は省略せず折り返して全文を表示する。 | BDD-TM-027 |
| SPEC-TM-022 | REQ-TM-013 | DS 左ペインの status タブ直下で task を作成できる。status は選択中タブ、project は追加先 select（既定は選択中 task、`未分類` も選べる）とし、作成した task は該当 project グループへ追加して件数を更新する。失敗時は入力内容を保持してエラーを表示する。 | BDD-TM-028 |
| SPEC-TM-023 | REQ-TM-014 | DS 左ペインの project グループは 2px の黒枠で囲み、見出しバーを枠の上辺にする。枠は中身の高さに追従し、task の追加・削除・折りたたみで伸縮する。task が増えても他のグループは潰れず、一覧側がスクロールする。 | BDD-TM-029 |
| SPEC-TM-024 | REQ-TM-015 | DS の task 行の右クリックメニューは、先頭に task 名と `status ・ project` を表示する。`status` は `do` / `done` / `skip` のピル（現在値は黒地 + 白文字）、`project` は現在の project 名と `▸`、続いて `copy title`、区切りの下に `working`（`on` / `off`）と `delete` を表示する。文言は英語に統一し、task detail を開く / リンクをコピーは持たない。 | BDD-TM-030 |
| SPEC-TM-025 | REQ-TM-016 | DS の composer で作成した task は所属 project グループの先頭に挿入し、既存 task の `order` は `+1` する。グループが折りたたまれている場合は折りたたんだまま件数だけを更新する。`/tasks` の新規作成は従来どおり末尾に追加する。 | BDD-TM-031 |
| SPEC-TM-026 | REQ-TM-017 | DS 中央ペインの `description` タブは、選択中 task の description を初期表示から描画する。DSH transport が使える場合は `desc.get` の応答を優先し、使えない場合は task の description を表示する。description が空のときはプレースホルダを表示する。 | BDD-TM-032 |
| SPEC-TM-027 | REQ-TM-018 | DS のタスク削除は、既存の中央モーダル（`.matrix-modal`）を使った確認ダイアログを経由する。ダイアログはビューポート中央に表示し、`キャンセル`・`Escape`・背景クリックでは削除せず、`削除` で削除する。ブラウザ標準の `window.confirm` は使わない。 | BDD-TM-033 |

## BDD 候補

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
| BDD-TM-027 | SPEC-TM-021 | DS で task を選択すると、タブ行とメッセージ欄の間にその task の title が表示される。 | 正常 |
| BDD-TM-028 | SPEC-TM-022 | DS 左ペインで task を追加すると、選択中 status と追加先 project で作成され、その project グループに表示される。 | 正常 |
| BDD-TM-029 | SPEC-TM-023 | DS 左ペインの project ごとに黒枠が付き、task を追加すると枠が伸びて他の project は縮まない。折りたたむと枠は見出し 1 行に縮む。 | 正常 |
| BDD-TM-030 | SPEC-TM-024 | DS 左ペインの task を右クリックすると英語の action menu が開き、status ピルで状態を変更でき、`copy title` でタイトルがクリップボードに入る。 | 正常 |
| BDD-TM-031 | SPEC-TM-025 | DS で task を追加すると、その project グループの先頭に表示され、リロード後も先頭のままになる。折りたたみ中のグループでは折りたたみが維持され件数だけ増える。 | 正常 |
| BDD-TM-032 | SPEC-TM-026 | DS の `description` タブを開くと、task の description が transport の接続有無にかかわらず表示される。 | 正常 |
| BDD-TM-033 | SPEC-TM-027 | DS でタスクを右クリックして delete を選ぶと確認ダイアログが画面中央に表示され、キャンセルでは消えず、削除でタスクが消える。 | 正常 |

## 未決事項

- `Do`、`Done`、`Skipped` をユーザー表示名の正とするか、日本語表示名を正とするか。
- project の `archived` を一覧・DS のグループ表示でどう扱うか。
