"""Mirror only a published stable Release's tagged changelog to the public feed."""
import base64
import json
import os
import re
import subprocess
import urllib.parse

REPO = os.environ['GH_REPO']
PATH = 'public/update-notices.json'
VERSION = r'(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)'


def api(path, payload=None):
    command = ['gh', 'api', f'repos/{REPO}/{path}']
    if payload is not None:
        command += ['--method', 'PUT', '--input', '-']
    result = subprocess.run(command, input=json.dumps(payload) if payload else None,
                            text=True, capture_output=True)
    if result.returncode:
        if '(HTTP 404)' in result.stderr and payload is None:
            return None
        raise RuntimeError(f'GitHub API request failed: {path.split("?")[0]}')
    return json.loads(result.stdout)


def main():
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', REPO):
        raise ValueError('Invalid repository')
    release = api('releases/latest')
    if not release:
        print('No published stable release; leave the feed unchanged.')
        return
    match = re.fullmatch(rf'v({VERSION})(?:-[0-9a-f]{{7,40}})?', release['tag_name'])
    if release['draft'] or release['prerelease'] or not match:
        raise ValueError('Only a published stable version can update the feed')
    reference = urllib.parse.quote(release['tag_name'], safe='')
    changelog = api(f'contents/CHANGELOG.md?ref={reference}')
    if not changelog or changelog.get('encoding') != 'base64':
        raise ValueError('The published release has no readable changelog')
    markdown = base64.b64decode(changelog['content']).decode('utf-8')
    content = json.dumps({'schema': 1, 'version': match[1],
                         'date': release['published_at'][:10], 'markdown': markdown},
                         ensure_ascii=False, indent=2) + '\n'
    if len(content.encode()) > 512 * 1024:
        raise ValueError('The public update feed exceeds its size limit')
    current = api(f'contents/{PATH}?ref=main')
    if current:
        previous = base64.b64decode(current['content']).decode('utf-8')
        saved = json.loads(previous)
        if saved.get('schema') == 1 and re.fullmatch(VERSION, saved.get('version', '')):
            if tuple(map(int, saved['version'].split('.'))) > tuple(map(int, match[1].split('.'))):
                print('Latest release version moved backwards; keep the published feed intact.')
                return
        if previous == content:
            print('Published update feed is already current.')
            return
    latest = api('releases/latest')
    if not latest or latest['id'] != release['id']:
        raise ValueError('Latest release changed while preparing the feed; retry')
    payload = {
        'message': f'chore: sync published update notices for {release["tag_name"]}',
        'branch': 'main', 'content': base64.b64encode(content.encode()).decode(),
    }
    if current:
        payload['sha'] = current['sha']
    api(f'contents/{PATH}', payload)
    print(f'Published update feed now follows {release["tag_name"]}.')


if __name__ == '__main__':
    main()
