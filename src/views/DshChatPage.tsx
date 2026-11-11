import type { FC } from "hono/jsx";
import type { Task } from "../task";

/**
 * DSH chat screen: drives the siftq transport over WebSocket.
 * The client script (/dsh-chat.js) owns the connection and rendering.
 */
export const DshChatPage: FC<{ task: Task; wsUrl: string; workspace: string }> = ({ task, wsUrl, workspace }) => (
  <div class="dsh-chat" id="dsh-chat" data-task-id={task.id} data-ws-url={wsUrl} data-workspace={workspace}>
    <div class="page-header">
      <h1 class="page-title">DSH chat</h1>
      <div class="dsh-chat__head-actions">
        <a class="button" href={`/tasks/${task.id}`}>
          Task
        </a>
        <span class="dsh-chat__state" id="dsh-chat-state">
          接続中…
        </span>
      </div>
    </div>
    <p class="dsh-chat__title">{task.title}</p>
    <div class="dsh-chat__usage" id="dsh-chat-usage" hidden></div>
    <div class="dsh-chat__log" id="dsh-chat-log" aria-live="polite"></div>
    <div class="dsh-chat__approval" id="dsh-chat-approval" hidden></div>
    <form class="dsh-chat__form" id="dsh-chat-form">
      <textarea id="dsh-chat-input" rows={3} placeholder="DSH に指示する"></textarea>
      <div class="dsh-chat__buttons">
        <button type="submit" class="button" id="dsh-chat-send">
          送信
        </button>
      </div>
    </form>
  </div>
);
