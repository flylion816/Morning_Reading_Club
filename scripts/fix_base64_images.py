#!/usr/bin/env python3
"""
修复第二天课程内容中的 base64 内联图片。
步骤：登录管理员 → 提取 base64 → 上传为真实图片文件 → 替换 URL → 更新课程内容
"""
import sys
import re
import base64
import json
import tempfile
import os
import urllib.request
import urllib.parse

BASE_URL = "https://wx.shubai01.com"
SECTION_ID = "69f9bf45cb1c9ac0600ad55c"  # 第二天 思维方式的力量


def api(path, method="GET", data=None, token=None, files=None):
    url = BASE_URL + "/api/v1" + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    if files:
        # multipart/form-data upload
        boundary = "----FormBoundary7MA4YWxkTrZu0gW"
        headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        body_parts = []
        for field, (filename, filedata, mime) in files.items():
            body_parts.append(
                f"--{boundary}\r\n"
                f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
                f"Content-Type: {mime}\r\n\r\n"
            )
            body_parts_bytes = b"".join(p.encode() if isinstance(p, str) else p for p in body_parts)
            body_parts = []
        # Build proper multipart body
        body = b""
        for field, (filename, filedata, mime) in files.items():
            body += f"--{boundary}\r\n".encode()
            body += f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'.encode()
            body += f"Content-Type: {mime}\r\n\r\n".encode()
            body += filedata
            body += b"\r\n"
        body += f"--{boundary}--\r\n".encode()
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    elif data is not None:
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
            print(f"HTTP {e.code}: {body[:200]}")
            return None


def main():
    # 1. 管理员登录
    print("请输入管理员账号信息：")
    email = input("  Email: ").strip()
    password = input("  Password: ").strip()

    print("\n登录中...")
    resp = api("/auth/admin/login", method="POST", data={"email": email, "password": password})
    if not resp or "data" not in resp or "token" not in resp.get("data", {}):
        print(f"登录失败: {resp}")
        sys.exit(1)
    token = resp["data"]["token"]
    print(f"✅ 登录成功，角色: {resp['data']['admin'].get('role')}")

    # 2. 获取第二天内容
    print(f"\n获取课程内容 (section: {SECTION_ID})...")
    resp = api(f"/sections/{SECTION_ID}")
    if not resp or "data" not in resp:
        print(f"获取课程失败: {resp}")
        sys.exit(1)
    content = resp["data"].get("content", "")
    print(f"  原始内容长度: {len(content):,} 字符")

    # 3. 提取并替换 base64 图片
    pattern = re.compile(r'data:image/([^;]+);base64,([A-Za-z0-9+/=]+)')
    matches = list(pattern.finditer(content))
    print(f"  发现 base64 图片: {len(matches)} 张")

    if not matches:
        print("没有 base64 图片，无需修复。")
        sys.exit(0)

    new_content = content
    for i, match in enumerate(matches):
        img_type = match.group(1)  # e.g. "png"
        b64_data = match.group(2)
        img_bytes = base64.b64decode(b64_data)
        size_kb = len(img_bytes) // 1024
        print(f"\n  处理图片 {i+1}/{len(matches)}: type={img_type}, size={size_kb} KB")

        # 4. 上传图片
        filename = f"section_day2_img{i+1}.{img_type}"
        mime = f"image/{img_type}"
        print(f"    上传 {filename}...")
        upload_resp = api(
            "/upload",
            token=token,
            files={"file": (filename, img_bytes, mime)}
        )
        if not upload_resp or "data" not in upload_resp:
            print(f"    ❌ 上传失败: {upload_resp}")
            continue

        file_url = upload_resp["data"].get("url") or upload_resp["data"].get("fileUrl")
        full_url = BASE_URL + file_url
        print(f"    ✅ 上传成功: {full_url}")

        # 5. 替换 base64 为 URL（只替换这一处匹配）
        new_content = new_content.replace(
            match.group(0),
            f"<img src=\"{full_url}\" style=\"max-width:100%\">",
            1
        )

    print(f"\n  新内容长度: {len(new_content):,} 字符（减少 {(len(content)-len(new_content))//1024} KB）")

    # 6. 更新课程内容
    print(f"\n更新课程内容...")
    update_resp = api(
        f"/admin/sections/{SECTION_ID}",
        method="PUT",
        data={"content": new_content},
        token=token
    )
    if not update_resp or "data" not in update_resp:
        print(f"❌ 更新失败: {update_resp}")
        sys.exit(1)

    print("✅ 更新成功！")
    print("\n验证修复效果（预期 < 50 KB）:")
    os.system(f'curl -s -w "size=%{{size_download}} bytes, time=%{{time_total}}s\\n" -o /dev/null "{BASE_URL}/api/v1/sections/{SECTION_ID}"')


if __name__ == "__main__":
    main()
