import { defineConfig } from 'vite';

// If deploying to GitHub Pages under a repo subpath, we need a base path so that
// assets resolve correctly (e.g. https://username.github.io/repo-name/).
// We derive it from REPO_NAME env (can be set in workflow) else default '/'.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')?.[1];
// Allow override through BUILD_BASE or VITE_BASE if needed.
const explicitBase = process.env.BUILD_BASE || process.env.VITE_BASE;
const base = explicitBase || (repoName ? `/${repoName}/` : '/');

export default defineConfig({
  base,
  server: {
    port: 5173,
  },
});
