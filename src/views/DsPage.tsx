import type { FC } from "hono/jsx";
import type { Task } from "../task";

/**
 * DS screen: task list (left), DSH chat (center), browser (right).
 * The chat and browser panes are driven by client scripts.
 */
export const DsPage: FC<{ tasks: Task[]; selected: Task | undefined; wsUrl: string; workspace: string }> = ({
  tasks,
  selected,
  wsUrl,
  workspace,
}) => (
  <div class="ds" id="ds-root">
    <aside class="ds__pane ds__pane--tasks">
      <div class="ds__pane-head">Tasks</div>
      <ul class="ds__tasks">
        {tasks.map((task) => (
          <li>
            <a
              class={selected?.id === task.id ? "ds__task active" : "ds__task"}
              href={`/ds?task=${encodeURIComponent(task.id)}`}
            >
              <span class={`ds__dot ds__dot--${task.status}`} aria-hidden="true"></span>
              <span class="ds__task-title">{task.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </aside>

    <section class="ds__pane ds__pane--chat">
      <div class="ds__pane-head">
        <div class="ds__tabs" role="tablist">
          <button type="button" class="ds__tab active" data-ds-tab="chat" role="tab">
            Chat
          </button>
          <button type="button" class="ds__tab" data-ds-tab="memo" role="tab">
            Memo
          </button>
        </div>
        <div class="ds__chat-tools">
          <select id="dsh-chat-model" aria-label="モデル"></select>
          <div class="ds__access">
            <button type="button" class="ds__pill" id="dsh-chat-access" aria-haspopup="menu" aria-expanded="false">
              ワークスペース書き込み
            </button>
            <div class="ds__menu" id="dsh-chat-access-menu" hidden>
              <button type="button" data-mode="read-only">読み取り専用</button>
              <button type="button" data-mode="workspace-write">ワークスペース書き込み</button>
              <button type="button" data-mode="danger-full-access">フルアクセス</button>
            </div>
          </div>
        </div>
      </div>
      {selected === undefined ? (
        <p class="ds__empty">左のタスクを選択してください。</p>
      ) : (
        <>
        <div class="dsh-chat" id="dsh-chat" data-ds-pane="chat" data-task-id={selected.id} data-ws-url={wsUrl} data-workspace={workspace}>
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
        <div class="dsh-memo" id="dsh-memo" data-ds-pane="memo" hidden>
          <textarea id="dsh-memo-input" placeholder="このタスクのメモ（自分 / LLM 共有）"></textarea>
          <div class="dsh-memo__status" id="dsh-memo-status"></div>
        </div>
        </>
      )}
    </section>

    <aside class="ds__pane ds__pane--browser">
      <div class="ds__pane-head">Browser</div>
      <form class="ds__browser-bar" id="ds-browser-form">
        <input id="ds-browser-url" type="text" placeholder="https://example.com" />
        <button type="submit" class="button">
          開く
        </button>
      </form>
      <iframe id="ds-browser-frame" title="browser" src="about:blank"></iframe>
    </aside>
  </div>
);
