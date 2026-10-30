// The alexa function's settings from the environment (docs/ALEXA.md, "Configuration").
//   ALEXA_SKILL_ID: our skill id(s), comma-separated; none set refuses every request.
//   ALEXA_TEST_ROOT_PEM, ALEXA_TEST_CHAIN_PEM (base64 of PEM): a test CA standing in for Amazon's,
//     written by scripts/alexa-test-ca.sh for the local stack. Honoured only when the function runs
//     inside a local stack (SUPABASE_URL http://kong:8000); in a hosted project they are ignored and
//     only Amazon's pinned roots count.
import type * as x509 from '@peculiar/x509';
import type { Env } from '../_shared/telemetry.ts';
import { amazonRootsPem } from './anchors.ts';
import { cachingFetcher, parseCertificates } from './verify.ts';

export const localStackUrl = 'http://kong:8000';

export interface Trust {
  anchors: x509.X509Certificate[];
  fetchChain(url: URL): Promise<string>;
  skillIds: string[];
  /** The test CA is in use (local stack only). */
  test: boolean;
}

const fromBase64 = (text: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(text.trim()), (c) => c.charCodeAt(0)),
  );

export function trustFrom(env: Env, fetchImpl: typeof fetch = fetch): Trust {
  const skillIds = (env.get('ALEXA_SKILL_ID') ?? '').split(',').map((s) => s.trim()).filter(
    Boolean,
  );
  const testRoot = env.get('ALEXA_TEST_ROOT_PEM');
  const testChain = env.get('ALEXA_TEST_CHAIN_PEM');
  if (testRoot && testChain) {
    if (env.get('SUPABASE_URL') === localStackUrl) {
      const chain = fromBase64(testChain);
      return {
        anchors: parseCertificates(fromBase64(testRoot)),
        fetchChain: () => Promise.resolve(chain),
        skillIds,
        test: true,
      };
    }
    console.error('alexa: ALEXA_TEST_* ignored outside the local stack');
  }
  return {
    anchors: parseCertificates(amazonRootsPem),
    fetchChain: cachingFetcher(fetchImpl),
    skillIds,
    test: false,
  };
}
