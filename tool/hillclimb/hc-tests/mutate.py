#!/usr/bin/env python3
"""Deterministic mutation testing for the Flutter app (job 98, hc-tests).

  mutate.py generate   writes mutants.tsv: every site in TARGETS, sampled with SEED to SAMPLE
  mutate.py run DIR    applies each mutant of mutants.tsv in DIR (app/ of a repository copy),
                       runs the test files that import the mutated file, prints one JSON line

Sites are found on code only (strings and comments are skipped). dart format puts spaces
around binary operators, so ' < ' is a comparison and never a type argument.
"""
import hashlib
import json
import os
import random
import re
import signal
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'app'))
MUTANTS = os.path.join(HERE, 'mutants.tsv')
EQUIVALENT = os.path.join(HERE, 'equivalent.tsv')
SEED = 98
SAMPLE = 150
TIMEOUT_S = 180

TARGETS = [
    'lib/list/model.dart',
    'lib/list/entry.dart',
    'lib/list/quantity.dart',
    'lib/list/list_cache.dart',
    'lib/list/list_cubit.dart',
    'lib/list/list_repository.dart',
    'lib/feedback/feedback_repository.dart',
    'lib/settings/access_repository.dart',
    'lib/settings/account_repository.dart',
    'lib/household/invite_repository.dart',
    'lib/purchases/purchase_repository.dart',
]

# (pattern on code text, replacement); patterns are literal unless they start with 're:'.
OPERATORS = [
    (' == ', ' != '), (' != ', ' == '),
    (' < ', ' <= '), (' <= ', ' < '), (' > ', ' >= '), (' >= ', ' > '),
    (' && ', ' || '), (' || ', ' && '),
    (' + ', ' - '), (' - ', ' + '),
    ('re:\\btrue\\b', 'false'), ('re:\\bfalse\\b', 'true'),
    ('.isEmpty', '.isNotEmpty'), ('.isNotEmpty', '.isEmpty'),
    ('re:(?<![\\w)\\]!])!(?=[\\w(])', ''),
]


def code_mask(src):
    """True for each char of src that is code (not inside a string or comment)."""
    mask = [True] * len(src)
    i, n = 0, len(src)
    stack = []  # string contexts: (quote, raw); '{' entries for ${...} interpolation
    while i < n:
        if stack and stack[-1] != '{':
            quote, raw = stack[-1]
            if src.startswith(quote, i):
                for k in range(i, i + len(quote)):
                    mask[k] = False
                i += len(quote)
                stack.pop()
                continue
            if not raw and src[i] == '\\':
                mask[i] = False
                if i + 1 < n:
                    mask[i + 1] = False
                i += 2
                continue
            if not raw and src.startswith('${', i):
                mask[i] = mask[i + 1] = False
                stack.append('{')
                i += 2
                continue
            mask[i] = False
            i += 1
            continue
        # code (top level or inside ${...})
        if src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            for k in range(i, j):
                mask[k] = False
            i = j
            continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            for k in range(i, j):
                mask[k] = False
            i = j
            continue
        if stack and src[i] == '{':
            stack.append('{')
        elif stack and src[i] == '}':
            stack.pop()
            if stack and stack[-1] != '{':
                mask[i] = False
                i += 1
                continue
        m = re.match(r"(r?)('''|\"\"\"|'|\")", src[i:i + 4])
        if m and (m.group(1) == '' or i == 0 or not (src[i - 1].isalnum() or src[i - 1] == '_')):
            start = i
            i += len(m.group(0))
            for k in range(start, i):
                mask[k] = False
            stack.append((m.group(2), m.group(1) == 'r'))
            continue
        i += 1
    return mask


def sites(rel):
    src = open(os.path.join(APP, rel), encoding='utf-8').read()
    mask = code_mask(src)
    lines = src.split('\n')
    starts = [0]
    for line in lines:
        starts.append(starts[-1] + len(line) + 1)
    found = []
    for pat, rep in OPERATORS:
        if pat.startswith('re:'):
            matches = [(m.start(), m.end()) for m in re.finditer(pat[3:], src)]
        else:
            matches = [(m.start(), m.start() + len(pat)) for m in re.finditer(re.escape(pat), src)]
        for a, b in matches:
            if not all(mask[a:b]) and not (pat.startswith(' ') and all(mask[a + 1:b - 1])):
                continue
            line_no = next(k for k in range(len(lines)) if starts[k + 1] > a)
            text = lines[line_no].strip()
            if text.startswith(('import ', 'export ', 'part ', 'assert(')) or 'assert(' in text:
                continue
            found.append({'file': rel, 'offset': a, 'line': line_no + 1, 'old': src[a:b],
                          'new': rep, 'text': text})
    return found


def anchor(src, offset):
    """(line text, which identical line, column in it) of [offset]: survives edits elsewhere."""
    lines = src.split('\n')
    start = 0
    for k, line in enumerate(lines):
        if start + len(line) >= offset:
            text = line.strip()
            nth = sum(1 for earlier in lines[:k] if earlier.strip() == text)
            return text, nth, offset - start - (len(line) - len(line.lstrip()))
        start += len(line) + 1
    raise ValueError(offset)


def resolve(src, m):
    """The mutant's offset in [src], or None when its line is gone or no longer holds it."""
    start, seen = 0, 0
    for line in src.split('\n'):
        if line.strip() == m['text']:
            if seen == m['nth']:
                a = start + len(line) - len(line.lstrip()) + m['col']
                return a if src[a:a + len(m['old'])] == m['old'] else None
            seen += 1
        start += len(line) + 1
    return None


def generate():
    every = [s for rel in TARGETS for s in sites(rel)]
    every.sort(key=lambda s: (s['file'], s['offset'], s['old']))
    picked = sorted(random.Random(SEED).sample(every, SAMPLE),
                    key=lambda s: (s['file'], s['offset']))
    with open(MUTANTS, 'w', encoding='utf-8') as out:
        out.write(f'# seed={SEED} sample={SAMPLE} of {len(every)} sites; '
                  'generated by mutate.py generate\n')
        out.write('id\tfile\tline\tnth\tcol\told\tnew\tsource line\n')
        for k, s in enumerate(picked, 1):
            src = open(os.path.join(APP, s['file']), encoding='utf-8').read()
            text, nth, col = anchor(src, s['offset'])
            out.write(f"m{k:03d}\t{s['file']}\t{s['line']}\t{nth}\t{col}\t{s['old']!r}\t"
                      f"{s['new']!r}\t{text}\n")
    print(f'{len(picked)} of {len(every)} sites -> {MUTANTS}', file=sys.stderr)


def load_mutants():
    """Each mutant is anchored by its file, its line's text (and which of identical lines),
    and its column there, so edits elsewhere in the file do not move it."""
    rows = []
    for line in open(MUTANTS, encoding='utf-8'):
        if line.startswith(('#', 'id\t')):
            continue
        mid, rel, line_no, nth, col, old, new, text = line.rstrip('\n').split('\t', 7)
        rows.append({'id': mid, 'file': rel, 'line': int(line_no), 'nth': int(nth),
                     'col': int(col), 'old': eval(old), 'new': eval(new), 'text': text})
    return rows


def load_equivalent():
    if not os.path.exists(EQUIVALENT):
        return {}
    out = {}
    for line in open(EQUIVALENT, encoding='utf-8'):
        if line.startswith(('#', 'id\t')) or not line.strip():
            continue
        mid, reason = line.rstrip('\n').split('\t', 1)
        out[mid] = reason
    return out


def importers(app, rel):
    """Test files that import rel directly or through a test helper, own test first."""
    lib_uri = 'package:family_groceries/' + rel[len('lib/'):]
    base = os.path.basename(rel)
    tests, helpers = [], []
    for root, _, files in os.walk(os.path.join(app, 'test')):
        for f in sorted(files):
            if f.endswith('.dart'):
                p = os.path.relpath(os.path.join(root, f), app)
                (tests if f.endswith('_test.dart') else helpers).append(p)

    def imports(p):
        src = open(os.path.join(app, p), encoding='utf-8').read()
        return re.findall(r"^(?:import|export) '([^']+)'", src, re.M)

    def direct(p):
        for u in imports(p):
            if u == lib_uri or (not u.startswith('package:') and os.path.basename(u) == base and
                                os.path.normpath(os.path.join(os.path.dirname(p), u)) == rel):
                return True
        return False

    helper_hits = {h for h in helpers if direct(h)}
    chosen = []
    for t in sorted(tests):
        if direct(t):
            chosen.append(t)
            continue
        for u in imports(t):
            if not u.startswith('package:'):
                if os.path.normpath(os.path.join(os.path.dirname(t), u)) in helper_hits:
                    chosen.append(t)
                    break
    own = 'test/' + rel[len('lib/'):].replace('.dart', '_test.dart')
    chosen.sort(key=lambda t: (t != own, t))
    return chosen


def failures(app, files, fail_fast, timeout=TIMEOUT_S):
    """(failed (file, test name) pairs, all output) of one `flutter test` run, or None on timeout."""
    # Its own process group: on a timeout the hung flutter_tester processes die with it
    # instead of loading the host for the mutants after it.
    with subprocess.Popen(['flutter', 'test', '--no-pub', '--reporter=json',
                           *(['--fail-fast'] if fail_fast else []), *files],
                          cwd=app, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                          start_new_session=True) as proc:
        try:
            stdout, stderr = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
            proc.communicate()
            return None
    r = subprocess.CompletedProcess(proc.args, proc.returncode, stdout, stderr)
    suites, tests, failed = {}, {}, set()
    for line in r.stdout.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        kind = e.get('type')
        if kind == 'suite':
            suites[e['suite']['id']] = os.path.relpath(e['suite']['path'], app)
        elif kind == 'testStart':
            tests[e['test']['id']] = (e['test']['suiteID'], e['test']['name'])
        elif kind == 'testDone' and e['result'] != 'success':
            suite, name = tests[e['testID']]
            failed.add((suites.get(suite, '?'), name))
    if r.returncode != 0 and not failed:
        failed.add(('?', 'the run failed'))
    return failed, r.stdout + r.stderr


def flutter_test(app, files, mutated, known):
    """'killed', 'survived', 'invalid' (does not compile) or 'timeout' (counted as killed).

    Only a failure the unmutated tree does not have ([known]) kills: tests that fail on this
    box anyway (the wide goldens) must not. A run past TIMEOUT_S gets one more try with twice
    the time, so a slow, loaded host does not pass for a kill; only a mutant that hangs twice
    is a 'timeout'.
    """
    fail_fast = not any(f == path for f in files for path, _ in known)
    result = failures(app, files, fail_fast)
    if result is None:
        print(f'  {mutated}: {len(files)} files past {TIMEOUT_S} s, trying once more',
              file=sys.stderr, flush=True)
        result = failures(app, files, fail_fast, timeout=2 * TIMEOUT_S)
    if result is None:
        return 'timeout'
    failed, out = result
    if re.search(re.escape(os.path.basename(mutated)) + r':\d+:\d+: Error:', out):
        return 'invalid'
    return 'killed' if failed - known else 'survived'


def run(app):
    mutants = load_mutants()
    equivalent = load_equivalent()
    results = {}
    t0 = time.monotonic()
    # A mutant whose line changed is not this list any more: stop rather than shrink the score.
    stale = [m['id'] for m in mutants
             if resolve(open(os.path.join(app, m['file']), encoding='utf-8').read(), m) is None]
    if stale:
        sys.exit(f'{len(stale)} mutants no longer match the source ({", ".join(stale)}); '
                 'regenerate mutants.tsv (mutate.py generate) and take a new baseline')
    cache = {f: importers(app, f) for f in sorted({m['file'] for m in mutants})}
    every = sorted({t for tests in cache.values() for t in tests})
    known, _ = failures(app, every, fail_fast=False, timeout=1800)
    print(f'unmutated failures: {sorted(known)}', file=sys.stderr, flush=True)
    if any(name.startswith('loading ') for _, name in known):
        sys.exit(f'a test file does not load in {app}; is the repository around it complete?')
    for m in mutants:
        path = os.path.join(app, m['file'])
        original = open(path, encoding='utf-8').read()
        a = resolve(original, m)
        tests = cache[m['file']]
        started = time.monotonic()
        try:
            open(path, 'w', encoding='utf-8').write(original[:a] + m['new'] +
                                                    original[a + len(m['old']):])
            status = 'no-tests' if not tests else 'survived'
            # Own test first: most mutants die there, the rest get every importer.
            if tests:
                status = flutter_test(app, tests[:1], m['file'], known)
                if status == 'survived' and len(tests) > 1:
                    status = flutter_test(app, tests[1:], m['file'], known)
        finally:
            open(path, 'w', encoding='utf-8').write(original)
        if status in ('survived', 'no-tests') and m['id'] in equivalent:
            status = 'equivalent'
        results[m['id']] = status
        print(f"{m['id']} {status} {m['file']}:{m['line']} {m['old']!r}->{m['new']!r} "
              f"{time.monotonic() - started:.0f}s",
              file=sys.stderr, flush=True)
    counts = {k: sum(1 for v in results.values() if v == k)
              for k in ('killed', 'timeout', 'survived', 'no-tests', 'invalid', 'equivalent')}
    killed = counts['killed'] + counts['timeout']
    denominator = len(mutants) - counts['equivalent'] - counts['invalid']
    digest = hashlib.sha256(open(MUTANTS, 'rb').read()).hexdigest()[:12]
    print(json.dumps({
        'mutants_total': len(mutants), 'killed': killed, 'survived': counts['survived'] +
        counts['no-tests'], 'equivalent': counts['equivalent'], 'invalid': counts['invalid'],
        'mutation_score': round(killed / denominator, 4),
        'survivors': sorted(k for k, v in results.items() if v in ('survived', 'no-tests')),
        'timeout': counts['timeout'], 'timeouts': sorted(k for k, v in results.items() if v == 'timeout'),
        'unmutated_failures': len(known), 'mutant_list_sha': digest, 'seed': SEED, 'mutation_seconds': round(time.monotonic() - t0),
    }))


if __name__ == '__main__':
    if sys.argv[1:] == ['generate']:
        generate()
    elif len(sys.argv) == 3 and sys.argv[1] == 'run':
        run(os.path.abspath(sys.argv[2]))
    else:
        sys.exit(__doc__)
