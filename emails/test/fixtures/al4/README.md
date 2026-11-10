The six auth mails as AL4 shipped them (main 0873093e, `supabase/templates/*.html` and the
subjects in `supabase/config.toml`), before emails/ restyled them. `test/emails.test.tsx` checks
that the restyled mails keep this wording, both languages, word for word. Change a mail's words
here and in `src/emails/auth.tsx` together.
