import { ScriptTarget, flattenDiagnosticMessageText, transpileModule } from "typescript";

/** Diagnostics for a client script; empty when the script parses. */
export function scriptDiagnostics(script: string): readonly string[] {
  const transpiled = transpileModule(script, {
    compilerOptions: { allowJs: true, target: ScriptTarget.Latest },
    reportDiagnostics: true,
  });

  return (transpiled.diagnostics ?? []).map((diagnostic) => flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}
