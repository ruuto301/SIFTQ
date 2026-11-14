import type { JSX } from "hono/jsx/jsx-runtime";
import { LoginCard, StandalonePage } from "./StandalonePage";

export function safeNextPath(next: string | undefined): string {
  if (next !== undefined && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/ideas";
}

export function LoginPage({
  error = false,
  next,
}: {
  error?: boolean;
  next?: string;
}): JSX.Element {
  return (
    <StandalonePage>
      <LoginCard>
        <a
          class="button primary"
          href={`/auth/github?next=${encodeURIComponent(safeNextPath(next))}`}
        >
          Sign in with GitHub
        </a>
        {error ? <p class="error">GitHub sign-in failed</p> : null}
      </LoginCard>
    </StandalonePage>
  );
}
