# Codex Sidebar Usage

[![English](https://img.shields.io/badge/README-English-777777)](README.md) [![简体中文](https://img.shields.io/badge/README-简体中文-377cfb)](README.zh-CN.md)

这是一个**非官方 macOS 小工具**，在 ChatGPT 桌面客户端集成的 Codex 左侧窄导航栏中，显示 **5 小时和每周剩余额度**。支持彩色进度条、重置时间、刷新以及窗口重载后自动恢复。

> **本项目与 OpenAI 无关联。** 它依赖 CDP 调试接口和 ChatGPT 的内部 DOM，并非官方插件机制；客户端升级后可能失效。建议仅在自己的电脑上使用。

## 功能

- 5h / 7d 剩余额度百分比（不是已使用比例）。
- 五小时进度条为**绿色**（`#16A34A`），每周进度条为**橙色**（`#D97706`）。
- **点击额度**弹出包含剩余比例、重置时间和更新时间的小浮窗；同一浮窗已经打开时不会重复创建；点击空白处或按 **Esc** 关闭。
- 鼠标悬停使用普通箭头，不再显示问号；仍支持悬停触发刷新（数据至少 60 秒未更新时）。
- 点击 ↻ 手动刷新，约每 120 秒自动刷新；额度是服务端快照，不是逐秒精确更新。
- ChatGPT 页面重载或侧栏元素重建后自动重新注入（约每 3 秒检测一次）。
- 可使用**终端一条命令启动**，也可安装真正的 **Swift/AppKit 原生 Launcher.app** 双击启动。

## 环境要求

- macOS 13+，ChatGPT 安装在 `/Applications/ChatGPT.app`。
- Node.js **22+**，可通过 `node --version` 检查；项目无需安装额外 npm 依赖。
- 如果需要构建原生 Launcher：安装 Xcode Command Line Tools（`xcode-select --install`）。
- 可用的 Codex CLI / App Server；要和客户端原生 Usage 页面核对额度及登录账户。
- CDP 仅使用本机地址 `127.0.0.1:9238`。

## 下载与准备

```bash
git clone git@github.com:jaymengxy/codex-sidebar-usage.git
cd codex-sidebar-usage
# 在 PR #2 合并前，最新开发版本位于此分支：
git switch feat/auto-launch-v0.3

node --version
npm run check
npm test
npm run probe
```

`npm run probe` 只读取额度，不注入客户端。请先和 ChatGPT 原生 Usage 页核对，再开始使用。

## 方式一：直接使用终端启动

首先按 **Cmd+Q** 完全退出 ChatGPT，然后在项目目录执行：

```bash
npm run launch
```

这条命令会在 ChatGPT 未运行时，以启用本机 CDP 的方式启动客户端，并连接额度组件。**终端保持运行**，才能持续刷新和恢复注入。按 **Ctrl+C** 停止监控，不会关闭 ChatGPT。

如果 ChatGPT **已经开启 CDP**，也可以单独执行 `npm start`。如果 ChatGPT 已正常运行但没有开启 CDP，需要先退出客户端；本工具不会强制结束或重复启动它。

高级排查：也可以手动启动 CDP，再从另一个终端运行监控：

```bash
/usr/bin/open -a "/Applications/ChatGPT.app" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9238
# 另一个终端窗口：
npm start
```

## 方式二：生成原生 macOS Launcher.app

此方式构建一个可以从 Finder 双击、固定到 Dock 的真正 macOS 应用。生成的 `.app` 会内置额度监控脚本，但仍需要本机安装 Node.js 22+ 和相应的 Codex CLI。**不会修改原版 ChatGPT.app**。

```bash
# 先停止之前运行的 npm start / npm run launch
# 如装过旧版登录启动项，先卸载：
npm run login:uninstall

npm run launcher:build
npm run launcher:install
open "$HOME/Applications/Codex Usage Launcher.app"
```

Launcher 窗口中提供 **启动监控、停止监控、选择 Node…、选择 Codex…** 和日志区域。关闭窗口不会停止监控，可以从 Dock 再次打开；**Cmd+Q 退出 Launcher 会停止它管理的监控进程，但不会退出 ChatGPT。**

**自定义图标：** 在本机构建时，从已安装的 ChatGPT.app 读取系统图标，然后在左下角绘制绿色和橙色双横向进度条。这只是固定的识别元素，**不是动态额度**。GitHub 仓库不包含 ChatGPT 的原始图标。代码更新或 Node 路径改变后，需要重新构建和安装。

```bash
npm run launcher:uninstall  # 只移除 ~/Applications/Codex Usage Launcher.app
```

生成的应用采用本机临时（ad-hoc）签名，没有 Apple Developer ID 公证。如果拷贝到其他电脑，可能需要在系统中额外允许打开。

### 两种方式的区别

| | 终端方式 | 原生 Launcher |
|---|---|---|
| 准备工作 | Node 22+ | Node 22+、Swift 构建工具 |
| 日常启动 | `npm run launch` | 双击 Launcher.app |
| 停止监控 | Ctrl+C | 点击停止监控 / Cmd+Q |
| 自动恢复注入 | 支持 | 支持 |
| ChatGPT 本体 | 原版客户端，开启 CDP | 原版客户端，开启 CDP |

## 常见问题

**1. `App Server 启动失败: ENOENT`**

Finder 或 Dock 启动的程序通常拿不到终端完整的 `PATH`。先在终端运行 `command -v codex`，再用 Launcher 的 **「选择 Codex…」** 指定该可执行文件，并重启监控。

**2. 使用 Launcher 时提示组织设置无法加载，直接打开 ChatGPT 却正常**

退出两个应用，更新代码并重新构建 Launcher。新版通过 `CSU_CODEX_CLI_PATH` 隔离额度助手自己的 Codex 路径，避免覆盖 ChatGPT 的 `CODEX_CLI_PATH`；ChatGPT 通过 macOS Launch Services 启动。**不要优先删除登录数据或重装客户端。**

**3. 点击「停止监控」后一直显示「正在停止监控」**

新版会在 SIGTERM 后立刻唤醒 Node 轮询，屏蔽停止过程中的迟到日志，并在收到进程结束通知后更新状态。等待超过保护时间仍未退出时会显示诊断提示，不会假称停止成功。

**4. 没有显示额度组件**

确认打开的是 ChatGPT 主窗口、可以看到 Codex 侧栏、端口 9238 可访问，并且没有多个助手进程争用。工具只会对 `app://-/index.html` 主渲染窗口注入，不会修改其他 WebView。

**5. 额度和官方用量不同**

先执行 `npm run probe`，与原生用量页面对照。不同 Codex CLI 可能使用另一个登录账号；服务端数据也可能有延迟。缺失的数据会显示 `--`，不会猜测。

**6. 开机自动启动**

旧的 `npm run login:install` 通过 LaunchAgent 开机启动，属于**实验功能**，不应与原生 Launcher 同时启用。它没有包含在此前的四项 macOS 实机恢复测试中。新原生 Launcher 的开机自启暂未作为正式交付功能。

## 兼容性与验收

v0.3 原生启动和重启恢复已在 2026-10-28 通过用户的 **4/4 项 macOS 实机测试**，ChatGPT 版本为 `26.1021.31345`。测试包括删除组件恢复、渲染器重载恢复、完全退出后双击重启、恢复后额度与刷新正确。详见[验收记录](docs/acceptance-v0.3.md)。

**本次新增的点击浮窗、停止状态和新图标尚未进行 macOS 实机验收**，请在重新构建后核对。参见[更新记录](CHANGELOG.md)。

## 安全与局限

- CDP 是强大的本机调试能力，只应监听 `127.0.0.1`，不要绑定 `0.0.0.0` 或公开到局域网。
- 额度数据通过本机 Codex App Server 的只读 `account/rateLimits/read` 获取。不复制登录文件、不提取 Token。
- 注入渲染器的数据只有额度百分比和重置时间；点击浮窗不会发起其他网络请求。
- 图标只在构建时使用本机 ChatGPT 图标，表明这是非官方辅助工具，并非 OpenAI 官方应用。
- ChatGPT 客户端升级、登录环境变化、安装位置变化可能影响兼容性。

[架构文档](docs/architecture.md) · [兼容性说明](docs/compatibility.md) · [更新日志](CHANGELOG.md)
