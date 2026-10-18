"""Include the committed version's user-facing changelog in each stable release."""
import re
import subprocess


def write_release_notes(root, state, config, plan):
    changelog = subprocess.check_output(
        ['git', 'show', 'HEAD:CHANGELOG.md'], cwd=root, text=True)
    version = plan.get('version')
    section = []
    collecting = False
    for line in changelog.splitlines():
        if line.startswith('## '):
            if collecting:
                break
            match = re.fullmatch(r'## \d{4}-\d{2}-\d{2} · v(\d+\.\d+\.\d+)\s*', line)
            collecting = bool(match and match[1] == version)
        elif collecting:
            section.append(line)
    body = '\n'.join(section).strip()
    if not body or not re.search(r'^\s*(?:[-*•]|\d+\.)\s+\S', body, re.MULTILINE):
        raise ValueError(f'CHANGELOG.md needs update notes for v{version}')
    notes = [f'## 更新内容\n\n{body}', '', config.get('notes', ''), '',
             f'Source commit: `{plan["commit"]}`', '',
             'Assets include SHA256SUMS.txt and release-manifest.json.']
    (state / 'notes.md').write_text('\n'.join(notes) + '\n')
