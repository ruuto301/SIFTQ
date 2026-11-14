import type { FC } from "hono/jsx";
import type { Project } from "../project";
import { PROJECT_NONE_LABEL } from "./task-option-data";

/**
 * Shared option list for a project select. `selected === null` means 未分類.
 * `noneLast` keeps 未分類 at the end, which mirrors the DS left pane group order.
 */
export const ProjectOptions: FC<{
  projects: readonly Project[];
  selected: string | null;
  noneLast?: boolean;
}> = ({ projects, selected, noneLast = false }) => (
  <>
    {noneLast ? null : (
      <option value="" selected={selected === null}>
        {PROJECT_NONE_LABEL}
      </option>
    )}
    {projects.map((project) => (
      <option value={project.id} selected={selected === project.id} key={project.id}>
        {project.name}
      </option>
    ))}
    {noneLast ? (
      <option value="" selected={selected === null}>
        {PROJECT_NONE_LABEL}
      </option>
    ) : null}
  </>
);
