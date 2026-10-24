#!/usr/bin/env python3
"""Pick the last complete Codex review object and emit it as one JSON value."""
import json
import re
import sys

VERDICT_FIELD = "merge_recommendation"
_PEM = re.compile(
    r"(?is)-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?-----END [A-Z0-9 ]*PRIVATE KEY-----")
# Quoted JSON credential fields: mask the whole string value, keep the key.
_JSON_SECRET = re.compile(
    r'("(?:token|password|secret|access_token|refresh_token|api_key|id_token)")'
    r'\s*:\s*"(?:\\.|[^"\\])*"',
    re.IGNORECASE)
_QUOTED = r'(?:"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|\S+)'
_AUTH = re.compile(
    r"(?i)\bauthorization\b\s*[:=]\s*(?:(?:bearer|basic|token|negotiate|digest)\s+)?" + _QUOTED)
_BEARER = re.compile(r"(?i)\bbearer\s+" + _QUOTED)
_ASSIGNED = re.compile(
    r"(?i)\b(authorization|api[_-]?key|token|secret|password|credential|bearer)\b\s*[:=]\s*" + _QUOTED)
_TOKEN = re.compile(r"\b(?:ghp_|github_pat_|gho_|ghu_|ghs_|sk-|sk-proj-|xox[baprs]-)[A-Za-z0-9_\-]{6,}")
# eyJ... header, plus an optional payload and signature.
_JWT = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}(?:\.[A-Za-z0-9_-]+){0,2}")


def _mask_json_secret(match):
    return f'{match.group(1)}: "[REDACTED]"'


def safe_excerpt(text, limit=180):
    """Short single-line excerpt with secret-shaped substrings removed."""
    cleaned = _PEM.sub("[REDACTED]", str(text or ""))
    cleaned = _JSON_SECRET.sub(_mask_json_secret, cleaned)
    cleaned = _AUTH.sub("[REDACTED]", cleaned)
    cleaned = _BEARER.sub("[REDACTED]", cleaned)
    cleaned = _ASSIGNED.sub(lambda match: f"{match.group(1)}=[REDACTED]", cleaned)
    cleaned = _TOKEN.sub("[REDACTED]", cleaned)
    cleaned = _JWT.sub("[REDACTED]", cleaned)
    cleaned = " ".join(cleaned.split())
    if not cleaned:
        return "(空)"
    if len(cleaned) > limit:
        return cleaned[:limit - 1] + "…"
    return cleaned


def _prefer(found, value):
    if isinstance(value, dict) and VERDICT_FIELD in value:
        return value
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and VERDICT_FIELD in item:
                found = item
    return found


def last_verdict_object(text):
    """Return the last complete object that carries merge_recommendation.

    Codex sometimes writes more than one JSON value or trailing lines. json.load
    then fails with 'Extra data'. Objects without the verdict field are ignored.
    """
    if not isinstance(text, str):
        raise ValueError("审核结果不是文本。摘录：" + safe_excerpt(""))
    text = text.lstrip("\ufeff")
    decoder = json.JSONDecoder()
    found = None
    index = 0
    length = len(text)
    while index < length:
        if text[index] not in "{[":
            index += 1
            continue
        try:
            value, end = decoder.raw_decode(text, index)
        except json.JSONDecodeError:
            index += 1
            continue
        found = _prefer(found, value)
        index = end
    if found is None:
        raise ValueError(
            "审核结果里没有包含 merge_recommendation 的完整 JSON 对象。摘录："
            + safe_excerpt(text))
    return found


def validate(data):
    needed = {"merge_recommendation", "risk_level", "security_concerns", "key_issues_to_review"}
    if not isinstance(data, dict) or set(data) != needed:
        raise ValueError("审核结果字段不合法")
    if data["merge_recommendation"] not in {"safe_to_merge", "merge_with_caution", "changes_required"}:
        raise ValueError("审核建议不合法")
    if data["risk_level"] not in {"low", "medium", "high"} or not isinstance(data["security_concerns"], str):
        raise ValueError("审核风险或安全字段不合法")
    issues = data["key_issues_to_review"]
    keys = {"relevant_file", "issue_header", "issue_content"}
    if not isinstance(issues, list) or len(issues) > 3 or any(
        not isinstance(issue, dict) or set(issue) != keys or any(not isinstance(value, str) for value in issue.values())
        for issue in issues
    ):
        raise ValueError("审核问题字段不合法")
    return data


def main():
    if len(sys.argv) != 2:
        print("用法: parse_review.py <review.json>", file=sys.stderr)
        raise SystemExit(2)
    text = open(sys.argv[1], encoding="utf-8").read()
    try:
        data = validate(last_verdict_object(text))
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
    json.dump(data, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
