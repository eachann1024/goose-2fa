"""Publish CHANGELOG.md on main as the public update-notice feed."""
import argparse
import base64
import concurrent.futures
import datetime
import hashlib
import json
import os
import random
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

FEED = 'public/update-notices.json'
CHANGELOG = 'CHANGELOG.md'
VERSION = r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)'
VERSIONED = re.compile(
    rf'^## (?P<date>\d{{4}}-\d{{2}}-\d{{2}}) \u00b7 v(?P<version>{VERSION})\s*$', re.M)
DATED = re.compile(r'^## (?P<date>\d{4}-\d{2}-\d{2})(?:\s|$)', re.M)
HEADING = re.compile(r'^#{1,6}\s+\S', re.M)
ITEM = re.compile(r'^\s*(?:[-*•]|\d+\.)\s+\S', re.M)
HAN = re.compile(r'[\u4e00-\u9fff]')


class RetryableError(RuntimeError):
    """Transient error eligible for jittered retry (429, 5xx, or timeout)."""
VERSION_FILES = ('package.json', 'plugin.json', 'utools/plugin.json')
API = 'https://api.deepseek.com/chat/completions'
LIMIT = 512 * 1024
SYSTEM = (
    'You translate Markdown into Simplified Chinese and return only the translated Markdown. '
    'Do not add a commentary, a preamble, or a wrapping code fence. Keep the format exactly: '
    'heading marks, list marks, emoji, blank lines, line breaks, links, and code spans stay in place. '
    'Do not change version numbers, dates, URLs, or inline code. Text already in Simplified Chinese stays as it is.'
)


def redact(text):
    value = str(text)
    for name in ('DEEPSEEK_API_KEY', 'GH_TOKEN', 'GITHUB_TOKEN'):
        secret = os.environ.get(name, '')
        if secret:
            value = value.replace(secret, '[REDACTED]')
    return value


def real_date(value):
    try:
        return datetime.date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False

def version_tuple(value):
    return tuple(int(part) for part in value.split('.'))


def structure(text):
    return len(HEADING.findall(text)), len(ITEM.findall(text))


def fallback_version():
    for path in VERSION_FILES:
        try:
            version = json.loads(Path(path).read_text(encoding='utf-8')).get('version', '')
        except (OSError, json.JSONDecodeError):
            continue
        if re.fullmatch(VERSION, version):
            return version
    return None


def feed_identity(markdown):
    best = None
    for match in VERSIONED.finditer(markdown):
        if not real_date(match['date']):
            continue
        rank = (version_tuple(match['version']), match['date'])
        if best is None or rank > best[0]:
            best = (rank, match['version'], match['date'])
    if best:
        return best[1], best[2]
    version = fallback_version()
    dates = [match['date'] for match in DATED.finditer(markdown) if real_date(match['date'])]
    if not version or not dates:
        raise ValueError('CHANGELOG.md has no versioned heading and no usable version or date')
    return version, max(dates)


def unwrap(text):
    body = text.replace('\r\n', '\n').replace('\r', '\n')
    fenced = re.fullmatch(r'\s*```(?:markdown|md)?[^\n]*\n(.*)\n```\s*', body, re.S)
    return fenced.group(1) if fenced else body


ATX_HEADING = re.compile(r'^[ ]{0,3}(#{1,6})(?:[ \t]|$)')


def line_kind(line):
    if not line.strip():
        return 'blank'
    match = ATX_HEADING.match(line)
    if match:
        return f'heading:{len(match.group(1))}'
    return 'list' if ITEM.match(line) else 'text'


def ensure_structure(source, translated):
    expected, actual = structure(source), structure(translated)
    left, right = source.splitlines(), translated.splitlines()
    if expected != actual or len(left) != len(right):
        raise ValueError(
            f'Translation line structure mismatch: headings {actual[0]}/{expected[0]}, '
            f'list items {actual[1]}/{expected[1]}, lines {len(right)}/{len(left)}')
    for index, pair in enumerate(zip(left, right), 1):
        kinds = (line_kind(pair[0]), line_kind(pair[1]))
        if kinds[0] != kinds[1] or (kinds[0] == 'blank' and pair[0] != pair[1]):
            raise ValueError(
                f'Translation line structure mismatch at line {index}: '
                f'expected {kinds[0]}, got {kinds[1]}')
    return translated


def peel(text):
    lines = text.splitlines(keepends=True)
    start, end = 0, len(lines)
    while start < end and not lines[start].strip():
        start += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    return ''.join(lines[:start]), ''.join(lines[start:end]), ''.join(lines[end:])


def restore(section, translated):
    prefix, core, suffix = peel(section)
    body = peel(unwrap(translated))[1]
    if core.endswith('\n') and not body.endswith('\n'):
        body += '\n'
    elif body.endswith('\n') and not core.endswith('\n'):
        body = body[:-1]
    return ensure_structure(section, prefix + body + suffix)


def split_sections(markdown):
    return [part for part in re.split(r'(?=^## )', markdown, flags=re.M) if part]


def section_key(section, index):
    core = peel(section)[1]
    if not core:
        return ''
    raw_first = core.splitlines()[0]
    match = VERSIONED.match(raw_first)
    if match:
        return f'v:{match["version"]}'
    dated = DATED.match(raw_first)
    if dated:
        return f'd:{dated["date"]}'
    if index == 0 and re.match(r'^[ ]{0,3}#[ \t]+\S', raw_first):
        return 'preamble'
    return ''


def section_hash(core):
    return hashlib.sha256(core.encode('utf-8')).hexdigest()


def compute_section_hashes(markdown):
    sections = split_sections(markdown)
    keys = [section_key(section, index) for index, section in enumerate(sections)]
    counts = {}
    for key in keys:
        if key:
            counts[key] = counts.get(key, 0) + 1
    hashes = {}
    for key, section in zip(keys, sections):
        if key and counts.get(key) == 1:
            core = peel(section)[1]
            if core:
                hashes[key] = section_hash(core)
    return hashes


def parse_cached_sections(cached_feed):
    if not cached_feed:
        return {}, {}
    try:
        saved = json.loads(cached_feed)
    except (json.JSONDecodeError, TypeError):
        return {}, {}
    if not isinstance(saved, dict) or saved.get('schema') != 1 or not isinstance(saved.get('markdown'), str):
        return {}, {}
    saved_sections = split_sections(saved['markdown'])
    keys = [section_key(sec, index) for index, sec in enumerate(saved_sections)]
    counts = {}
    for key in keys:
        if key:
            counts[key] = counts.get(key, 0) + 1
    by_key = {}
    for key, sec in zip(keys, saved_sections):
        if key and counts.get(key) == 1:
            by_key[key] = sec
    raw_hashes = saved.get('section_hashes')
    saved_hashes = raw_hashes if isinstance(raw_hashes, dict) else {}
    return by_key, saved_hashes


def reusable_translation(section, key, cached_by_key, saved_hashes):
    if not key or key not in cached_by_key:
        return None
    core = peel(section)[1]
    if not core:
        return None
    cached_sec = cached_by_key[key]
    cached_core = peel(cached_sec)[1]
    if not cached_core or not HAN.search(cached_core):
        return None
    source_unchanged = saved_hashes.get(key) == section_hash(core) or cached_core == core
    if not source_unchanged:
        return None
    try:
        return restore(section, cached_core)
    except ValueError:
        return None


def is_timeout_error(error):
    if isinstance(error, (TimeoutError, socket.timeout)):
        return True
    if isinstance(error, urllib.error.URLError):
        return is_timeout_error(error.reason) or 'timed out' in str(error.reason).lower()
    return False


def request_translation(key, markdown):
    payload = json.dumps({
        'model': 'deepseek-chat', 'temperature': 0, 'max_tokens': 8192,
        'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': markdown}],
    }).encode()
    request = urllib.request.Request(API, data=payload, method='POST', headers={
        'Authorization': f'Bearer {key}', 'Content-Type': 'application/json',
        'User-Agent': 'goose-2fa-notice-feed'})
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read().decode()
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', 'replace')[:300]
        message = f'DeepSeek API returned HTTP {error.code}: {detail}'
        if error.code == 429 or 500 <= error.code < 600:
            raise RetryableError(message) from None
        raise RuntimeError(message) from None
    except (TimeoutError, socket.timeout) as error:
        raise RetryableError(f'DeepSeek API request timed out: {error}') from None
    except urllib.error.URLError as error:
        message = f'DeepSeek API request failed: {error.reason}'
        if is_timeout_error(error):
            raise RetryableError(message) from None
        raise RuntimeError(message) from None
    try:
        choice = json.loads(raw)['choices'][0]
        content, reason = choice['message']['content'], choice.get('finish_reason')
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise RuntimeError(f'DeepSeek API returned an unexpected response: {error}') from None
    if reason != 'stop':
        shown = reason if isinstance(reason, str) and reason else 'missing'
        raise RuntimeError(f'DeepSeek translation stopped early: finish_reason={shown}')
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError('DeepSeek API returned empty translation')
    return content


def translate(markdown, mock, cached_feed=None):
    sections = split_sections(markdown)
    if not sections:
        raise ValueError('CHANGELOG.md is empty')
    cached_by_key, saved_hashes = parse_cached_sections(cached_feed)
    keys = [section_key(section, index) for index, section in enumerate(sections)]
    key_counts = {}
    for key_name in keys:
        if key_name:
            key_counts[key_name] = key_counts.get(key_name, 0) + 1
    reused = {}
    for index, (section, key_name) in enumerate(zip(sections, keys)):
        if key_name and key_counts.get(key_name) == 1:
            cached = reusable_translation(section, key_name, cached_by_key, saved_hashes)
            if cached is not None:
                reused[index] = cached
    needs_api = not mock and any(
        index not in reused and peel(section)[1]
        for index, section in enumerate(sections)
    )
    key = '' if not needs_api else os.environ.get('DEEPSEEK_API_KEY', '').strip()
    if needs_api and not key:
        raise RuntimeError('DEEPSEEK_API_KEY is not set')
    total = len(sections)

    def translate_section(index, section):
        if index - 1 in reused:
            return reused[index - 1]
        core = peel(section)[1]
        if mock or not core:
            return restore(section, core) if core else section
        last = None
        for attempt in range(4):
            try:
                return restore(section, request_translation(key, core))
            except (RetryableError, ValueError) as error:
                last = error
                if attempt == 3:
                    raise RuntimeError(
                        f'CHANGELOG section {index}/{total}: failed after 3 retries: {redact(last)}') from None
                time.sleep((2 ** attempt) * random.uniform(0.5, 1.5))
            except Exception as error:
                raise RuntimeError(
                    f'CHANGELOG section {index}/{total}: {redact(error)}') from None

    if mock or total <= 1:
        pieces = [translate_section(index, section) for index, section in enumerate(sections, 1)]
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(8, total)) as pool:
            futures = [pool.submit(translate_section, index, section) for index, section in enumerate(sections, 1)]
            pieces = [future.result() for future in futures]
    return ensure_structure(markdown, ''.join(pieces))

def render(version, date, markdown, section_hashes=None):
    payload = {'schema': 1, 'version': version, 'date': date, 'markdown': markdown}
    if section_hashes is not None:
        payload['section_hashes'] = section_hashes
    content = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    if len(content.encode()) > LIMIT:
        raise ValueError('The public update feed exceeds its size limit')
    return content


def decide(content, previous):
    if previous == content:
        return 'unchanged'
    try:
        saved = json.loads(previous) if previous else {}
    except json.JSONDecodeError:
        saved = {}
    saved_version = saved.get('version', '')
    new_version = json.loads(content)['version']
    if (saved.get('schema') == 1 and re.fullmatch(VERSION, str(saved_version))
            and version_tuple(saved_version) > version_tuple(new_version)):
        return 'keep'
    return 'publish'


def api(repo, path, payload=None):
    command = ['gh', 'api', f'repos/{repo}/{path}']
    if payload is not None:
        command += ['--method', 'PUT', '--input', '-']
    result = subprocess.run(
        command, input=json.dumps(payload) if payload else None,
        text=True, capture_output=True)
    if result.returncode:
        detail = redact(result.stderr.strip())
        if '(HTTP 404)' in result.stderr and payload is None:
            return None
        raise RuntimeError(f'GitHub API request failed: {path.split("?")[0]}: {detail}')
    return json.loads(result.stdout)


def published_text(repo):
    current = api(repo, f'contents/{FEED}?ref=main')
    if not current:
        return None
    if current.get('encoding') != 'base64':
        raise RuntimeError('The published update feed is not readable')
    return base64.b64decode(current['content']).decode('utf-8'), current.get('sha')


def publish(repo, content, version, loaded=None):
    if not os.environ.get('GH_TOKEN', '').strip():
        raise RuntimeError('GH_TOKEN is not set')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
        raise ValueError('Invalid repository')
    if loaded is None:
        loaded = published_text(repo)
    previous, sha = loaded if loaded else (None, None)
    action = decide(content, previous)
    if action != 'publish':
        print('Published update feed is already current.' if action == 'unchanged'
              else 'Latest changelog version moved backwards; keep the published feed intact.')
        return
    payload = {'message': f'chore: sync published update notices for v{version}', 'branch': 'main',
               'content': base64.b64encode(content.encode()).decode()}
    if sha:
        payload['sha'] = sha
    api(repo, f'contents/{FEED}', payload)
    print(f'Published update feed now follows v{version}.')


def shape(content, action):
    feed = json.loads(content)
    headings, items = structure(feed['markdown'])
    print(json.dumps({'decision': action, 'schema': feed['schema'], 'version': feed['version'],
                      'date': feed['date'], 'bytes': len(content.encode()), 'headings': headings,
                      'list_items': items}, ensure_ascii=False, indent=2))


def parse_args():
    parser = argparse.ArgumentParser(description='Publish the changelog update-notice feed')
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--mock-translation', action='store_true')
    return parser.parse_args()


def main():
    args = parse_args()
    if args.mock_translation and not args.dry_run:
        raise RuntimeError('mock translation cannot publish; pass --dry-run')
    markdown = Path(CHANGELOG).read_text(encoding='utf-8')
    version, date = feed_identity(markdown)
    if args.dry_run:
        previous = Path(FEED).read_text(encoding='utf-8') if Path(FEED).is_file() else None
        loaded = None
    else:
        repo = os.environ.get('GH_REPO', '').strip()
        if not repo:
            raise RuntimeError('GH_REPO is not set')
        if not os.environ.get('GH_TOKEN', '').strip():
            raise RuntimeError('GH_TOKEN is not set')
        if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
            raise ValueError('Invalid repository')
        loaded = published_text(repo)
        previous = loaded[0] if loaded else (Path(FEED).read_text(encoding='utf-8') if Path(FEED).is_file() else None)
    translated = translate(markdown, args.mock_translation, cached_feed=previous)
    if Path(CHANGELOG).read_text(encoding='utf-8') != markdown:
        raise RuntimeError('CHANGELOG.md changed while preparing the feed; retry')
    content = render(version, date, translated, section_hashes=compute_section_hashes(markdown))
    if args.dry_run:
        shape(content, decide(content, previous))
        return
    publish(repo, content, version, loaded=loaded)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(redact(error), file=sys.stderr)
        raise SystemExit(1) from None
