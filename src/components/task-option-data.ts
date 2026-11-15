import type { TaskStatus } from "../task";

export const STATUS_DESCRIPTIONS: Record<TaskStatus, string> = {
  do: "実行対象。",
  done: "完了。",
  skip: "見送り。",
};

export const STATUS_DOT_CLASSES: Record<TaskStatus, string> = {
  do: "status-dot status-dot--do",
  done: "status-dot status-dot--done",
  skip: "status-dot status-dot--skip",
};

export const PROJECT_NONE_LABEL = "未分類";
