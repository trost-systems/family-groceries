#!/usr/bin/env python3
"""Deterministic mutation testing for the Flutter app (job 128, hc-domain-tests; adapted from job 98's hc-tests mutator).

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
MUTANTS = os.environ.get('HC128_MUTANTS', os.path.join(HERE, 'mutants.tsv'))
EQUIVALENT = os.environ.get('HC128_EQUIVALENT', os.path.join(HERE, 'equivalent.tsv'))
HOLDOUT = os.path.join(HERE, 'holdout.tsv')
HOLDOUT_SEED = 1280
HOLDOUT_SAMPLE = 100
SEED = 128
SAMPLE = 140
TIMEOUT_S = 180
# A run past TIMEOUT_S is retried once with this much: on a loaded box a slow run is not a kill.
RETRY_TIMEOUT_S = 900

TARGETS = [
    'lib/list/list_cubit.dart',
    'lib/list/list_repository.dart',
    'lib/list/list_cache.dart',
    'lib/list/model.dart',
    'lib/list/entry.dart',
    'lib/list/add_sheet/suggestion.dart',
    'lib/list/add_sheet/add_sheet_cubit.dart',
    'lib/list/category_names.dart',
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


def generate(path=MUTANTS, seed=SEED, sample=SAMPLE, exclude=()):
    every = [s for rel in TARGETS for s in sites(rel)]
    every.sort(key=lambda s: (s['file'], s['offset'], s['old']))
    rows = []
    for s in every:
        src = open(os.path.join(APP, s['file']), encoding='utf-8').read()
        s['text'], s['nth'], s['col'] = anchor(src, s['offset'])
        if (s['file'], s['text'], s['nth'], s['col'], s['old']) not in exclude:
            rows.append(s)
    picked = sorted(random.Random(seed).sample(rows, sample),
                    key=lambda s: (s['file'], s['offset']))
    with open(path, 'w', encoding='utf-8') as out:
        out.write(f'# seed={seed} sample={sample} of {len(rows)} sites; '
                  'generated by mutate.py generate\n')
        out.write('id\tfile\tline\tnth\tcol\told\tnew\tsource line\n')
        for k, s in enumerate(picked, 1):
            out.write(f"m{k:03d}\t{s['file']}\t{s['line']}\t{s['nth']}\t{s['col']}\t{s['old']!r}\t"
                      f"{s['new']!r}\t{s['text']}\n")
    print(f'{len(picked)} of {len(rows)} sites -> {path}', file=sys.stderr)


def generate_holdout():
    """A second sample from the sites mutants.tsv does not hold: no test was written against it."""
    taken = {(m['file'], m['text'], m['nth'], m['col'], m['old']) for m in load_mutants()}
    generate(HOLDOUT, HOLDOUT_SEED, HOLDOUT_SAMPLE, taken)


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
    """Test files that import rel, and the list feature's tests (test/list/) whose imports reach
    it through other files (a cubit is tested through its screen). Own test first, then direct
    importers, then the rest. Every file reaches everything through the router, so the closure
    alone would run nearly the whole suite per mutant."""
    pkg = 'package:family_groceries/'
    files = []
    for top in ('lib', 'test'):
        for root, _, names in os.walk(os.path.join(app, top)):
            files += [os.path.relpath(os.path.join(root, f), app) for f in names
                      if f.endswith('.dart')]
    graph = {}
    for p in files:
        src = open(os.path.join(app, p), encoding='utf-8').read()
        deps = set()
        for u in re.findall(r"^(?:import|export|part) '([^']+)'", src, re.M):
            if u.startswith(pkg):
                deps.add('lib/' + u[len(pkg):])
            elif not u.startswith(('package:', 'dart:')):
                deps.add(os.path.normpath(os.path.join(os.path.dirname(p), u)))
        graph[p] = deps

    def reaches(p):
        seen, todo = set(), [p]
        while todo:
            q = todo.pop()
            for d in graph.get(q, ()):
                if d == rel:
                    return True
                if d not in seen:
                    seen.add(d)
                    todo.append(d)
        return False

    helpers = {p for p in files if p.startswith('test/') and not p.endswith('_test.dart') and
               rel in graph[p]}

    def direct(p):
        return rel in graph[p] or bool(graph[p] & helpers)

    tests = sorted(p for p in files if p.endswith('_test.dart') and
                   (direct(p) or (p.startswith('test/list/') and reaches(p))))
    own = 'test/' + rel[len('lib/'):].replace('.dart', '_test.dart')
    tests.sort(key=lambda t: (t != own, not direct(t), t))
    return tests


def failures(app, files, fail_fast, timeout=TIMEOUT_S):
    """(failed (file, test name) pairs, all output) of one `flutter test` run, or None on timeout."""
    # Its own process group: on a timeout the flutter_tester children go too. Left running, a
    # hung mutant's tester kept growing (4 GB) and mem-guard paused the job.
    p = subprocess.Popen(['flutter', 'test', '--no-pub', '--reporter=json',
                          *(['--fail-fast'] if fail_fast else []), *files],
                         cwd=app, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                         start_new_session=True)
    try:
        stdout, stderr = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(p.pid, signal.SIGKILL)
        p.communicate()
        return None
    finally:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
    r = subprocess.CompletedProcess(p.args, p.returncode, stdout, stderr)
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
    """'killed', 'survived', 'invalid' (does not compile) or 'timeout' (counted as killed: the
    run passed TIMEOUT_S and then RETRY_TIMEOUT_S).

    Only a failure the unmutated tree does not have ([known]) kills: tests that fail on this
    box anyway (the wide goldens) must not.
    """
    fail_fast = not any(f == path for f in files for path, _ in known)
    result = failures(app, files, fail_fast)
    if result is None:
        result = failures(app, files, fail_fast, RETRY_TIMEOUT_S)
    if result is None:
        return 'timeout'
    failed, out = result
    if re.search(re.escape(os.path.basename(mutated)) + r':\d+:\d+: Error:', out):
        return 'invalid'
    return 'killed' if failed - known else 'survived'


def run(app):
    mutants = load_mutants()
    if os.environ.get('HC128_ONLY'):  # a recheck of single mutants, never the score
        mutants = [m for m in mutants if m['id'] in os.environ['HC128_ONLY'].split(',')]
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
        print(f"{m['id']} {status} {m['file']}:{m['line']} {m['old']!r}->{m['new']!r}",
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
        'unmutated_failures': len(known), 'mutant_list_sha': digest, 'seed': SEED, 'mutation_seconds': round(time.monotonic() - t0),
    }))


if __name__ == '__main__':
    if sys.argv[1:] == ['generate']:
        generate()
    elif sys.argv[1:] == ['generate-holdout']:
        generate_holdout()
    elif len(sys.argv) == 3 and sys.argv[1] == 'run':
        run(os.path.abspath(sys.argv[2]))
    else:
        sys.exit(__doc__)
