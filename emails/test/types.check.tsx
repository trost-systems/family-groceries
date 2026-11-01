// Type-only checks, run by `npm test` through tsc: wrong uses must not compile.
import { PhoneScreenshot, Steps } from '../src/components/index.ts';

const step = { title: 't', children: null };
export const ok = <Steps steps={[step, step, step]} />;
// @ts-expect-error one step is a paragraph
export const one = <Steps steps={[step]} />;
// @ts-expect-error five steps are a manual
export const five = <Steps steps={[step, step, step, step, step]} />;
// @ts-expect-error images only from hummlist.com
export const remote = <PhoneScreenshot src="https://example.com/x.png" alt="x" height={10} />;
// @ts-expect-error alt text is required
export const noAlt = <PhoneScreenshot src="https://hummlist.com/email/x.png" height={10} />;
