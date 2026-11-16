import { EMPTY_IDEA_PREVIEW } from "../idea";
import type { IdeaNote } from "../idea";

/** Preview-mode notes so the Ideas screen shows realistic content without D1. */
export const PREVIEW_IDEAS: readonly IdeaNote[] = [
  {
    id: "preview-note-1",
    owner_id: "local",
    title: "毎朝の振り返りを1分で終える",
    body: "昨日のタスクを 3 つだけ見直す。\n- done を確認\n- 今日の 1 件を決める",
    color: "yellow",
    pinned: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...EMPTY_IDEA_PREVIEW,
  },
  {
    id: "preview-note-2",
    owner_id: "local",
    title: "資産の種類と共通点",
    body: "現金 / 投資 / 保険 を同じ表で並べると抜けが見える。",
    color: "blue",
    pinned: false,
    created_at: "2026-01-03T00:00:00.000Z",
    updated_at: "2026-01-03T00:00:00.000Z",
    archived_at: null,
    deleted_at: null,
    ...EMPTY_IDEA_PREVIEW,
  },
];
