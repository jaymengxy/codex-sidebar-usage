# Codex Sidebar Usage

[![English](https://img.shields.io/badge/README-English-777777)](README.md) [![简体中文](https://img.shields.io/badge/README-简体中文-377cfb)](README.zh-CN.md)

一个轻量的非官方 macOS 小工具，让你在 **ChatGPT 桌面客户端的左侧导航栏** 中直接查看 **Codex 使用额度**，无需反复打开用量设置页面。

> 本项目由独立开发者维护，**并非 OpenAI 官方产品，也未获得 OpenAI 背书**。它使用桌面客户端的非公开调试接口，ChatGPT 更新后可能需要调整兼容性。

## 功能介绍

- **剩余额度：**展示 5 小时（5h）和每周（7d）的可用额度百分比。
- **彩色进度条：**5 小时额度为绿色，每周额度为橙色。
- **重置时间：**点击任一额度，可查看剩余比例、重置时间和最近更新时间；点击浮窗外部或按 **Esc** 关闭。
- **便捷刷新：**点击 ↻ 手动更新额度，也支持定期刷新和交互时按需刷新。
- **自动恢复：**ChatGPT 窗口重新加载后，额度组件可自动恢复。
- **两种启动方式：**使用终端一条命令启动，或安装可以从 Finder、Dock 双击打开的 macOS 原生 Launcher。

额度来自服务端用量快照，不保证每次请求后立即变化。无法获取某一时间窗口的数据时，将显示 `--`。

## 使用前准备

- **macOS 13 或更高版本**，ChatGPT 安装在 `/Applications/ChatGPT.app`。
- **Node.js 22 或更高版本**，可使用 `node --version` 检查。
- 如需生成原生 Launcher，还需要 **Xcode Command Line Tools**；未安装时可执行 `xcode-select --install`。
- 本机有可用的 Codex CLI / App Server，并使用你想查看额度的账号登录。

项目无需安装额外的第三方 npm 依赖。

### 获取项目

```bash
git clone https://github.com/jaymengxy/codex-sidebar-usage.git
cd codex-sidebar-usage
git switch feat/auto-launch-v0.3
```

目前原生 Launcher 版本位于 `feat/auto-launch-v0.3` 分支。你的 GitHub 账号需要有仓库访问权限。

## 方式一：使用终端启动

适合首次体验，或希望保留终端日志的使用者。

1. 先在 ChatGPT 中按 **Cmd+Q** 完全退出客户端。
2. 打开终端，进入项目目录，执行：

```bash
npm run launch
```

命令会自动以支持侧栏组件的方式启动 ChatGPT，同时开启额度监控。**不需要自己开启 CDP 或配置调试端口。**

使用期间保持这个终端窗口运行。需要停止监控时按 **Ctrl+C**，ChatGPT 本身不会退出。

如果 ChatGPT 已经通过普通方式启动，请先退出，再使用上面的命令启动，以便建立额度组件所需的本机连接。

## 方式二：生成原生 macOS Launcher

适合日常使用，无需每次打开终端，也可以将应用放到 Dock 中。

### 构建与安装

在项目目录运行：

```bash
npm run launcher:build
npm run launcher:install
```

然后退出已经通过普通方式启动的 ChatGPT，打开 Launcher：

```bash
open "$HOME/Applications/Codex Usage Launcher.app"
```

也可以通过 Finder 双击 **Codex Usage Launcher.app**，或者将它拖入 Dock。

Launcher 会自动启动 ChatGPT 和额度监控，并提供 **启动监控、停止监控、选择 Node…、选择 Codex…** 以及运行日志。

- 关闭 Launcher 的窗口不会停止监控；点击 Dock 图标即可重新打开窗口。
- 点击「停止监控」或使用 **Cmd+Q** 退出 Launcher，会停止它管理的监控进程，但不会关闭 ChatGPT。
- 如果需要更换 Node.js 或 Codex CLI 的执行文件，可以在 Launcher 中选择新路径。
- 更新项目代码后，需要重新执行 `npm run launcher:build` 和 `npm run launcher:install`。

Launcher 会打包额度监控所需的脚本，但仍使用本机安装的 Node.js 和 Codex CLI，**不会修改原版 ChatGPT.app**。

### Launcher 图标

构建时会读取**本机已安装的 ChatGPT 图标**，并在左下角加入绿色和橙色的双横向进度条，作为 Launcher 的识别标志。图标中的进度条并非实时额度；仓库也不会附带 ChatGPT 原始图标文件。

卸载 Launcher：

```bash
npm run launcher:uninstall
```

此命令只删除 `~/Applications` 中的 Launcher，不会删除 ChatGPT 或账号数据。

## 两种启动方式有什么区别？

| | 终端启动 | 原生 Launcher |
| --- | --- | --- |
| 适合 | 首次体验、开发调试 | 日常使用 |
| 准备工作 | Node.js 22+ | Node.js 22+、Xcode Command Line Tools |
| 启动方式 | `npm run launch` | 双击 Launcher.app |
| 是否需要保持终端运行 | 需要 | 不需要 |
| 停止监控 | Ctrl+C | 停止监控 / Cmd+Q |
| ChatGPT 重载后自动恢复 | 支持 | 支持 |

两种方式都会自动建立额度组件需要的本机调试连接。

## 常见问题

**ChatGPT 已经运行，却无法启动额度组件怎么办？**

先在 ChatGPT 中按 **Cmd+Q** 完全退出，然后通过 `npm run launch` 或原生 Launcher 打开。直接正常启动的 ChatGPT 不会自动开启本工具需要的调试连接。

**Launcher 找不到 Node.js 或 Codex 怎么办？**

在终端分别运行 `node --version` 和 `command -v codex`，检查安装与执行路径。通过 Launcher 的「选择 Node…」或「选择 Codex…」指定可执行文件，再启动监控。

**没有显示额度组件怎么办？**

确认 ChatGPT 主窗口已经打开、监控进程正在运行，且没有同时启动多个监控程序。可以完全退出 ChatGPT，再使用以上任一方式重新打开。

**额度数字与 ChatGPT 原生用量页面不一致怎么办？**

可以在项目目录执行 `npm run probe`，读取一次额度快照，与 ChatGPT 用量页面核对。还需要确认 Codex CLI 使用的是正确的登录账号；服务端数据也可能存在更新延迟。

**能否在登录 macOS 后自动启动？**

项目提供了额外的 LaunchAgent 登录启动方案，面向熟悉 macOS 的高级用户。不要将它与原生 Launcher 同时运行，使用前可参考[架构文档](docs/architecture.md)。

## 高级用法：连接已开启 CDP 的 ChatGPT

**使用前面两种推荐方式时，不需要执行本节操作。**

CDP 是 Chromium DevTools Protocol，即 Chromium 调试协议。本工具通过仅监听本机的 `127.0.0.1:9238` 端口连接 ChatGPT。普通方式打开的 ChatGPT 默认不会启用该端口，但 `npm run launch` 和原生 Launcher 都会自动处理。

如果希望自己启动 ChatGPT，再单独运行额度监控，可以采用以下步骤：

1. 完全退出 ChatGPT。
2. 在一个终端中使用带 CDP 参数的方式启动：

```bash
/usr/bin/open -a "/Applications/ChatGPT.app" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9238
```

3. 在另一个终端中进入项目目录，执行：

```bash
npm start
```

保持 `npm start` 运行，额度组件便能持续刷新。这种两进程方式主要用于高级操作，日常使用无需如此配置。

## 隐私、安全与兼容性

- CDP 具有较高的本机调试权限，只应监听 **127.0.0.1**，不要开放到局域网或公网。
- 额度通过本地 Codex App Server 的只读 `account/rateLimits/read` 接口获取；项目不会复制登录文件，也不会把登录 Token 注入 ChatGPT 界面。
- 原生 Launcher 在你的 Mac 上构建并进行本地签名，未进行面向公众分发的 Apple 公证。
- ChatGPT 的内部界面可能随客户端版本变化，不能保证始终兼容未来版本。

[技术架构](docs/architecture.md) · [兼容性说明](docs/compatibility.md) · [更新记录](CHANGELOG.md)
