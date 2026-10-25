#!/usr/bin/env bash
# Review 2's probes against the committed rules, in a throwaway worktree of HEAD (probe files are
# written there, scanned, and removed with the worktree). Usage: probes.sh <repo checkout>
set -uo pipefail
repo="$(realpath "$1")"; wt="$(mktemp -d)/wt"
git -C "$repo" worktree add -q --detach "$wt" HEAD
trap 'git -C "$repo" worktree remove --force "$wt"' EXIT
cd "$wt" || exit 1; export PATH="$HOME/.deno/bin:$PATH"
lits() { ast-grep scan --rule "ast-grep/rules/$1.yml" "$2" --json=compact 2>/dev/null |
  python3 -c "import json,sys; [print(f'  line {m[\"range\"][\"start\"][\"line\"]+1}: {m[\"text\"]}') for m in json.load(sys.stdin)]"; }

echo "== 1. no-hardcoded-ui-text: same-file constants, getters, collection if/for"
cat > app/lib/zz_probe.dart <<'EOF'
import 'package:flutter/widgets.dart';

const _labels = ['Eins', 'Zwei'];
const _m = {'a': 'Karte'};
String get _title => 'Getter';

class P extends StatelessWidget {
  const P({super.key});
  static const _own = ['Statisch'];
  @override
  Widget build(BuildContext context) {
    final c = DateTime.now().second > 3;
    return Column(children: [
      Text(_labels[0]),
      Text(_own[0]),
      Text(_m['a']!),
      Text(_title),
      Text([if (c) 'Wenn'].first),
      Text([for (final _ in [1]) 'Eins'].first),
    ]);
  }
}
EOF
sed 's/^/  | /' app/lib/zz_probe.dart; echo "  findings:"; lits no-hardcoded-ui-text app/lib/zz_probe.dart

echo; echo "== 5. dispose-after-dialog: .then without await"
cat > app/lib/zz_probe.dart <<'EOF'
void open(BuildContext context) {
  final c = TextEditingController();
  showDialog<void>(context: context, builder: (d) => TextField(controller: c)).then((_) => c.dispose());
}
Future<void> pick(BuildContext context) async {
  final f = FocusNode();
  await showDatePicker(context: context, firstDate: a, lastDate: b);
  f.dispose();
}
EOF
sed 's/^/  | /' app/lib/zz_probe.dart; echo "  findings:"; lits dispose-after-dialog app/lib/zz_probe.dart

echo; echo "== 6. auth-navigation-only-in-router: goNamed, Navigator.pushNamed, a const path"
cat > app/lib/zz_probe.dart <<'EOF'
void a(BuildContext context) => context.goNamed('login');
void b(BuildContext context) => Navigator.pushNamed(context, '/login');
const _p = '/welcome';
void c(BuildContext context) => context.go(_p);
EOF
sed 's/^/  | /' app/lib/zz_probe.dart; echo "  findings:"; lits auth-navigation-only-in-router app/lib/zz_probe.dart

echo; echo "== Extra shapes from this job's own adversarial review"
cat > app/lib/zz_probe.dart <<'EOF2'
enum Cat { fruit('Obst'); const Cat(this.label); final String label; }
Widget chip(Cat c) => Text(c.label);
Widget saved(bool ok) { String msg; if (ok) { msg = 'Gespeichert'; } else { msg = l10n.error; } return Text(msg); }
class Btn extends StatelessWidget { const Btn({this.caption = 'Speichern'}); final String caption; Widget build(BuildContext c) => Text(caption); }
sealed class LoadState { @override String toString() => 'LoadState'; }
Widget count(int n) => Text(n.toString());
EOF2
sed 's/^/  | /' app/lib/zz_probe.dart; echo "  findings (LoadState must not be one):"; lits no-hardcoded-ui-text app/lib/zz_probe.dart
cat > app/lib/zz_probe.dart <<'EOF2'
void open(BuildContext context) {
  final c = TextEditingController();
  showModalBottomSheet<void>(context: context, builder: (_) => TextField(controller: c)).whenComplete(c.dispose);
}
EOF2
sed 's/^/  | /' app/lib/zz_probe.dart; echo "  findings:"; lits dispose-after-dialog app/lib/zz_probe.dart
rm app/lib/zz_probe.dart

probe=supabase/migrations/20990101000000_probe.sql
schema() { deno run -q --allow-read --allow-run=git,squawk supabase/checks/schema_check.ts origin/main 2>&1 | sed 's/^/  /'; echo "  exit ${PIPESTATUS[0]}"; }
echo; echo "== 2. schema_check: a correct quoted table, and a quoted table missing its policy"
cat > $probe <<'EOF'
create table "public"."items2" (id uuid primary key, household_id uuid not null);
alter table "public"."items2" enable row level security;
create policy items2_member on "public"."items2" for select to authenticated
  using (public.is_household_member(household_id));
create table if not exists "public"."x" (id uuid);
alter table "public"."x" enable row level security;
alter table "public"."x" add column household_id uuid;
EOF
sed 's/^/  | /' $probe; schema

echo; echo "== 8. schema_check: a rename is reported against the migration that renames"
echo 'alter table public.items rename to items_v2;' > $probe; sed 's/^/  | /' $probe; schema

echo; echo "== 7. lint.sh: the schema check's message comes before the unit tests"
echo 'create table public.probe (id uuid, household_id uuid);' > $probe; sed 's/^/  | /' $probe
scripts/lint.sh 2>&1 | grep -E '^\S*\[lint\]|public\.probe|FAILED|passed' | cut -c1-160 | sed 's/^/  /'
rm $probe
