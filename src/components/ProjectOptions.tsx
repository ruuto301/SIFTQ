import type { FC } from "hono/jsx";
import type { Project } from "../project";
import { PROJECT_NONE_LABEL } from "./task-option-data";

/** Shared option list for a project select. `selected === null` means 未分類. */
export const ProjectOptions: FC<{ projects: readonly Project[]; selected: string | null }> = ({
  projects,
  selected,
}) => (
  <>
    <option value="" selected={selected === null}>
      {PROJECT_NONE_LABEL}
    </option>
    {projects.map((project) => (
      <option value={project.id} selected={selected === project.id} key={project.id}>
        {project.name}
      </option>
    ))}
  </>
);
