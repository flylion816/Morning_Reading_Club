#!/usr/bin/env python3
"""
修复 base64 批量替换后产生的嵌套 img 标签:
  <img src="<img src="https://..." style="max-width:100%">">
→ <img src="https://..." style="max-width:100%">
"""
import sys
import re
import json
import urllib.request
import urllib.error

BASE_URL = "https://wx.shubai01.com"

# 第一批只修第二天，确认后再改其他
SECTION_IDS = {
    "day2":  "69f9bf45cb1c9ac0600ad55c",
}

ALL_SECTION_IDS = {
    "day2":  "69f9bf45cb1c9ac0600ad55c",
    "day5":  "69f9bf45cb1c9ac0600ad55f",
    "day6":  "69f9bf45cb1c9ac0600ad560",
    "day7":  "69f9bf45cb1c9ac0600ad561",
    "day8":  "69f9bf45cb1c9ac0600ad562",
    "day9":  "69f9bf45cb1c9ac0600ad563",
    "day14": "69f9bf45cb1c9ac0600ad568",
    "day17": "69f9bf45cb1c9ac0600ad56b",
    "day21": "69f9bf45cb1c9ac0600ad56f",
}

BROKEN_PATTERN = re.compile(
    r'<img\s+src="<img\s+src="(https://[^"]+)"[^>]*>">'
)


def api(path, method="GET", data=None, token=None):
    url = BASE_URL + "/api/v1" + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if data is not None:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
    else:
        req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return json.loads(body)
        except Exception:
            print(f"HTTP {e.code}: {body[:300]}")
            return None


def fix_section(section_id, label, token):
    print(f"\n--- {label} ({section_id}) ---")
    resp = api(f"/sections/{section_id}")
    if not resp or "data" not in resp:
        print(f"  获取失败: {resp}")
        return False

    content = resp["data"].get("content", "")
    matches = BROKEN_PATTERN.findall(content)
    if not matches:
        print(f"  无嵌套 img 标签，跳过")
        return True

    print(f"  发现嵌套 img 标签: {len(matches)} 处")
    for url in matches:
        print(f"    URL: {url}")

    fixed = BROKEN_PATTERN.sub(r'<img src="\1" style="max-width:100%">', content)

    # 确认替换正确
    remaining = BROKEN_PATTERN.findall(fixed)
    if remaining:
        print(f"  警告：还有 {len(remaining)} 处未修复，跳过更新")
        return False

    update_resp = api(
        f"/admin/sections/{section_id}",
        method="PUT",
        data={"content": fixed},
        token=token,
    )
    if not update_resp or "data" not in update_resp:
        print(f"  更新失败: {update_resp}")
        return False

    print(f"  ✅ 修复成功，共替换 {len(matches)} 处")
    return True


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "day2"

    if mode == "all":
        sections = ALL_SECTION_IDS
    else:
        sections = SECTION_IDS

    # 登录
    email = "admin@morningreading.com"
    password = "Km7$Px2Qw9shizi"
    print("登录中...")
    resp = api("/auth/admin/login", method="POST", data={"email": email, "password": password})
    if not resp or "data" not in resp or "token" not in resp.get("data", {}):
        print(f"登录失败: {resp}")
        sys.exit(1)
    token = resp["data"]["token"]
    print(f"✅ 登录成功")

    results = {}
    for label, sid in sections.items():
        results[label] = fix_section(sid, label, token)

    print("\n=== 结果摘要 ===")
    for label, ok in results.items():
        print(f"  {label}: {'✅' if ok else '❌'}")


if __name__ == "__main__":
    main()
