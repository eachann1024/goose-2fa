#!/usr/bin/env python3
"""Build-gated, immutable GitHub stable releases; no registry or deployment writes."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import zipfile
from release_notes import write_release_notes
ROOT = Path.cwd()
CONFIG = json.loads((ROOT / '.github/stable-release.json').read_text())
STATE = ROOT / '.stable-release'
REPO = os.environ.get('GH_REPO') or os.environ.get('GITHUB_REPOSITORY')


def run(*args, binary=False):
    return subprocess.check_output(args, text=not binary, stderr=subprocess.PIPE)


def git(*args, binary=False):
    return run('git', *args, binary=binary)


def gh(*args):
    if not REPO or not re.fullmatch(r'[\w.-]+/[\w.-]+', REPO):
        raise ValueError('GH_REPO or GITHUB_REPOSITORY is required')
    return run('gh', *args)


def api(path):
    try:
        return json.loads(gh('api', f'repos/{REPO}/{path}'))
    except subprocess.CalledProcessError as error:
        if '(HTTP 404)' in error.stderr:
            return None
        raise


def entries(ref):
    rows = []
    for entry in git('ls-tree', '-rz', ref, binary=True).split(b'\0'):
        if entry:
            metadata, name = entry.split(b'\t', 1)
            rows.append((metadata.decode(), name.decode()))
    return rows


def selected(name, patterns):
    return any(name == p.rstrip('/') or name.startswith(p.rstrip('/') + '/') for p in patterns)


def fingerprint(ref):
    rows = [f'{meta}\t{name}' for meta, name in entries(ref)
            if selected(name, CONFIG['inputs'])]
    if not rows:
        raise ValueError('No tracked release inputs selected')
    return hashlib.sha256('\n'.join(rows).encode()).hexdigest()


def output(name, value):
    print(f'{name}={value}')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as file:
            file.write(f'{name}={value}\n')


def skip_note(line):
    print(line)
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a') as file:
            file.write(f'{line}\n')


def release_pages():
    return json.loads(gh('api', '--paginate', '--slurp', f'repos/{REPO}/releases?per_page=100'))


def published_version_release(version):
    exact, prefix = f'v{version}', f'v{version}-'
    for page in release_pages():
        for release in page:
            tag = release.get('tag_name') or ''
            if release.get('draft') or release.get('prerelease'):
                continue
            if tag == exact or tag.startswith(prefix):
                return release
    return None


def current_plan():
    plan = json.loads((STATE / 'plan.json').read_text())
    if git('rev-parse', 'HEAD').strip() != plan['commit'] or fingerprint('HEAD') != plan['fingerprint']:
        raise ValueError('Selected source changed after prepare')
    return plan


def prepare(force, offline):
    branch = CONFIG['branch']
    ref = os.environ.get('GITHUB_REF')
    if ref and ref != f'refs/heads/{branch}':
        raise ValueError('Stable builds must use the configured default branch')
    commit = git('rev-parse', 'HEAD').strip()
    if os.environ.get('GITHUB_SHA', commit) != commit:
        raise ValueError('Checkout does not match the workflow commit')
    version = None
    if CONFIG.get('version_file'):
        content = git('show', f"HEAD:{CONFIG['version_file']}")
        version = json.loads(content).get(CONFIG.get('version_key', 'version')) if CONFIG['version_file'].endswith('.json') else content.strip()
        if version and not re.fullmatch(r'\d+\.\d+\.\d+', version):
            raise ValueError('A stable release needs a stable X.Y.Z version')
    date = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d')
    tag = f'v{version}-{commit[:7]}' if version else f'stable-{date}-{commit[:7]}'
    digest = fingerprint('HEAD')
    unchanged = False
    published = None
    if not offline:
        latest = api('releases/latest')
        if latest:
            manifest = next((a for a in latest['assets'] if a['name'] == 'release-manifest.json'), None)
            if manifest:
                payload = json.loads(gh('api', f'repos/{REPO}/releases/assets/{manifest["id"]}', '-H', 'Accept: application/octet-stream'))
                unchanged = payload.get('fingerprint') == digest
            else:
                try:
                    unchanged = fingerprint(f"refs/tags/{latest['tag_name']}") == digest
                except subprocess.CalledProcessError:
                    pass
        existing = api(f'releases/tags/{tag}')
        if existing and not existing['draft']:
            if existing['prerelease']:
                raise ValueError('Existing published tag is a prerelease; do not overwrite it')
            unchanged = True
        if version:
            published = published_version_release(version)
            if published:
                unchanged = True
    STATE.mkdir(exist_ok=True)
    plan = {'schema': 1, 'commit': commit, 'fingerprint': digest, 'tag': tag,
            'branch': branch, 'version': version, 'title': f"{CONFIG['name']} {version or date}"}
    (STATE / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    building = force or not unchanged
    if published and not building:
        skip_note(f'版本 {version} 已发布为 {published["tag_name"]}，跳过编译')
    decided = str(building).lower()
    output('build', decided)
    output('should_build', decided)
    output('tag', tag)
    output('commit', commit)


def package():
    plan = current_plan()
    target = STATE / 'assets'
    target.mkdir(exist_ok=True)
    records = []
    for asset in CONFIG['assets']:
        name = asset['name']
        if Path(name).name != name or not name.endswith('.zip'):
            raise ValueError('Each configured asset must be a plain .zip filename')
        files = {}
        for part in asset['parts']:
            prefix = part.get('prefix', '').strip('/')
            if prefix and ('..' in Path(prefix).parts or Path(prefix).is_absolute()):
                raise ValueError('Invalid archive prefix')
            if 'tracked' in part:
                for metadata, relative in entries('HEAD'):
                    if selected(relative, part['tracked']):
                        if not metadata.startswith(('100644 ', '100755 ')):
                            raise ValueError(f'Unsupported tracked file mode: {relative}')
                        content = git('show', f'HEAD:{relative}', binary=True)
                        name_in_zip = f'{prefix}/{relative}' if prefix else relative
                        if name_in_zip in files:
                            raise ValueError(f'Duplicate archive path: {name_in_zip}')
                        files[name_in_zip] = (content, metadata.startswith('100755 '))
            else:
                directory = (ROOT / part['path']).resolve()
                if not directory.is_relative_to(ROOT.resolve()) or not directory.is_dir():
                    raise ValueError(f'Missing or unsafe build directory: {directory}')
                paths = [p for p in directory.rglob('*') if p.is_file()]
                if not paths:
                    raise ValueError(f'Empty build directory: {directory}')
                for path in paths:
                    if not path.resolve().is_relative_to(directory):
                        raise ValueError(f'Archive symlink escapes build directory: {path}')
                    relative = path.relative_to(directory).as_posix()
                    name_in_zip = f'{prefix}/{relative}' if prefix else relative
                    if name_in_zip in files:
                        raise ValueError(f'Duplicate archive path: {name_in_zip}')
                    files[name_in_zip] = (path.read_bytes(), bool(path.stat().st_mode & 0o111))
        if not files:
            raise ValueError(f'Empty release asset: {name}')
        with zipfile.ZipFile(target / name, 'w', zipfile.ZIP_DEFLATED) as archive:
            for relative, (content, executable) in sorted(files.items()):
                info = zipfile.ZipInfo(relative)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (0o100755 if executable else 0o100644) << 16
                archive.writestr(info, content)
        data = (target / name).read_bytes()
        records.append({'name': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    manifest = {**plan, 'assets': records}
    (target / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    sums = [f'{r["sha256"]}  {r["name"]}' for r in records]
    manifest_hash = hashlib.sha256((target / 'release-manifest.json').read_bytes()).hexdigest()
    (target / 'SHA256SUMS.txt').write_text('\n'.join(sums + [f'{manifest_hash}  release-manifest.json']) + '\n')
    write_release_notes(ROOT, STATE, CONFIG, plan)
    print(json.dumps({'tag': plan['tag'], 'assets': records}))


def find_release(tag):
    return next((r for page in release_pages() for r in page if r['tag_name'] == tag), None)


def verify_tag(tag, commit):
    reference = api(f'git/ref/tags/{tag}')
    if not reference:
        return
    obj = reference['object']
    for _ in range(5):
        if obj['type'] != 'tag':
            break
        obj = api(f'git/tags/{obj["sha"]}')['object']
    if obj['type'] != 'commit' or obj['sha'] != commit:
        raise ValueError('Existing release tag points to different source; do not overwrite it')


def publish():
    if os.environ.get('PUBLISH_ALLOWED') != 'true':
        raise ValueError('Publishing is disabled for validation runs')
    plan = current_plan()
    remote = api(f'commits/{CONFIG["branch"]}')
    if not remote or remote['sha'] != plan['commit']:
        print('Default branch advanced during build; leave the previous stable release intact.')
        return
    if plan.get('version') and published_version_release(plan['version']):
        print('同版本已发布，保持不变')
        return
    tag = plan['tag']
    verify_tag(tag, plan['commit'])
    existing = find_release(tag)
    if existing and not existing['draft']:
        print(f'{tag} is published; keeping its assets intact.')
        return
    target = STATE / 'assets'
    names = sorted([a['name'] for a in CONFIG['assets']] + ['release-manifest.json', 'SHA256SUMS.txt'])
    actual = sorted(p.name for p in target.iterdir())
    if actual != names:
        raise ValueError('Release staging must match the asset allowlist exactly')
    expected = {n: hashlib.sha256((target / n).read_bytes()).hexdigest() for n in names}
    manifest = json.loads((target / 'release-manifest.json').read_text())
    if any(manifest.get(key) != value for key, value in plan.items()):
        raise ValueError('Release manifest differs from the selected source plan')
    if sorted(r['name'] for r in manifest['assets']) != sorted(a['name'] for a in CONFIG['assets']):
        raise ValueError('Manifest assets differ from the configured allowlist')
    sums = []
    for record in manifest['assets']:
        path = target / record['name']
        if expected[record['name']] != record['sha256'] or path.stat().st_size != record['size']:
            raise ValueError('Build asset differs from its manifest')
        sums.append(f'{record["sha256"]}  {record["name"]}')
    sums.append(f'{expected["release-manifest.json"]}  release-manifest.json')
    if (target / 'SHA256SUMS.txt').read_text() != '\n'.join(sums) + '\n':
        raise ValueError('Build checksum file differs from its manifest')
    if not existing:
        gh('release', 'create', tag, '--repo', REPO, '--target', plan['commit'],
           '--title', plan['title'], '--notes-file', str(STATE / 'notes.md'), '--draft')
    gh('release', 'upload', tag, '--repo', REPO, '--clobber', *[str(target / n) for n in names])
    uploaded = find_release(tag)
    if not uploaded or not uploaded['draft'] or sorted(a['name'] for a in uploaded['assets']) != names:
        raise ValueError('Draft release asset set does not match the allowlist')
    for asset in uploaded['assets']:
        if asset.get('digest') != f'sha256:{expected[asset["name"]]}':
            raise ValueError(f'Uploaded asset checksum differs: {asset["name"]}')
    current = api(f'commits/{CONFIG["branch"]}')
    if not current or current['sha'] != plan['commit']:
        print('Default branch advanced during upload; keep the verified draft unpublished.')
        return
    gh('release', 'edit', tag, '--repo', REPO, '--draft=false', '--prerelease=false', '--latest')
    released = api(f'releases/tags/{tag}')
    latest = api('releases/latest')
    if not released or released['draft'] or released['prerelease'] or not latest or latest['tag_name'] != tag:
        raise ValueError('Published stable/latest state was not verified')
    print(f'Published and verified {REPO}@{tag}.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['prepare', 'package', 'publish'])
    parser.add_argument('--force-build', action='store_true')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    if args.command == 'prepare':
        prepare(args.force_build, args.offline)
    elif args.command == 'package':
        package()
    else:
        publish()
