import AppKit
import Foundation

enum L {
    static var isChinese: Bool { (Locale.preferredLanguages.first ?? "en").lowercased().hasPrefix("zh") }
    static func tr(_ zh: String, _ en: String) -> String { isChinese ? zh : en }
}

/// Native macOS front-end for the bundled, read-only Node.js quota bridge.
/// The helper owns ChatGPT/CDP startup; this app never modifies ChatGPT.app.
final class LauncherDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow!
    private var statusLabel: NSTextField!
    private var startButton: NSButton!
    private var stopButton: NSButton!
    private var nodeButton: NSButton!
    private var codexButton: NSButton!
    private var logTextView: NSTextView!
    private var helper: Process?
    private var stdoutPipe: Pipe?
    private var stderrPipe: Pipe?
    private var stopping = false
    private var stopWatchdog: DispatchWorkItem?

    private var resourceRoot: URL? { Bundle.main.resourceURL }
    private var runtimeRoot: URL? { resourceRoot?.appendingPathComponent("runtime", isDirectory: true) }
    private var nodePath: String? {
        let value = (UserDefaults.standard.string(forKey: "CSUNodeOverride") ??
            Bundle.main.object(forInfoDictionaryKey: "CSUNodePath") as? String)
        return value?.hasPrefix("/") == true ? value : nil
    }

    private var codexPath: String? {
        let value = (UserDefaults.standard.string(forKey: "CSUCodexOverride") ??
            Bundle.main.object(forInfoDictionaryKey: "CSUCodexPath") as? String)
        return value?.hasPrefix("/") == true ? value : nil
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        // Refresh the running app's Dock artwork explicitly. Existing pinned
        // Dock items may still need to be unpinned and pinned once after upgrade.
        if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "icns"),
           let iconImage = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = iconImage
        }
        buildWindow()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        startMonitor(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Closing the window leaves the helper running. Reopen from the Dock.
        false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Quit only our helper; never terminate the ChatGPT application.
        stopHelper()
    }

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 490, height: 340),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Codex Usage Launcher"
        window.minSize = NSSize(width: 420, height: 300)
        window.center()
        window.isReleasedWhenClosed = false

        let title = NSTextField(labelWithString: L.tr("Codex 侧栏额度", "Codex Sidebar Usage"))
        title.font = NSFont.boldSystemFont(ofSize: 19)

        statusLabel = NSTextField(labelWithString: L.tr("尚未启动", "Not started"))
        statusLabel.textColor = .secondaryLabelColor
        statusLabel.lineBreakMode = .byWordWrapping
        statusLabel.maximumNumberOfLines = 3

        startButton = NSButton(title: L.tr("启动监控", "Start Monitor"), target: self, action: #selector(startMonitor(_:)))
        startButton.bezelStyle = .rounded
        startButton.keyEquivalent = "\r"

        stopButton = NSButton(title: L.tr("停止监控", "Stop Monitor"), target: self, action: #selector(stopMonitor(_:)))
        stopButton.bezelStyle = .rounded
        stopButton.isEnabled = false

        nodeButton = NSButton(title: L.tr("选择 Node…", "Select Node…"), target: self, action: #selector(chooseNode(_:)))
        nodeButton.bezelStyle = .rounded
        codexButton = NSButton(title: L.tr("选择 Codex…", "Select Codex…"), target: self, action: #selector(chooseCodex(_:)))
        codexButton.bezelStyle = .rounded
        let buttons = NSStackView(views: [startButton, stopButton, nodeButton, codexButton])
        buttons.orientation = .horizontal
        buttons.spacing = 12

        let caption = NSTextField(labelWithString: L.tr("停止或退出本启动器不会退出 ChatGPT。日志只保存在当前窗口。", "Stopping or quitting this Launcher will not quit ChatGPT. Logs are kept only in this window."))
        caption.font = NSFont.systemFont(ofSize: 11)
        caption.textColor = .secondaryLabelColor
        caption.lineBreakMode = .byWordWrapping
        caption.maximumNumberOfLines = 2

        logTextView = NSTextView(frame: NSRect(x: 0, y: 0, width: 440, height: 180))
        logTextView.isEditable = false
        logTextView.isSelectable = true
        logTextView.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)
        logTextView.textColor = .textColor
        logTextView.backgroundColor = .textBackgroundColor
        logTextView.isVerticallyResizable = true
        logTextView.autoresizingMask = [.width]
        let scroll = NSScrollView(frame: .zero)
        scroll.hasVerticalScroller = true
        scroll.borderType = .bezelBorder
        scroll.documentView = logTextView

        let content = NSView(frame: .zero)
        window.contentView = content
        let views: [NSView] = [title, statusLabel, buttons, scroll, caption]
        for view in views {
            view.translatesAutoresizingMaskIntoConstraints = false
            content.addSubview(view)
        }
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: content.topAnchor, constant: 20),
            title.leadingAnchor.constraint(equalTo: content.leadingAnchor, constant: 22),
            title.trailingAnchor.constraint(lessThanOrEqualTo: content.trailingAnchor, constant: -22),
            statusLabel.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 10),
            statusLabel.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -22),
            buttons.topAnchor.constraint(equalTo: statusLabel.bottomAnchor, constant: 14),
            buttons.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            scroll.topAnchor.constraint(equalTo: buttons.bottomAnchor, constant: 15),
            scroll.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            scroll.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: -22),
            caption.topAnchor.constraint(equalTo: scroll.bottomAnchor, constant: 10),
            caption.leadingAnchor.constraint(equalTo: title.leadingAnchor),
            caption.trailingAnchor.constraint(equalTo: scroll.trailingAnchor),
            caption.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: -18),
            scroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 90),
        ])
    }

    private func setStatus(_ message: String, running: Bool) {
        statusLabel.stringValue = message
        startButton.isEnabled = !running
        stopButton.isEnabled = running
    }

    private func appendLog(_ message: String) {
        let line = message.trimmingCharacters(in: .newlines)
        guard !line.isEmpty else { return }
        // Avoid leaking arbitrarily large runtime diagnostic output into the UI.
        let safe = String(line.prefix(3000))
        let current = logTextView.string
        let result = (current + safe + "\n")
        logTextView.string = String(result.suffix(24000))
        logTextView.scrollToEndOfDocument(nil)
    }

    private func installReader(_ pipe: Pipe) {
        pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty else {
                handle.readabilityHandler = nil
                return
            }
            let message = String(decoding: data, as: UTF8.self)
            DispatchQueue.main.async { [weak self] in
                let humanLog = message.split(separator: "\n").filter { !$0.hasPrefix("CSU_EVENT:") }.joined(separator: "\n")
                if !humanLog.isEmpty { self?.appendLog(humanLog) }
                if self?.stopping == false && (message.contains("CSU_EVENT:connected") || message.contains("CSU_EVENT:injected")) {
                    self?.setStatus(L.tr("额度监控运行中 · 已连接 ChatGPT", "Monitor running · Connected to ChatGPT"), running: true)
                }
            }
        }
    }

    @objc private func chooseNode(_ sender: Any?) {
        let panel = NSOpenPanel()
        panel.title = L.tr("选择 Node.js 22+ 可执行文件", "Select the Node.js 22+ executable")
        panel.prompt = L.tr("使用这个 Node", "Use this Node")
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.showsHiddenFiles = true
        panel.beginSheetModal(for: window) { [weak self] result in
            guard result == .OK, let path = panel.url?.path else { return }
            guard FileManager.default.isExecutableFile(atPath: path) else {
                self?.setStatus(L.tr("所选文件不可执行，请选择 Node.js 22+ 的 node 文件。", "The selected file is not executable. Choose a Node.js 22+ binary."), running: false)
                return
            }
            UserDefaults.standard.set(path, forKey: "CSUNodeOverride")
            self?.appendLog(L.tr("已设置 Node 路径：\(path)", "Node path set: \(path)"))
            if self?.helper == nil { self?.setStatus(L.tr("Node 路径已设置，可以启动监控。", "Node path saved. Ready to start monitoring."), running: false) }
        }
    }

    @objc private func chooseCodex(_ sender: Any?) {
        let panel = NSOpenPanel()
        panel.title = L.tr("选择 Codex CLI 可执行文件（终端执行 command -v codex 可查找）", "Select Codex CLI executable (locate with command -v codex)")
        panel.prompt = L.tr("使用这个 Codex", "Use this Codex")
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        panel.showsHiddenFiles = true
        panel.beginSheetModal(for: window) { [weak self] result in
            guard result == .OK, let path = panel.url?.path else { return }
            guard FileManager.default.isExecutableFile(atPath: path) else {
                self?.setStatus(L.tr("所选 Codex 文件不可执行，请重新选择。", "The selected Codex file is not executable. Choose another file."), running: self?.helper != nil)
                return
            }
            UserDefaults.standard.set(path, forKey: "CSUCodexOverride")
            self?.appendLog(L.tr("已设置 Codex CLI 路径：\(path)", "Codex CLI path set: \(path)"))
            if self?.helper == nil {
                self?.setStatus(L.tr("Codex 路径已设置，点击启动监控。", "Codex path saved. Click Start Monitor."), running: false)
            } else {
                self?.appendLog(L.tr("请先停止监控、再启动，新的路径才会生效。", "Restart monitoring to apply the new Codex path."))
            }
        }
    }

    @objc private func startMonitor(_ sender: Any?) {
        guard helper == nil else { return }
        guard let node = nodePath, FileManager.default.isExecutableFile(atPath: node) else {
            setStatus(L.tr("Node.js 路径已失效：请在终端重新构建 Launcher（Node 22+）。", "Node.js path is invalid. Rebuild the Launcher with Node.js 22+ in Terminal."), running: false)
            return
        }
        guard let root = runtimeRoot,
              FileManager.default.fileExists(atPath: root.appendingPathComponent("scripts/launch.mjs").path) else {
            setStatus(L.tr("启动器缺少内置 JS 资源，请重新构建。", "The Launcher is missing bundled JS files. Please rebuild it."), running: false)
            return
        }
        // Older optional LaunchAgent manages the same bridge. Never run both.
        let oldAgent = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents/dev.paperauk.codex-sidebar-usage.plist")
        if FileManager.default.fileExists(atPath: oldAgent.path) {
            setStatus(L.tr("检测到旧版登录启动项。请先在项目中执行 npm run login:uninstall，再启动本应用。", "A legacy login agent was found. Run npm run login:uninstall before using this app."), running: false)
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: node)
        process.arguments = [root.appendingPathComponent("scripts/launch.mjs").path]
        process.currentDirectoryURL = root
        // Node is launched by its absolute path; existing login credentials stay in the OS account.
        var environment = ProcessInfo.processInfo.environment
        // Never send a helper-specific CLI override to ChatGPT itself.
        environment.removeValue(forKey: "CODEX_CLI_PATH")
        environment["CSU_LANG"] = L.isChinese ? "zh" : "en"
        if let codex = codexPath { environment["CSU_CODEX_CLI_PATH"] = codex }
        process.environment = environment
        let out = Pipe()
        let err = Pipe()
        process.standardOutput = out
        process.standardError = err
        stdoutPipe = out
        stderrPipe = err
        installReader(out)
        installReader(err)
        process.terminationHandler = { [weak self] finished in
            let code = finished.terminationStatus
            DispatchQueue.main.async { [weak self] in
                guard let self = self, self.helper === finished else { return }
                self.finishMonitorExit(code: code)
            }
        }
        do {
            try process.run()
            helper = process
            stopping = false
            setStatus(L.tr("启动中，正在检测 ChatGPT / CDP…", "Starting · Detecting ChatGPT / CDP…"), running: true)
            appendLog(L.tr("Launcher 已启动后台额度监控。", "Launcher started the background quota monitor."))
        } catch {
            out.fileHandleForReading.readabilityHandler = nil
            err.fileHandleForReading.readabilityHandler = nil
            stdoutPipe = nil
            stderrPipe = nil
            helper = nil
            setStatus(L.tr("无法启动 Node：\(error.localizedDescription)", "Unable to start Node: \(error.localizedDescription)"), running: false)
        }
    }

    /// One exit path for terminationHandler and delayed process-state updates.
    /// Avoid an everlasting “stopping…” label when a child exited before its callback.
    private func finishMonitorExit(code: Int32) {
        stopWatchdog?.cancel()
        stopWatchdog = nil
        helper = nil
        stdoutPipe?.fileHandleForReading.readabilityHandler = nil
        stderrPipe?.fileHandleForReading.readabilityHandler = nil
        stdoutPipe = nil
        stderrPipe = nil
        setStatus(stopping ? L.tr("监控已停止（ChatGPT 保持运行）", "Monitor stopped (ChatGPT remains open)") : L.tr("额度监控已退出（代码 \(code)），请查看日志", "Quota monitor exited (code \(code)); see log"), running: false)
        stopping = false
    }

    private func stopHelper() {
        guard let process = helper else { return }
        guard !stopping else { return } // A second click must not be necessary.
        stopping = true
        setStatus(L.tr("正在停止监控…", "Stopping monitor…"), running: true)
        stopButton.isEnabled = false

        if !process.isRunning {
            finishMonitorExit(code: process.terminationStatus)
            return
        }
        process.terminate() // SIGTERM affects only our Node bridge, never ChatGPT.
        let watchdog = DispatchWorkItem { [weak self, weak process] in
            guard let self = self, let process = process, self.helper === process else { return }
            if !process.isRunning {
                self.finishMonitorExit(code: process.terminationStatus)
            } else {
                // Do not claim stopped while the helper is still running.
                self.setStatus(L.tr("等待监控进程退出…如持续无响应请查看日志", "Waiting for the monitor to exit. Check the log if it stays running."), running: true)
                self.stopButton.isEnabled = true
                self.stopping = false
            }
        }
        stopWatchdog?.cancel()
        stopWatchdog = watchdog
        DispatchQueue.main.asyncAfter(deadline: .now() + 5, execute: watchdog)
    }

    @objc private func stopMonitor(_ sender: Any?) {
        stopHelper()
    }
}

let application = NSApplication.shared
let delegate = LauncherDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
