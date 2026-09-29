/**
 * Exists only to give the import room to finish.
 *
 * Scraping a project page, asking a model to read it, fetching up to
 * thirty photos and copying each into storage is minutes of work on a
 * bad day — and it all runs inside one Server Action, which inherits
 * its time limit from this route segment. The default is fifteen
 * seconds. When it runs out, what dies is the whole invocation: the
 * project row is already written, the photo rows are not, and the
 * import comes back looking like a page with no pictures on it.
 *
 * page.tsx is a Client Component and cannot carry route config, so the
 * config lives here. The layout renders nothing of its own.
 */
export const maxDuration = 300

export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return children
}
