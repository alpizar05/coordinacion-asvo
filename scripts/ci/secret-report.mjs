import { relative } from 'node:path';
/** Secretlint JSON may contain original source: never forward it to logs/artifacts. */
export function sanitizedFindings(results, root) {
  return results.flatMap((result) =>
    (result.messages ?? []).map((message) => ({
      file: result.filePath?.startsWith(root) ? relative(root, result.filePath) : result.filePath,
      line: message.loc?.start?.line ?? message.line,
      rule: message.ruleId,
      code: message.messageId,
    })),
  );
}
