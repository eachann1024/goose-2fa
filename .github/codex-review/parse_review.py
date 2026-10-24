#!/usr/bin/env python3
"""Pick the last complete Codex review object and emit it as one JSON value."""
import json
import sys

VERDICT_FIELD = "merge_recommendation"
EXPECTED_FIELDS = (
    "merge_recommendation",
    "risk_level",
    "security_concerns",
    "key_issues_to_review",
)


def _metadata(text, objects):
    """Counts only. Never include any of the review text."""
    raw = text if isinstance(text, str) else ""
    missing = [name for name in EXPECTED_FIELDS if not any(name in obj for obj in objects)]
    return (
        f"审核结果无法解析。字节数={len(raw.encode('utf-8'))}，行数={len(raw.splitlines())}，"
        f"JSON对象数={len(objects)}，缺少字段={','.join(missing) if missing else '无'}"
    )


def _collect(value, objects, found):
    if isinstance(value, dict):
        objects.append(value)
        if VERDICT_FIELD in value:
            found = value
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                objects.append(item)
                if VERDICT_FIELD in item:
                    found = item
    return found


def last_verdict_object(text):
    """Return the last complete object that carries merge_recommendation.

    Codex sometimes writes more than one JSON value or trailing lines. json.load
    then fails with 'Extra data'. Objects without the verdict field are ignored.
    Failure text is metadata only: size, line count, object count, missing fields.
    """
    if not isinstance(text, str):
        raise ValueError(_metadata("", []))
    objects = []
    decoder = json.JSONDecoder()
    found = None
    body = text.lstrip("\ufeff")
    index = 0
    length = len(body)
    while index < length:
        if body[index] not in "{[":
            index += 1
            continue
        try:
            value, end = decoder.raw_decode(body, index)
        except json.JSONDecodeError:
            index += 1
            continue
        found = _collect(value, objects, found)
        index = end
    if found is None:
        raise ValueError(_metadata(text, objects))
    return found


def validate(data):
    needed = set(EXPECTED_FIELDS)
    if not isinstance(data, dict) or set(data) != needed:
        missing = [name for name in EXPECTED_FIELDS if not isinstance(data, dict) or name not in data]
        shown = ",".join(missing) if missing else "无"
        raise ValueError(f"审核结果字段不合法。缺少字段={shown}")
    if data["merge_recommendation"] not in {"safe_to_merge", "merge_with_caution", "changes_required"}:
        raise ValueError("审核建议不合法。缺少字段=无")
    if data["risk_level"] not in {"low", "medium", "high"} or not isinstance(data["security_concerns"], str):
        raise ValueError("审核风险或安全字段不合法。缺少字段=无")
    issues = data["key_issues_to_review"]
    keys = {"relevant_file", "issue_header", "issue_content"}
    if not isinstance(issues, list) or len(issues) > 3 or any(
        not isinstance(issue, dict) or set(issue) != keys or any(not isinstance(value, str) for value in issue.values())
        for issue in issues
    ):
        raise ValueError("审核问题字段不合法。缺少字段=无")
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
