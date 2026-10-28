# 发布仓库（macOS）

这个项目目前只是布局原型。建议初次创建为私有仓库，功能稳定后再评估是否公开。

首先将聊天中下载的 `codex-sidebar-usage-v0.1.0.zip` 放在 `~/Downloads/`，然后执行：

```bash
mkdir -p ~/Code
unzip ~/Downloads/codex-sidebar-usage-v0.1.0.zip -d ~/Code
cd ~/Code/codex-sidebar-usage
npm run check
git init -b main
git add .
git commit -m "chore: bootstrap Codex sidebar usage v0.1 prototype"
gh auth status
gh repo create jaymengxy/codex-sidebar-usage --private --source=. --remote=origin --push
```

如果 `gh auth status` 显示未登录，先执行 `gh auth login`。如果命令找不到 `gh`，先安装 GitHub CLI。上述 `gh repo create` 只在你本机执行后才会真正创建 GitHub 仓库。

随后可以在 GitHub 默认 `main` 分支上维护验收通过的代码；v0.1 的 UI 手动验收结束后，再建立 v0.2 的真实额度数据适配开发分支。
