#!/usr/bin/env python3
"""Squash-merge gate. Review JSON is read from an artifact, never a job output.

Same-repo owner PRs (ALLOWED_AUTHORS) whose verdict is safe_to_merge merge
without the bot-automerge label, including PROTECTED_PATHS. SECRET_PATHS still
block the merge and get needs-human. Forks and other authors keep the old
label-and-protected-path behavior. This script does not check out PR code.
"""
import json
import os
import re
import subprocess
import sys
import time

from parse_review import last_verdict_object

env = os.environ
MISSING = (
    "AI 审核任务已成功，但审核产物 gate-review/gate-review.json 缺失或为空。"
    "审核结果不通过 job output 传递；没有产物就无法读取结论，自动合并已停止。"
)
DEFAULT_SECRET_PATHS = ".env*,secrets,credentials,*.pem,*.key,*.p12,id_rsa*"


def short(text, limit=120):
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def split_patterns(raw):
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


def matches(name, pattern):
    base = name.rsplit("/", 1)[-1]
    if pattern.endswith("/"):
        return ("/" + name).find("/" + pattern) >= 0
    if pattern.startswith("*"):
        return name.endswith(pattern[1:])
    return base.startswith(pattern)


def secret_match(name, pattern):
    """Match a secret pattern against every path segment, not only the file name.

    `secrets` and `credentials` are exact segments. A trailing `*` is a segment
    prefix (`.env*`, `id_rsa*`). A leading `*` is a segment suffix (`*.pem`).
    """
    segments = [part for part in name.split("/") if part]
    if pattern.startswith("*"):
        suffix = pattern[1:]
        return any(segment.endswith(suffix) for segment in segments)
    if pattern.endswith("*"):
        prefix = pattern[:-1]
        return any(segment.startswith(prefix) for segment in segments)
    return pattern in segments


def matching(names, patterns):
    return [name for name in names if any(matches(name, pattern) for pattern in patterns)]


def matching_secret(names, patterns):
    return [name for name in names if any(secret_match(name, pattern) for pattern in patterns)]


def gh(*args, check=True):
    result = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and result.returncode != 0:
        print(result.stderr, file=sys.stderr)
        raise SystemExit(f"gh {' '.join(args[:3])} failed")
    return result.stdout


def api(path):
    return json.loads(gh("api", path))


def verdict(review):
    if not review:
        return "无审核结果"
    return f"{review.get('merge_recommendation', '?')} / 风险 {review.get('risk_level', '?')}"


def write_summary(text):
    path = env.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    try:
        with open(path, "a", encoding="utf-8") as handle:
            handle.write(text)
    except OSError:
        pass


def block_merge(reasons, review, repo, pr, sha, block):
    gh("label", "create", block, "-R", repo, "--color", "B60205",
       "--description", "AI 闸门判定需要人工处理", check=False)
    gh("api", "-X", "POST", f"repos/{repo}/issues/{pr}/labels", "-f", f"labels[]={block}", check=False)
    ordered = sorted(reasons, key=lambda reason: reason.startswith(("合并建议为", "风险等级为")))
    lines = [f"- {short(reason)}" for reason in ordered[:3]]
    if len(ordered) > 3:
        lines.append(f"- 另有 {len(ordered) - 3} 条，见 Actions 运行摘要")
    body = (f"### 🤖 自动合并已拦截\n结论：{verdict(review)}\n" + "\n".join(lines) +
            f"\n\n审核提交：`{sha[:7]}`")
    gh("pr", "comment", pr, "-R", repo, "--body", body, check=False)
    print("BLOCKED:", ordered)


def quality_reasons(review):
    reasons = []
    rec = str(review.get("merge_recommendation", "")).strip()
    risk = str(review.get("risk_level", "")).strip().lower()
    sec_raw = review.get("security_concerns", None)
    if isinstance(sec_raw, bool):
        sec_text = "true" if sec_raw else "false"
        sec_clear = not sec_raw
    else:
        sec_text = str(sec_raw or "").strip()
        low = sec_text.lower()
        sec_clear = low.startswith("no") or low in {"false", "none", "null"}
    ok_recs = {"safe_to_merge"} | ({"merge_with_caution"} if env.get("ALLOW_CAUTION") == "true" else set())
    if rec not in ok_recs:
        reasons.append(f"合并建议为 `{rec or '缺失'}`")
    if risk not in {"low", "medium"}:
        reasons.append(f"风险等级为 `{risk or '缺失'}`")
    if sec_raw is None or (not isinstance(sec_raw, bool) and not sec_text):
        reasons.append("安全审查字段缺失")
    elif not sec_clear:
        reasons.append(f"存在安全疑虑：{sec_text[:300]}")
    issues = review.get("key_issues_to_review") or []
    if not isinstance(issues, list):
        issues = []
    fatal_kw = re.compile(
        r"安全漏洞|安全隐患|安全问题|安全风险|不安全|安全性|漏洞|注入|泄露|密钥|令牌|凭据|鉴权|认证|授权|越权|权限|计费|扣费|支付|账单|"
        r"数据(丢失|损坏|泄露|删除|清空|覆盖)|丢数据|迁移|schema|"
        r"\b(security|vulnerab\w*|injection|secret|credential|authn|authz|authenticat\w*|authoriz\w*|"
        r"permission|billing|payment|migration|data loss|corrupt\w*)\b", re.I)
    for item in issues:
        if isinstance(item, dict):
            text = f"{item.get('issue_header', '')} {item.get('issue_content', '')}"
            if fatal_kw.search(text):
                reasons.append("审核意见涉及安全/鉴权/计费/数据/迁移：" + str(item.get("issue_header", ""))[:120])
    if rec == "changes_required":
        for item in issues:
            if isinstance(item, dict):
                reasons.append("要改：" + short(
                    f"{str(item.get('relevant_file', '')).strip()} "
                    f"{str(item.get('issue_header', '')).strip()}：{item.get('issue_content', '')}"))
    return reasons


def load_review():
    if env.get("REVIEW_RESULT") != "success":
        return {}, None
    path = env.get("REVIEW_FILE") or os.path.join(
        env.get("RUNNER_TEMP", ""), "gate-review", "gate-review.json")
    if not path or not os.path.isfile(path):
        return {}, MISSING
    text = open(path, encoding="utf-8").read()
    if not text.strip():
        return {}, MISSING
    try:
        return last_verdict_object(text), None
    except ValueError as exc:
        return {}, str(exc)


def protection_reasons(names, owner_safe):
    secret_patterns = split_patterns(env.get("SECRET_PATHS") or DEFAULT_SECRET_PATHS)
    protected_patterns = split_patterns(env.get("PROTECTED_PATHS"))
    reasons = []
    secret_hit = matching_secret(names, secret_patterns)
    protected_hit = matching(names, protected_patterns)
    if secret_hit:
        reasons.append("改动了密钥材料路径：" + ", ".join(secret_hit[:10]))
    # Owner safe_to_merge may change protected paths. Secret paths stay blocking.
    if protected_hit and not owner_safe:
        reasons.append("改动了受保护路径：" + ", ".join(protected_hit[:10]))
    return reasons


def main():
    for key in ("REPO", "PR", "HEAD_SHA", "AUTOMERGE_LABEL", "BLOCK_LABEL", "REVIEW_RESULT", "ALLOWED_AUTHORS"):
        if not env.get(key):
            raise SystemExit(f"缺少环境变量 {key}")
    repo, pr, sha = env["REPO"], env["PR"], env["HEAD_SHA"]
    label, block = env["AUTOMERGE_LABEL"], env["BLOCK_LABEL"]
    review, fatal = load_review()
    if fatal:
        print(fatal, file=sys.stderr)
        write_summary("## AI 审核结论\n\n" + fatal + "\n")
        block_merge([fatal], review, repo, pr, sha, block)
        raise SystemExit(1)
    if env["REVIEW_RESULT"] != "success":
        write_summary(f"## AI 审核结论\n\n审核任务未成功（{env['REVIEW_RESULT']}），没有读取审核产物。\n")
    else:
        write_summary("## AI 审核结论\n\n```json\n" +
                      json.dumps(review, ensure_ascii=False, indent=2)[:60000] + "\n```\n")

    info = api(f"repos/{repo}/pulls/{pr}")
    labels = {item["name"] for item in info["labels"]}
    login = info["user"]["login"]
    allowed = {item.strip() for item in env["ALLOWED_AUTHORS"].split(",") if item.strip()}
    head_repo = ((info.get("head") or {}).get("repo") or {}).get("full_name")
    same_repo = head_repo == repo
    recommendation = str((review or {}).get("merge_recommendation", "")).strip()
    # No bot-automerge label required on this path. Forks never qualify.
    owner_safe = login in allowed and same_repo and recommendation == "safe_to_merge"
    if label not in labels and not owner_safe:
        print("no automerge label; review only")
        raise SystemExit(0)
    if info["state"] != "open" or info["head"]["sha"] != sha:
        print("PR closed or head moved; a newer run will handle it")
        raise SystemExit(0)
    if login not in allowed:
        print("author not allowed; review only")
        raise SystemExit(0)

    reasons = []
    if env["REVIEW_RESULT"] != "success":
        reasons.append(f"AI 审核未成功完成（{env['REVIEW_RESULT']}），按规则不自动合并")
    elif not review:
        reasons.append("没有拿到 AI 审核的结构化结果")
    else:
        reasons.extend(quality_reasons(review))
    if any("security" in item.lower() for item in labels):
        reasons.append("PR 带有安全疑虑标签")

    files = json.loads(gh("api", "--paginate", "--slurp", f"repos/{repo}/pulls/{pr}/files?per_page=100"))
    names = [item["filename"] for page in files for item in page]
    reasons.extend(protection_reasons(names, owner_safe))
    if reasons:
        block_merge(reasons, review, repo, pr, sha, block)
        raise SystemExit(0)

    own = {"ai-review", "ai-merge-gate"}
    deadline = time.time() + int(env.get("CHECKS_TIMEOUT_MIN", "20")) * 60
    while True:
        runs = [item for item in api(f"repos/{repo}/commits/{sha}/check-runs?per_page=100")["check_runs"]
                if item["name"] not in own]
        status = api(f"repos/{repo}/commits/{sha}/status")
        pending = [item["name"] for item in runs if item["status"] != "completed"] + \
            [item["context"] for item in status["statuses"] if item["state"] == "pending"]
        bad = [f"{item['name']}={item['conclusion']}" for item in runs
               if item["status"] == "completed" and item["conclusion"] not in ("success", "skipped", "neutral")] + \
            [f"{item['context']}={item['state']}" for item in status["statuses"] if item["state"] in ("failure", "error")]
        if bad:
            block_merge(["其他检查未通过：" + ", ".join(bad[:10])], review, repo, pr, sha, block)
            raise SystemExit(0)
        if not pending:
            break
        if time.time() > deadline:
            block_merge(
                [f"等待检查超过 {env.get('CHECKS_TIMEOUT_MIN', '20')} 分钟（{', '.join(pending[:10])}），超时不合并"],
                review, repo, pr, sha, block)
            raise SystemExit(0)
        time.sleep(30)

    for _ in range(10):
        info = api(f"repos/{repo}/pulls/{pr}")
        if info["mergeable"] is not None:
            break
        time.sleep(6)
    if info["head"]["sha"] != sha:
        print("head moved while waiting; skip")
        raise SystemExit(0)
    if info["mergeable"] is not True:
        block_merge(
            [f"PR 当前不可合并（mergeable={info['mergeable']}, state={info.get('mergeable_state')}），可能有冲突"],
            review, repo, pr, sha, block)
        raise SystemExit(0)

    merged = subprocess.run(
        ["gh", "pr", "merge", pr, "-R", repo, "--squash", "--delete-branch", "--match-head-commit", sha],
        capture_output=True, text=True)
    if merged.returncode != 0:
        block_merge(
            [f"合并调用失败：{(merged.stderr or merged.stdout).strip()[:300]}"],
            review, repo, pr, sha, block)
        raise SystemExit(0)
    gh("pr", "comment", pr, "-R", repo, "--body",
       f"✅ AI 审核通过（{verdict(review)}），已自动合并 `{sha[:7]}`", check=False)
    print("MERGED", repo, pr, sha)


if __name__ == "__main__":
    main()
