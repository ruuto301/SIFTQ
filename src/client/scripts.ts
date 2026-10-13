import { STYLES_CSS } from "../styles";
import {
  ESCAPE_CANCEL_SCRIPT,
  HTMX_CONFLICT_SWAP_SCRIPT,
  POPOVER_DISMISS_SCRIPT,
  TASK_FORM_SHORTCUT_SCRIPT,
} from "./browser-scripts";
import { IDEA_DETAIL_SCRIPT, IDEAS_DND_SCRIPT } from "./idea-scripts";
import { MATRIX_DND_SCRIPT } from "./matrix-scripts";
import { DESCRIPTION_EDITOR_SCRIPT } from "./task-form-scripts";
import { TASK_LIST_SELECTION_SCRIPT } from "./task-list-scripts";

export type ClientAsset = {
  path: string;
  body: string;
  contentType: "text/css" | "application/javascript";
  kind: "style" | "script";
};

export const CLIENT_ASSETS: readonly ClientAsset[] = [
  { path: "/styles.css", body: STYLES_CSS, contentType: "text/css", kind: "style" },
  {
    path: "/htmx-conflict.js",
    body: HTMX_CONFLICT_SWAP_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/popover-dismiss.js",
    body: POPOVER_DISMISS_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/task-form-shortcut.js",
    body: TASK_FORM_SHORTCUT_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/escape-cancel.js",
    body: ESCAPE_CANCEL_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/description-editor.js",
    body: DESCRIPTION_EDITOR_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/matrix-dnd.js",
    body: MATRIX_DND_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/ideas-dnd.js",
    body: IDEAS_DND_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/idea-detail.js",
    body: IDEA_DETAIL_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
  {
    path: "/task-list-selection.js",
    body: TASK_LIST_SELECTION_SCRIPT,
    contentType: "application/javascript",
    kind: "script",
  },
];

export const CLIENT_ASSET_PATHS: readonly string[] = CLIENT_ASSETS.map((asset) => asset.path);
