# Copy Hummlist Launch still has to write

The components are done; these words are not. Write them in the files named, then run
`npm test` and `npm run production` (docs/EMAIL.md, "How Launch writes a new mail").

1. **German auth mails.** The 13 Supabase templates (`src/emails/auth.tsx`) carry Supabase's
   English default wording, unchanged, as the hosted project sends it today. Hummlist's readers
   are German first: write DE versions (and decide whether the EN ones get Hummlist's voice).
   Supabase sends one template per type for every user, so a DE/EN choice per reader needs a Go
   template branch or a Send Email Hook; until then pick one language per template.
2. **Reason lines marked draft** (`reason: { draft }`): confirmation, recovery, email change,
   invite, reauthentication, the seven security notices, and "partner joined". Legal wrote the
   sign-in, account deletion and E1 lines; confirm or rewrite the rest.
3. **Account deletion mail** (`src/emails/notices.tsx`, `AccountDeletedDe`): the body is a
   `Draft`. Subject is a draft too.
4. **Partner joined** (`PartnerJoinedDe`): the sentence is Legal N-14's; the subject
   ("Neues Mitglied in deinem Haushalt", no first name per N-20) is a draft.
5. **Legal footer and unsubscribe line:** done by Legal Review (N-15 a and b), pending Peter's
   approval. Not Launch's to change.
6. **iPhone welcome** (DE, EN): build once iOS is installable, from Launch's existing drafts.
