/**
 * Intentional escape hatch for Discord/Supabase payloads that are not yet
 * fully modeled. Prefer concrete interfaces when touching a call site.
 *
 * Using this alias (instead of the `any` keyword) keeps call sites lint-clean
 * while documenting the debt in one place.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- single project-wide untyped alias
export type Untyped = any;
