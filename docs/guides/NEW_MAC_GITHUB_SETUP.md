# 新电脑 GitHub CLI 配置指南

> 记录新 Mac 上安装 Homebrew、GitHub CLI，并完成 `gh auth login` 的流程。
> 本记录创建于 2026-05-10，适用于 Apple Silicon Mac。

## 目标

完成后应具备：

- 可直接使用 `brew`
- 已安装 GitHub CLI：`gh`
- `gh` 已登录 GitHub 账号
- Git 操作协议配置为 HTTPS

## 1. 检查 Homebrew

```zsh
brew --version
```

如果提示 `command not found: brew`，继续检查常见安装路径：

```zsh
/opt/homebrew/bin/brew --version
/usr/local/bin/brew --version
```

Apple Silicon Mac 默认路径通常是：

```text
/opt/homebrew/bin/brew
```

## 2. 安装 Homebrew

如果系统没有 Homebrew，执行官方安装脚本：

```zsh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

安装过程中可能需要：

- 输入 macOS 管理员密码
- 按回车确认安装路径

注意：终端输入密码时不会显示字符，这是正常现象。

## 3. 配置 zsh 环境变量

安装完成后，把 Homebrew 加入 zsh 启动配置：

```zsh
echo 'eval "$(/opt/homebrew/bin/brew shellenv zsh)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
```

验证：

```zsh
brew --version
```

本次验证版本：

```text
Homebrew 5.1.10
```

## 4. 安装 GitHub CLI

```zsh
brew install gh
```

验证：

```zsh
gh --version
```

本次验证版本：

```text
gh version 2.92.0
```

## 5. 登录 GitHub

启动登录向导：

```zsh
gh auth login
```

推荐选择：

```text
Where do you use GitHub? GitHub.com
What is your preferred protocol for Git operations on this host? HTTPS
Authenticate Git with your GitHub credentials? Yes
How would you like to authenticate GitHub CLI? Login with a web browser
```

随后 CLI 会显示一次性设备码，并提示打开：

```text
https://github.com/login/device
```

在浏览器输入设备码并授权即可。

## 6. 验证登录状态

```zsh
gh auth status
```

成功时应看到类似输出：

```text
github.com
  ✓ Logged in to github.com account <your-github-username> (keyring)
  - Active account: true
  - Git operations protocol: https
```

本次配置完成的账号：

```text
flylion816
```

## 7. 本项目常用 GitHub 操作

查看当前登录用户：

```zsh
gh api user --jq .login
```

查看认证 token 是否可用：

```zsh
gh auth token
```

推送代码时，本项目可参考：

```zsh
git push https://$(gh auth token)@github.com/flylion816/Morning_Reading_Club.git main
```

更多提交规范见：

```text
docs/guides/GIT_WORKFLOW.md
```

## 常见问题

### `brew: command not found`

先执行：

```zsh
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
```

如果执行后有效，说明只是当前终端环境没加载。确认 `~/.zprofile` 包含：

```zsh
eval "$(/opt/homebrew/bin/brew shellenv zsh)"
```

### `gh auth login` 卡在浏览器授权

手动打开：

```text
https://github.com/login/device
```

输入终端里显示的一次性设备码，然后在 GitHub 页面确认授权。

### 不要记录密码或 token

文档里不要保存：

- macOS 管理员密码
- GitHub token
- `gh auth token` 的完整输出

这些敏感信息应由系统钥匙串或 GitHub CLI 管理。
