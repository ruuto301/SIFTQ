# Task and Idea Management Domain

## 目的

ユーザーから見える task の状態、属性、遷移ルールを外部設計として定義する。
ここでの domain は DB schema、ORM model、TypeScript の内部型定義ではない。

## Task

| 属性 | 値 | 外部仕様 |
| --- | --- | --- |
| `title` | `Title` 値オブジェクト | list、detail に表示する。 |
| `description` | `Description` 値オブジェクト | detail と new task で入力・編集する。http/https URL は編集領域内でリンクとして表示するが、保存値はプレーンテキストとする。 |
| `status` | `do` / `done` / `skip` | 進行状態。list の表示可否を決める。 |
| `project` | `projects.id` または未設定 | タスクの分類先。1 タスクにつき 1 project を持つ。 |
| `order` | number | owner 全体の表示順。 |
| `working` | boolean | 作業中かどうか。`status` と直交する。 |

## Project

- `Project` は task の分類先である。
- 属性は `id`、`name`、`path`、`sort_order`、`archived` とする。
- `id` は英数字と `-` `_` からなる最大 64 文字の文字列とする（INV-TM-002）。
- `sort_order` の昇順で表示する。
- task は `project` に `projects.id` を持つか、未設定（unassigned）とする。
- 未知の `project` は指定できない。
- task に表示する project ラベルは `#<id>`、未設定は `未分類` とする。

## Idea

- `Idea` は `Task` と独立したエンティティである。
- `title` は Task と共有する `Title` 値オブジェクトを使う。
- `description` は Task と共有する `Description` 値オブジェクトを使う。
- 属性は `title`、`description`、`order`、`pinned` とする。
- `order` は pinned / unpinned の各グループ内の表示順を表す。
- `pinned = true` のカードを先に表示し、各グループ内を `order` の昇順にする。
- `pinned` はカードの固定状態を表す。
- Idea は作成、編集、削除、ピン留め、並べ替えを行う。

## Idea と Task の相互移動

- Idea から Task へ移動すると、title と description を引き継ぎ、`status = do`、`project = 未設定`、`working = false` の Task を末尾に作成して元の Idea を削除する。
- Task から Idea へ移動すると、title と description を引き継ぎ、`pinned = false` の Idea を unpinned の末尾に作成して元の Task を version 付きで削除する。
- 移動は移動先の作成後に元を削除する。元の削除に失敗した場合は移動先を削除して元を残す。
- Idea は version を持たないため、削除時は最新の Idea を対象にする。
- 移動で生じた `order` の穴は既存の delete と同様に許容する。

## Title

- `title` は Task と Idea が共有する `Title` 値オブジェクトである。
- 内包する値は text である。
- `title` の長さは、Unicodeコードポイント数で1以上256以下とする。

## Description

- Task と Idea の `description` は、同じ `Description` 値オブジェクトである。
- 内包する値は text である。
- 空文字を許可する。
- `description` の長さは、Unicodeコードポイント数で0以上16,384以下とする。
- 保存値はプレーンテキストとする。

## Status

| Status | List 表示 | 意味 |
| --- | --- | --- |
| `do` | 表示する | 実行対象の task。 |
| `done` | 表示する | 完了した task。 |
| `skip` | 表示する | 実行しない task。 |

## 不変条件

実装とテストが守るべき不変条件。ID は `domain-model.json` の `rules` から参照し、テスト名にも含める。

| ID | 不変条件 |
| --- | --- |
| INV-TM-001 | `status` は `do` / `done` / `skip` のいずれかである。 |
| INV-TM-002 | `project` は `projects.id` のいずれか、または未設定である。 |
| INV-TM-003 | `working` は `status` と直交し、終了時も自動解除しない。 |
| INV-TM-004 | `order` は `owner_id` 内で連番を保つ。 |
| INV-TM-005 | `title` の長さはUnicodeコードポイント数で1以上256以下とする。 |
| INV-TM-006 | `description` の長さはUnicodeコードポイント数で0以上16,384以下とする。 |

## 状態遷移ルール

- `status` と `project` は分離する。
- `status` を `done` または `skip` に変更しても `project` は変更しない。
- `project` 変更は detail の Project 選択から行う。
- `status` 変更は detail の status popover から行う。
- task list は選択した status の task だけを表示する。選択肢は `do / done / skip` とし、初期値は `do` とする。
- task list の status 選択は再表示可能な状態として扱い、`/tasks?status=<status>` で保持する。

## Delete

- task の delete は status 変更ではなく、task 自体の完全削除である。
- delete した task は Task list、detail のいずれにも表示しない。
- delete した task は復元しない。

## Order

- `order` は owner 全体の表示順を表す。
- 新規 task の `order` は既存 task の最大値の次とする。
- `order` の永続化形式と正規化タイミングは次スコープで決める。
