/** Node filesystem wiring for the pure content loader (content.ts).
 *
 * This is the only src/ module (besides index.ts re-exporting it) that touches
 * node:fs; the core engine stays dependency-free and React-Native-portable.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { loadContentFromReader, type ContentHandle, type ContentReader } from "./content.js";

function walkFiles(root: string): string[] {
  // Mirror of Python os.walk collection: every file under the package,
  // reported as a forward-slash relative path. Order is irrelevant — the
  // loader sorts before use.
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop() as string;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  }
  return out;
}

function nodeReader(packagePath: string, schemaDir: string): ContentReader {
  return {
    packagePath,
    readPackageText: (rel: string) => {
      const full = path.join(packagePath, rel);
      if (!fs.existsSync(full)) {
        return null;
      }
      return fs.readFileSync(full, "utf-8");
    },
    listPackageFiles: () => walkFiles(packagePath),
    readSchemaText: (name: string) => fs.readFileSync(path.join(schemaDir, name), "utf-8"),
  };
}

/** Load and fully validate a content package. Returns a ContentHandle. */
export function loadContent(packagePath: string, schemaDir?: string): ContentHandle {
  const resolvedSchemaDir = schemaDir ?? path.normalize(path.join(packagePath, "..", "..", "schema"));
  return loadContentFromReader(nodeReader(packagePath, resolvedSchemaDir));
}
