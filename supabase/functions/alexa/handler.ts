// POST /functions/v1/alexa: the endpoint of the custom Alexa skill "Hummlist" (de-DE).
// Every request is verified first (verify.ts); a refused one answers 400 and touches nothing.
// The linked account is the Supabase OAuth access token Alexa got through account linking; its
// user's CURRENT household (household_members, read per request) is the one written to, never
// anything from the request. Adds go through the Siri path (voice/parse.ts, voice/items.ts), so
// items are split, categorized and deduplicated exactly as in the app.
import { AuthError } from '../_shared/auth.ts';
import { json } from '../_shared/http.ts';
import type { RequirePremium } from '../_shared/premium.ts';
import type { Added } from '../voice/handler.ts';
import { maxTextLength } from '../voice/handler.ts';
import { maxItems, type ParsedItem, parseSentence } from '../voice/parse.ts';
import { clip, confirmation, germanCase, listing, speech, type Spoken } from './speech.ts';
import { type Envelope, VerificationError } from './verify.ts';

/** The account behind a linked Alexa user. */
export interface Linked {
  userId: string;
  householdId: string;
  /** The Supabase session behind the access token (revoked when the skill is disabled). */
  sessionId: string;
}

export interface Deps {
  /** verify.ts's verifyRequest with the production (or test) trust. */
  verify(headers: Headers, body: Uint8Array<ArrayBuffer>): Promise<Envelope>;
  /** Resolves an OAuth access token; throws an AuthError when it is not a live link. */
  authenticate(accessToken: string): Promise<Linked>;
  /**
   * Job 50: whether the linked household may use Alexa (_shared/premium.ts). Asked before the
   * list is read or written and at launch; help, stop and the skill events never ask.
   */
  requirePremium: RequirePremium;
  /** Takes [count] from the user's allowance (30 items a minute); false when it is used up. */
  takeAdds(linked: Linked, count: number): Promise<boolean>;
  addItems(linked: Linked, items: ParsedItem[]): Promise<Added[]>;
  /** The household's open items in aisle order. */
  listItems(linked: Linked): Promise<Spoken[]>;
  /** Remembers which session this Alexa user holds; [relinked] revokes the ones before it. */
  remember(alexaUserId: string, linked: Linked, relinked: boolean): Promise<void>;
  /** Revokes every session this Alexa user holds (the skill was disabled). */
  revoke(alexaUserId: string): Promise<void>;
  /** Analytics for an add, if the user said yes in the app (never names). */
  counted(linked: Linked, added: Added[]): Promise<void>;
  /** Error tracking (telemetry.ts); scrubbed there. */
  report(error: unknown): void;
}

interface Reply {
  speech?: string;
  reprompt?: string;
  end: boolean;
  card?: 'link' | string;
  /** Ask for the items again, on AddItemIntent. */
  elicit?: boolean;
  attributes?: Record<string, unknown>;
}

function alexaResponse(reply: Reply): Response {
  const response: Record<string, unknown> = {};
  if (reply.speech) response.outputSpeech = { type: 'PlainText', text: clip(reply.speech) };
  if (reply.reprompt) {
    response.reprompt = { outputSpeech: { type: 'PlainText', text: reply.reprompt } };
  }
  if (reply.card === 'link') response.card = { type: 'LinkAccount' };
  else if (reply.card) {
    response.card = { type: 'Simple', title: speech.cardTitle, content: clip(reply.card) };
  }
  if (reply.elicit) {
    response.directives = [{
      type: 'Dialog.ElicitSlot',
      slotToElicit: 'items',
      updatedIntent: {
        name: 'AddItemIntent',
        confirmationStatus: 'NONE',
        slots: { items: { name: 'items', confirmationStatus: 'NONE' } },
      },
    }];
  }
  response.shouldEndSession = reply.end;
  return json({ version: '1.0', sessionAttributes: reply.attributes ?? {}, response });
}

/** The answer to requests Alexa wants no speech for (SessionEnded, skill events). */
const empty = () => json({ version: '1.0', response: {} });

const accessTokenOf = (envelope: Envelope) =>
  envelope.context?.System?.user?.accessToken ?? envelope.session?.user?.accessToken;

const alexaUserOf = (envelope: Envelope) =>
  envelope.context?.System?.user?.userId ?? envelope.session?.user?.userId;

export function createHandler(deps: Deps) {
  /** The linked account, or the reply to give instead (link card, no household, error). */
  async function linkedOrReply(envelope: Envelope): Promise<Linked | Reply> {
    const token = accessTokenOf(envelope);
    if (!token) return { speech: speech.linkAccount, card: 'link', end: true };
    let linked: Linked;
    try {
      linked = await deps.authenticate(token);
    } catch (e) {
      if (e instanceof AuthError) {
        if (e.reason === 'no_household') return { speech: speech.noHousehold, end: true };
        // Revoked in the app, the account deleted, signed out everywhere, or expired: unlinked.
        return { speech: speech.linkAccount, card: 'link', end: true };
      }
      deps.report(e);
      return { speech: speech.failed, end: true };
    }
    const alexaUser = alexaUserOf(envelope);
    if (alexaUser) {
      await deps.remember(alexaUser, linked, false).catch((e) => deps.report(e));
    }
    return linked;
  }

  const isReply = (x: Linked | Reply): x is Reply => 'end' in x;

  /**
   * The linked account if its household may use Alexa, else the reply instead: [locked] (with a
   * card, so the Alexa app shows it too) or [failed] when the check itself failed.
   */
  async function unlockedOrReply(
    envelope: Envelope,
    locked: string,
    failed: string,
  ): Promise<Linked | Reply> {
    const linked = await linkedOrReply(envelope);
    if (isReply(linked)) return linked;
    try {
      if (await deps.requirePremium(linked, 'alexa') === 'open') return linked;
    } catch (e) {
      deps.report(e);
      return { speech: failed, end: true };
    }
    return { speech: locked, card: locked, end: true };
  }

  /** One more try at most, then "nicht verstanden"; never a guess (AC4). */
  const notUnderstood = (envelope: Envelope): Reply =>
    envelope.session?.attributes?.retry ? { speech: speech.notUnderstood, end: true } : {
      speech: speech.notUnderstoodOnce,
      reprompt: speech.notUnderstoodReprompt,
      elicit: true,
      end: false,
      attributes: { retry: 1 },
    };

  async function addItems(envelope: Envelope): Promise<Reply> {
    const text = envelope.request.intent?.slots?.items?.value?.trim() ?? '';
    if (text.length > maxTextLength) return { speech: speech.tooLong, end: true };
    const heard = text ? parseSentence(text, maxItems + 1) : [];
    if (heard.length === 0) {
      // Not even linked: ask to link instead of asking again.
      if (!accessTokenOf(envelope)) return { speech: speech.linkAccount, card: 'link', end: true };
      return notUnderstood(envelope);
    }
    const linked = await unlockedOrReply(envelope, speech.premiumAdd, speech.failed);
    if (isReply(linked)) return linked;
    const items = heard.slice(0, maxItems).map((item) => ({
      ...item,
      name: germanCase(item.name, text),
    }));
    const cut = heard.length > maxItems ? ` ${speech.tooMany}` : '';
    let added: Added[];
    try {
      if (!await deps.takeAdds(linked, items.length)) {
        return { speech: speech.rateLimited, end: true };
      }
      added = await deps.addItems(linked, items);
    } catch (e) {
      deps.report(e);
      return { speech: speech.failed, end: true };
    }
    await deps.counted(linked, added).catch((e) => deps.report(e));
    // The server's parser can still find no item in a piece ("1 Packung"): nothing to read back.
    if (added.length === 0) return { speech: speech.notUnderstood, end: true };
    const said = confirmation(added) + cut;
    return { speech: said, card: said, end: true };
  }

  async function readList(envelope: Envelope): Promise<Reply> {
    const linked = await unlockedOrReply(envelope, speech.premium, speech.listFailed);
    if (isReply(linked)) return linked;
    try {
      const said = listing(await deps.listItems(linked));
      return { speech: said, card: said, end: true };
    } catch (e) {
      deps.report(e);
      return { speech: speech.listFailed, end: true };
    }
  }

  async function launch(envelope: Envelope): Promise<Reply> {
    // Locked: say why right away instead of asking for items it would not add.
    const linked = await unlockedOrReply(envelope, speech.premium, speech.failed);
    if (isReply(linked)) return linked;
    return { speech: speech.launch, reprompt: speech.launchReprompt, elicit: true, end: false };
  }

  async function intent(envelope: Envelope): Promise<Reply> {
    switch (envelope.request.intent?.name) {
      case 'AddItemIntent':
        return await addItems(envelope);
      case 'ReadListIntent':
        return await readList(envelope);
      case 'AMAZON.HelpIntent':
        return { speech: speech.help, reprompt: speech.helpReprompt, end: false };
      case 'AMAZON.StopIntent':
      case 'AMAZON.CancelIntent':
      case 'AMAZON.NavigateHomeIntent':
        return { speech: speech.goodbye, end: true };
      default:
        // AMAZON.FallbackIntent and anything this model does not know.
        return notUnderstood(envelope);
    }
  }

  async function skillEvent(envelope: Envelope): Promise<void> {
    const alexaUser = alexaUserOf(envelope);
    if (!alexaUser) return;
    if (envelope.request.type === 'AlexaSkillEvent.SkillDisabled') {
      await deps.revoke(alexaUser);
      return;
    }
    if (envelope.request.type === 'AlexaSkillEvent.SkillAccountLinked') {
      const token = envelope.request.body?.accessToken;
      if (typeof token !== 'string') return;
      try {
        await deps.remember(alexaUser, await deps.authenticate(token), true);
      } catch (e) {
        if (!(e instanceof AuthError)) throw e;
      }
    }
  }

  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return json({ error: 'method' }, { status: 405 });
    const body = new Uint8Array(await req.arrayBuffer());
    let envelope: Envelope;
    try {
      envelope = await deps.verify(req.headers, body);
    } catch (e) {
      if (e instanceof VerificationError) {
        console.warn(e.message);
        return json({ error: e.reason }, { status: 400 });
      }
      throw e;
    }
    const type = envelope.request.type;
    if (type.startsWith('AlexaSkillEvent.')) {
      try {
        await skillEvent(envelope);
      } catch (e) {
        deps.report(e);
        return json({ error: 'server' }, { status: 500 });
      }
      return empty();
    }
    switch (type) {
      case 'LaunchRequest':
        return alexaResponse(await launch(envelope));
      case 'IntentRequest':
        return alexaResponse(await intent(envelope));
      default:
        // SessionEndedRequest, System.ExceptionEncountered and the rest want no speech.
        if (type === 'System.ExceptionEncountered') {
          console.warn('alexa: Alexa reported an error with our last response');
        }
        return empty();
    }
  };
}
