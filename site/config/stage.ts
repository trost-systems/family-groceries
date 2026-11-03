// The site's launch stage, one line to change (job 82 ADDENDUM 8, job 93). The build reads the
// `stage` line below as text (site/agent.mjs readStage), so keep its shape.
// 'launch' also turns on the launch guard: the build fails while any noindex is left.
export type Stage = 'waitlist' | 'beta' | 'launch';

export const stage: Stage = 'waitlist';
