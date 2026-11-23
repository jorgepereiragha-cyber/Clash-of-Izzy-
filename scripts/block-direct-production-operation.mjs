// Deliberately fail closed. The user-facing npm scripts must never bypass
// reviewed GitHub Actions production gates, production environment approval,
// migration staging, CI checks, or the pre-migration Time Travel bookmark.
// It is intentionally NOT a toggle controlled by an environment variable.
const mode = process.argv[2] ?? "";
const routes = {
  migrate: {
    title: "Remote D1 migrations",
    workflow: "repair-production-d1-core.yml",
    guidance: "Only the explicitly approved 0037-0039 core-repair workflow is currently authorized. Migrations 0040+ require separate review."
  },
  deploy: {
    title: "Cloudflare production Worker deploy",
    workflow: "deploy-worker-only.yml",
    guidance: "Publish Worker/assets only after the production D1 health gate is green. This workflow does not migrate the database."
  }
};
const target = routes[mode];
if (!target) {
  console.error("Unrecognized production operation. No deployment or database change performed.");
  process.exitCode = 2;
} else {
  console.error("[BLOCKED] " + target.title + " cannot be run via a direct npm shortcut.");
  console.error(target.guidance);
  console.error("Use the protected, manually approved GitHub workflow:");
  console.error("https://github.com/jorgepereiragha-cyber/Clash-of-Izzy-/actions/workflows/" + target.workflow);
  process.exitCode = 1;
}
