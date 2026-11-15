import { BASE_CSS } from "./styles/base";
import { COMMON_CSS, LOGIN_CSS } from "./styles/login";
import { DSH_CHAT_CSS } from "./styles/dsh-chat";
import { DS_CSS } from "./styles/ds";
import { IDEAS_CSS } from "./styles/idea";
import { MK_CSS } from "./styles/mk";
import { TASK_FORM_CSS } from "./styles/task-form";
import { TASK_LIST_CSS, TASK_LIST_RESPONSIVE_CSS } from "./styles/task-list";
import { SETTINGS_CSS } from "./styles/settings";

export const STYLES_CSS =
  BASE_CSS +
  "\n" +
  IDEAS_CSS.slice(1) +
  MK_CSS.slice(1) +
  TASK_LIST_CSS.slice(1) +
  TASK_FORM_CSS.slice(1) +
  COMMON_CSS +
  TASK_LIST_RESPONSIVE_CSS +
  LOGIN_CSS +
  DSH_CHAT_CSS +
  DS_CSS +
  SETTINGS_CSS;
