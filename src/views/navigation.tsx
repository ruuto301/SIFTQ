import type { JSX } from "hono/jsx/jsx-runtime";

export function pageNav(path: string) {
  return {
    href: path,
    "hx-get": path,
    "hx-target": "#page",
    "hx-swap": "innerHTML",
    "hx-push-url": "true",
  };
}

export function NewTaskLink({ project }: { project: string | null | undefined }): JSX.Element {
  const href =
    project === undefined || project === null ? "/tasks/new" : `/tasks/new?project=${encodeURIComponent(project)}`;
  return (
    <a class="button primary" {...pageNav(href)}>
      New task
    </a>
  );
}
