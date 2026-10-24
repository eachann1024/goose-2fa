"""Publish CHANGELOG.md on main as the public update-notice feed."""
import argparse
import base64
import datetime
import json
import os
import re
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
VERSION_FILES = ('package.json', 'plugin.json', 'utools/plugin.json')
API = 'https://api.deepseek.com/chat/completions'
LIMIT = 512 * 1024
SYSTEM = (
    'You translate Markdown into Simplified Chinese and return only the translated Markdown. '
    'Do not add a commentary, a preamble, or a wrapping code fence. '
    'Keep the format exactly: heading marks, list marks, emoji, blank lines, line breaks, '
    'links, and code spans stay in place. '
    'Do not change version numbers, dates, URLs, or inline code. '
    'Text that is already Simplified Chinese stays as it is.'
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
        file = Path(path)
        if not file.is_file():
            continue
        try:
            version = json.loads(file.read_text(encoding='utf-8')).get('version', '')
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
    if not version:
        raise ValueError('CHANGELOG.md has no versioned heading and no package or plugin version')
    if not dates:
        raise ValueError('CHANGELOG.md has no ## YYYY-MM-DD heading to date the update feed')
    return version, max(dates)


def unwrap(text):
    body = text.replace('\r\n', '\n').replace('\r', '\n').strip()
    fenced = re.fullmatch(r'```(?:markdown|md)?\s*\n(.*)\n```', body, re.S)
    if fenced:
        body = fenced.group(1).strip('\n')
    return body + '\n'


def ensure_structure(source, translated):
    expected, actual = structure(source), structure(translated)
    if expected != actual:
        raise ValueError(
            'Translation structure mismatch: '
            f'headings {actual[0]} (expected {expected[0]}), '
            f'list items {actual[1]} (expected {expected[1]})')
    return translated


def request_translation(key, markdown):
    payload = json.dumps({
        'model': 'deepseek-chat',
        'temperature': 0,
        'max_tokens': 8192,
        'messages': [
            {'role': 'system', 'content': SYSTEM},
            {'role': 'user', 'content': markdown},
        ],
    }).encode()
    request = urllib.request.Request(API, data=payload, method='POST', headers={
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
        'User-Agent': 'goose-2fa-notice-feed',
    })
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read().decode('utf-8')
    except urllib.error.HTTPError as error:
        detail = error.read().decode('utf-8', 'replace')[:300]
        raise RuntimeError(f'DeepSeek API returned HTTP {error.code}: {detail}') from None
    except urllib.error.URLError as error:
        raise RuntimeError(f'DeepSeek API request failed: {error.reason}') from None
    try:
        content = json.loads(raw)['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError, json.JSONDecodeError) as error:
        raise RuntimeError(f'DeepSeek API returned an unexpected response: {error}') from None
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError('DeepSeek API returned empty translation')
    return content


def translate(markdown, mock):
    if mock:
        return ensure_structure(markdown, unwrap(markdown))
    key = os.environ.get('DEEPSEEK_API_KEY', '').strip()
    if not key:
        raise RuntimeError('DEEPSEEK_API_KEY is not set')
    last = None
    for attempt in range(4):
        try:
            return ensure_structure(markdown, unwrap(request_translation(key, markdown)))
        except Exception as error:
            last = error
            if attempt == 3:
                break
            time.sleep(2 ** attempt)
    raise RuntimeError(f'DeepSeek translation failed after 3 retries: {redact(last)}') from None


def render(version, date, markdown):
    content = json.dumps(
        {'schema': 1, 'version': version, 'date': date, 'markdown': markdown},
        ensure_ascii=False, indent=2) + '\n'
    if len(content.encode()) > LIMIT:
        raise ValueError('The public update feed exceeds its size limit')
    return content


def decide(content, previous):
    if previous is None:
        return 'publish'
    if previous == content:
        return 'unchanged'
    try:
        saved = json.loads(previous)
    except json.JSONDecodeError:
        return 'publish'
    saved_version = saved.get('version', '')
    new_version = json.loads(content)['version']
    if (saved.get('schema') == 1 and re.fullmatch(VERSION, saved_version)
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


def publish(repo, content, version):
    if not os.environ.get('GH_TOKEN', '').strip():
        raise RuntimeError('GH_TOKEN is not set')
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', repo):
        raise ValueError('Invalid repository')
    loaded = published_text(repo)
    previous, sha = loaded if loaded else (None, None)
    action = decide(content, previous)
    if action == 'unchanged':
        print('Published update feed is already current.')
        return
    if action == 'keep':
        print('Latest changelog version moved backwards; keep the published feed intact.')
        return
    fresh = published_text(repo)
    fresh_sha = fresh[1] if fresh else None
    if fresh_sha != sha:
        raise RuntimeError('Published update feed changed while preparing it; retry')
    payload = {
        'message': f'chore: sync published update notices for v{version}',
        'branch': 'main',
        'content': base64.b64encode(content.encode()).decode(),
    }
    if fresh_sha:
        payload['sha'] = fresh_sha
    api(repo, f'contents/{FEED}', payload)
    print(f'Published update feed now follows v{version}.')


def shape(content, action):
    feed = json.loads(content)
    headings, items = structure(feed['markdown'])
    print(json.dumps({
        'decision': action,
        'schema': feed['schema'],
        'version': feed['version'],
        'date': feed['date'],
        'bytes': len(content.encode()),
        'headings': headings,
        'list_items': items,
    }, ensure_ascii=False, indent=2))


def parse_args():
    parser = argparse.ArgumentParser(description='Publish the changelog update-notice feed')
    parser.add_argument('--dry-run', action='store_true', help='print the feed shape without writing')
    parser.add_argument('--mock-translation', action='store_true',
                        help='skip DeepSeek; only valid with --dry-run')
    return parser.parse_args()


def main():
    args = parse_args()
    if args.mock_translation and not args.dry_run:
        raise RuntimeError('mock translation cannot publish; pass --dry-run')
    markdown = Path(CHANGELOG).read_text(encoding='utf-8')
    version, date = feed_identity(markdown)
    translated = translate(markdown, args.mock_translation)
    if Path(CHANGELOG).read_text(encoding='utf-8') != markdown:
        raise RuntimeError('CHANGELOG.md changed while preparing the feed; retry')
    content = render(version, date, translated)
    if args.dry_run:
        previous = Path(FEED).read_text(encoding='utf-8') if Path(FEED).is_file() else None
        shape(content, decide(content, previous))
        return
    repo = os.environ.get('GH_REPO', '').strip()
    if not repo:
        raise RuntimeError('GH_REPO is not set')
    publish(repo, content, version)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(redact(error), file=sys.stderr)
        raise SystemExit(1) from None
