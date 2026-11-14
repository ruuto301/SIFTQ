import type { FC } from "hono/jsx";
import type { Project } from "../project";

export type ProjectRow = { project: Project; count: number };

/**
 * Settings screen. Only the project section exists today; the page is additive so
 * further settings can be added as sections without moving the navigation entry.
 */

const SettingsProjectRow: FC<{ project: Project; count: number }> = ({ project, count }) => (
  <li
    class="settings-row"
    data-settings-row
    data-project-id={project.id}
    data-project-name={project.name}
    data-count={String(count)}
  >
    <span class="settings-row__name" data-project-name-label>
      {project.name}
    </span>
    <span class="settings-row__id">{project.id}</span>
    <span class="settings-row__count">{count} 件</span>
    <span class="settings-row__actions">
      <button type="button" class="button small" data-project-up aria-label="上へ移動">
        ↑
      </button>
      <button type="button" class="button small" data-project-down aria-label="下へ移動">
        ↓
      </button>
      <button type="button" class="button small" data-project-rename>
        名前を編集
      </button>
      <button type="button" class="button small button--danger" data-project-delete>
        削除
      </button>
    </span>
  </li>
);

export const SettingsPage: FC<{ rows: readonly ProjectRow[]; unassigned: number }> = ({
  rows,
  unassigned,
}) => (
  <div class="page page--settings" data-settings-page>
    <div class="page-header">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="muted">プロジェクトはタスクに 1 つ付くラベルです。</p>
      </div>
    </div>

    <section class="settings-section" data-settings-projects>
      <h2 class="settings-section__title">Projects</h2>
      <p class="settings-section__hint">
        削除してもタスクは消えません。そのプロジェクトのタスクは未分類に移ります。
      </p>

      <ul class="settings-list" data-settings-list>
        {rows.map(({ project, count }) => (
          <SettingsProjectRow project={project} count={count} key={project.id} />
        ))}
      </ul>

      <p class="settings-none">未分類: {unassigned} 件（固定・削除できません）</p>

      <form class="settings-add" data-settings-add>
        <input
          type="text"
          name="name"
          maxlength={32}
          placeholder="新しいプロジェクト名（例: 家計）"
          aria-label="新しいプロジェクト名"
        />
        <button type="submit" class="button primary">
          追加
        </button>
      </form>

      <p class="settings-error" data-settings-error role="alert" hidden></p>
    </section>
  </div>
);
