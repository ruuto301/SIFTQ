# Task Management Screens

## 目的

モック BE 付き FE プレビューのタスク管理 UI の画面構成と画面遷移を外部設計として定義する。
この文書は画面から観測できる構造だけを扱い、内部実装方式は扱わない。

## 画面一覧

| id | 画面名 | 概要 |
| --- | --- | --- |
| P00 | Login | プレビューへログインする画面 |
| P02 | Task list | タスク一覧画面。選択したstatusのタスクを表示する |
| P03 | Task detail | タスク詳細画面 title、description、status、project を確認・編集する |
| P04 | New task | 新規タスク作成画面 |
| P05 | Status popover | 新規作成・詳細画面内のステータス選択パネル |
| P07 | Delete confirmation dialog | Task list 上の選択タスクを完全削除する確認ダイアログ |
| P08 | Idea list | Ideaをカード一覧で管理する画面 |
| P09 | Idea detail | Idea詳細画面 title、description、pinned を確認・編集する |
| P10 | DS | project ごとに区切ったタスク一覧と DSH の chat、description、設定、browser を 1 画面で扱う |

## 画面詳細

- `Task list` (`/tasks`)
  - `do`、`done`、`skip` の status 切り替えボタンを表示する。
  - status 指定なし、または不正な status で開いた場合は `do` を選択する。
  - 選択した status は `/tasks?status=<status>` で保持し、再読み込み後も維持する。
  - Task list 以外の画面から `/tasks` へ遷移した場合は `do` を選択する。
  - 選択した status と一致する task だけを表示する。該当 task がない場合は空状態メッセージを表示する。
  - 並びは `updated_at` の降順（新しい順）とする。
  - 各行は title、project ラベル、status badge を表示する。
  - project ラベルは `#<id>` を表示する。未設定の task は淡色で `未分類` を表示する。
  - status badge は `do / done / skip` を表示する。
  - status 絞り込み後の件数を25件単位でページ分割し、一覧下にページナビを表示する。
  - ページナビはページ番号と前へ/次へを持ち、先頭・最終ページは常に表示して間の飛び区間は「…」にまとめる。
  - 25件以下ではページナビを表示しない。
  - ページ指定は `/tasks?status=<status>&page=<page>` で保持する。status 切替時は1ページ目に戻る。
  - 数値以外のページ指定は1ページ目へ、範囲超過は最終ページへ寄せる。
  - 検索欄は `q` query で保持し、`is:do`、`is:done`、`is:skip`、`label:working`、`project:<id>`、`project:none` を status・label・project 絞り込みとして解釈する。
  - 検索欄の placeholder は `is:do project:Yoriwake label:working` とする。
  - `Labels` メニューから全label / `working only` と、Projects 節の全 project / `未分類` / 各 project を選択できる。選択すると検索欄の `project:<id>` を差し替える。
  - 各行に checkbox を表示し、一覧内の全選択と選択件数（`N of M selected`）を提供する。
  - 選択時は status 切り替えを隠し、`Mark as`（`do`、`done`、`skip`）、`Project`（`未分類` と各 project）、`Labels`、`delete` を表示する。
  - bulk 操作は選択中のtaskへ適用し、delete前には選択件数を含む確認ダイアログを表示する。
  - bulk 操作で競合または通信エラーが発生した場合は一覧上にエラーを表示し、競合時は再読み込みを促す。
  - `New task` は検索で絞り込んだ project を引き継ぎ、`/tasks/new?project=<id>` で既定 project とする。

- `Idea list` (`/ideas`)
  - Task とは独立したIdeaをカード一覧で表示する。
  - Ideaは`title`、`description`、`order`、`pinned`を持つ。`order`はpinned / unpinned各グループ内の表示順である。
  - `pinned = true` のカードを先に表示し、各グループ内を`order`の昇順にする。
  - カードはtitleとdescを表示する。
  - Ideaがない場合は空状態メッセージを表示する。
  - composerからtitleとdescriptionを入力してIdeaを作成する。
  - カードを開くとtitleとdescriptionを編集でき、自動保存する。
  - pin操作でカードの固定状態を切り替える。
  - カードをdrag and dropして同じグループ内の`order`を変更する。
  - ピン留め状態を切り替えたカードは移動先グループの末尾へ移動し、グループ内の`order`を振り直す。
  - カードを右クリックすると、`Matrixに移動` と `削除` をこの順で表示する。
  - `Matrixに移動` を選択すると Idea を一覧から除外し、同じ title / description の task を `status = do`、`project = 未設定`、`working = false` で末尾に作成する。
  - カードの `…` メニューは `削除` だけを表示する。
  - 削除操作の確認後、Ideaを一覧から除外する。
  - Idea 詳細モーダルの表示中、および移動処理中は移動メニューを開かない。
  - 移動に失敗した場合はカードを変更せず、画面上部に「移動に失敗しました。もう一度お試しください。」を表示する。

- `Idea detail` (`/ideas/:id` と Ideas 一覧から開く詳細モーダル)
  - title と description を編集し、自動保存する。
  - description 内の http/https URL は編集領域内でリンクとして表示する。
  - URL の通常クリックは同じタブ、Ctrl クリック / Command クリックは別タブで開く。
  - URL を貼り付けた場合もリンクとして表示し、保存する description はプレーンテキストとする。
  - 一覧カード内の title / description はリンク化の対象外とする。

- `Task detail` (`/tasks/:id`)
  - title と description を編集する。
  - description 内の http/https URL は編集領域内でリンクとして表示する。
  - URL の通常クリックは同じタブ、Ctrl クリック / Command クリックは別タブで開く。
  - URL のリンク表示は編集用の表示であり、保存する description はプレーンテキストとする。
  - status と project は右側 metadata として表示する。
  - status は Status の popover から選択する。
  - project は Status の下の `<select>` から選択する。先頭は `未分類` とし、変更すると即時保存する。
  - `Cancel` は遷移前の一覧へ戻る。
  - `Save` は編集内容を保存する。

- `New task` (`/tasks/new`)
  - detail と同じ 2 column layout を使う。
  - title と description を入力する。
  - description 内の http/https URL は編集領域内でリンクとして表示する。
  - URL の通常クリックは同じタブ、Ctrl クリック / Command クリックは別タブで開く。
  - URL を貼り付けた場合もリンクとして表示し、保存する description はプレーンテキストとする。
  - status と project は右側 metadata として表示する。
  - status は popover から選択し、選択内容は `Create` まで保存しない。
  - project は `<select>` から選択し、選択内容は `Create` まで保存しない。
  - 初期値は `status = do`、`project = 未分類` とする。
  - `project` query が指定され、その project が存在する場合は初期選択にする。
  - `status` query は初期値へ反映する。
  - `Cancel` は Task list へ戻る。
  - `Create` は task を作成して Task list へ進む。

- `Status popover`
  - new task または detail 画面上で status 選択 popover を開いた状態を表す。
  - 選択肢は `do / done / skip` とする。
  - 完成 UI では同じ detail surface 上で開く。
  - popover と Status サイドパネルの外側を押下すると、現在の選択を保持して通常表示へ戻る。

- `Delete confirmation dialog`
  - Task list 上で選択タスクの `delete` を押すと表示する。
  - メッセージは「選択した N 件のタスクを削除しますか？」とする。
  - ボタンは `キャンセル` と `削除` とする。
  - 表示中は画面全体を overlay で覆い、背後の一覧を操作できないようにする。
  - `キャンセル` は task を変更せずにダイアログを閉じる。
  - `削除` は選択タスクを完全削除し、Task list から除外する。

- `DS` (`/ds`)
  - 3 ペイン構成とし、左に Task list、中央に DSH、右に Browser を表示する。
  - 左ペインは `do`、`done`、`skip` の status 切り替えボタンを表示する。
  - status は `/ds?status=<status>` で保持し、未指定または不正な status は `do` とする。
  - 選択した status と一致する task だけを表示する。
  - status タブの直下（グループ一覧のスクロール領域の外）に、タスク入力欄と `追加` ボタンを表示する。
  - 入力欄の下に追加先 project の `select` を表示する。選択肢は project の一覧に `未分類` を加えたもので、`未分類` は最後に置く。
  - 追加先の既定値は選択中 task の project とし、task 未選択のときは `未分類` とする。タブまたは task を切り替えると既定値へ戻る。
  - `Enter`、`Ctrl + Enter`（Mac は `⌘ + Enter`）または `追加` で task を作成する。status は選択中のタブ、project は追加先 `select` の値とし、`未分類` は project 未設定として送る。
  - 作成した task は該当 project グループの末尾へ追加し、そのグループを展開して強調表示し、件数を更新する。ページ全体は再読み込みしない。
  - 入力欄が空のときは `追加` を無効にする。変換確定の `Enter` / `Ctrl + Enter` では送信しない。`Escape` は入力を消す。
  - task 名が 256 文字を超える場合と作成に失敗した場合は、入力内容を保持したままエラーを表示する。
  - task は project ごとにグループ化し、`projects.sort_order` の昇順で並べる。project 未設定の task は最後の `未分類` グループに表示する。
  - 各グループは見出しバー（`▾ project名 件数`）とその下のタスクカードで構成する。グループ全体を 2px の黒枠（角丸 8px）で囲み、見出しバーを枠の上辺にする。
  - 見出しバーは黒地に白文字とし、件数バッジは背景を持たず枠線のみで表示する。
  - 枠の内側にはカードとの間に白の余白を置く。枠はグループの中身の高さに追従し、タスクの追加・削除・折りたたみで伸縮する。タスクが増えても他のグループの枠は縮まず、一覧側がスクロールする。
  - 見出しバーを押すとグループを折りたたみ、折りたたみ状態は再読み込み後も維持する。折りたたむと枠は見出しバー 1 行に縮む。
  - 各カードは title と `working` badge を表示する。status badge と project ラベルは表示しない。
  - task 行を右クリックすると action menu を表示する。
  - action menu の選択肢は `do`、`done`、`skip` への変更、`working` の切り替え、`プロジェクト` サブメニュー（`未分類` と各 project）、task detail を開く、削除とする。
  - status 変更後、選択中 status と一致しない行は一覧から除外する。選択中だった場合は同じ status の一覧へ移動する。
  - project 変更後は一覧を読み込み直してグループへ反映する。
  - task カードをドラッグして別の project グループへドロップすると、その task の project を変更する。`未分類` へドロップすると project を未設定へ戻す。
  - project 見出しをドラッグして別の見出しへドロップすると並び順を変更し、`projects.sort_order` を更新する。`未分類` は並び替えの対象外で常に最後に表示する。
  - グループ内の task は `order` の昇順（同値は id 順）で表示する。同じ project グループ内で task カードをドラッグ&ドロップすると表示順を変更し、`tasks.order` を更新する。
  - ドラッグ中は受け入れ可能なターゲットで `dragover` を `preventDefault` し、`dropEffect = "move"` とドロップ位置の表示（枠線・挿入線）を出す。`dragend` または `Escape` で表示を戻す。
  - 並び替えや project 変更に失敗した場合は元の表示へ戻し、左ペインに失敗を表示する。
  - 削除は確認後に task を完全削除する。
  - 中央ペインは `Chat`、`説明`、`設定` のタブを表示する。
  - 中央ペインはタブ行の直下に選択中 task の title を表示する。未選択時は表示せず、長い title は省略せず折り返して全文を表示する。
  - `Chat` タブは task と DSH セッションを 1 対 1 で対応付け、指示の送信、応答の表示、承認の可否、model と access mode の切り替えを提供する。
  - `Chat` タブは `Ctrl` + `Enter` または送信ボタンで指示を送る。
  - ターン実行中は送信ボタンが停止ボタンに変わり、押すと実行中のターンを中断する。
  - `説明` タブは task の description を表示する。DSH はこの description を共有テキストとして読み書きする。
  - `設定` タブは選択中 profile の設定を表示し、保存する。
  - 右ペインは URL バー、戻る、進む、再読み込み、タブ、最大化を表示する。
  - ペイン境界の drag で幅を変更でき、右ペインは最大化できる。
  - ペイン幅と最大化状態は再読み込み後も維持する。

## 画面遷移

共通ナビゲーションは左から `Ideas`、`Tasks`、`DS` の順に表示する。一覧、詳細、モバイル表示で同じ順序とする。
`/matrix` へのリクエストは 301 で `/tasks` へ転送する。
画面遷移は `presentation.json` の `navigation` を正本とする。`task docs:domain:svg` で `domain-model.json` にマージし、図（`nav.svg`）を生成する。

## モック BE プレビュー

- `bun run preview:mock` で起動する。
- `http://127.0.0.1:8787` を開き、パスワード `preview` でログインする。
- `DS` は DSH transport（`dsh siftq`）と browser 実行環境を必要とする。
- Task list と DS は固定初期データを表示する。Idea list は固定初期データにブラウザのlocalStorageで作成・編集・削除・ピン留め・並べ替えの変更を重ねる。localStorageを削除するとIdeaだけ初期状態に戻る。
