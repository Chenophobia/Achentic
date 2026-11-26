export const PHASES = ["Plan", "Design", "Build", "Test", "Deploy", "Maintain"];

const SKILLS = {
  Plan: ["sharpen", "in-your-own-words", "how", "why", "investigation", "principle-attack-the-premise", "principle-experience-first", "grill-with-docs", "to-spec", "to-tickets"],
  Design: ["architect", "arena", "statechart", "figure-it-out", "prototype", "multi-phase-plan", "principle-foundational-thinking", "principle-exhaust-the-design-space", "principle-model-the-domain", "principle-redesign-from-first-principles", "principle-type-system-discipline", "principle-boundary-discipline"],
  Build: ["poteto-mode", "feature", "bug-fix", "refactoring", "typescript-best-practices", "tdd", "swarm", "no-comments", "unslop", "principle-subtract-before-you-add", "principle-laziness-protocol", "principle-minimize-reader-load", "principle-fix-root-causes", "principle-build-the-lever", "principle-sequence-verifiable-units", "principle-migrate-callers-then-delete-legacy-apis", "principle-make-operations-idempotent", "principle-separate-before-serializing-shared-state"],
  Test: ["interrogate", "blast-radius", "create-verification-skill", "benchmark-checklist", "visual-parity", "eval", "runtime-forensics", "trace-forensics", "perf-issue", "principle-prove-it-works", "principle-test-behavior-not-implementation", "principle-explain-the-number"],
  Deploy: ["shipping", "opening-a-pr", "babysit", "worktree-cleanup"],
  Maintain: ["correct", "maintain-verification-skill", "reflect", "recall", "hillclimb", "principle-encode-lessons-in-structure", "improve-codebase-architecture", "triage"],
};

function bare(skill) {
  return skill.replace(/^playbook: /, "").replace(/^[\w-]+:/, "");
}

export function phaseOfSkill(skill) {
  const name = bare(skill);
  return PHASES.find((phase) => SKILLS[phase].includes(name)) ?? "Build";
}

export function skillsByPhase(skills) {
  const grouped = Object.fromEntries(PHASES.map((phase) => [phase, []]));
  for (const skill of new Set(skills)) grouped[phaseOfSkill(skill)].push(skill);
  return grouped;
}

export function pstackFor(phase) {
  return SKILLS[phase];
}
