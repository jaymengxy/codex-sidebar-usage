import AppKit
import Foundation

// Generates a local composite icon from the user's INSTALLED ChatGPT.app icon.
// Never check in or redistribute the extracted proprietary ChatGPT artwork.
// The two fixed bars distinguish this unofficial launcher and are decorative.
guard CommandLine.arguments.count == 3 else {
    fputs("Usage: generate-icon <ChatGPT.app path> <output.png>\n", stderr)
    exit(2)
}
let chatGPTPath = CommandLine.arguments[1]
let outputPath = CommandLine.arguments[2]
guard FileManager.default.fileExists(atPath: chatGPTPath) else {
    fputs("找不到 ChatGPT.app，无法生成图标：\(chatGPTPath)\n", stderr)
    exit(1)
}
let side = 1024
guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
    isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0
), let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    fputs("无法创建 AppKit 图标画布\n", stderr)
    exit(1)
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = context
context.imageInterpolation = .high
let frame = NSRect(x: 0, y: 0, width: CGFloat(side), height: CGFloat(side))
NSColor.clear.setFill()
NSBezierPath(rect: frame).fill()

let appIcon = NSWorkspace.shared.icon(forFile: chatGPTPath)
appIcon.size = frame.size

// Match the *native* macOS app icon footprint. Apple's standard icon uses
// intentional transparent inset: do not normalize it to 98% of the canvas.
// Doing so enlarged the Launcher ~18% relative to ChatGPT in the Dock.
// We sample alpha ONLY to place the bars inside the original artwork.
guard let sample = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side,
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true,
    isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0
), let sampleContext = NSGraphicsContext(bitmapImageRep: sample) else {
    fputs("无法读取 ChatGPT 图标像素\n", stderr)
    exit(1)
}
NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = sampleContext
NSColor.clear.setFill()
NSBezierPath(rect: frame).fill()
appIcon.draw(in: frame, from: NSRect(origin: .zero, size: appIcon.size),
             operation: .sourceOver, fraction: 1.0)
sampleContext.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

var minX = side
var minY = side
var maxX = -1
var maxY = -1
for y in stride(from: 0, to: side, by: 4) {
    for x in stride(from: 0, to: side, by: 4) {
        // Ignore faint shadows; keep the visible tile bounds only.
        if let pixel = sample.colorAt(x: x, y: y), pixel.alphaComponent >= 0.08 {
            minX = min(minX, x)
            minY = min(minY, y)
            maxX = max(maxX, x)
            maxY = max(maxY, y)
        }
    }
}
let bounds = maxX >= minX && maxY >= minY
    ? NSRect(x: CGFloat(minX), y: CGFloat(minY),
             width: CGFloat(maxX - minX + 4), height: CGFloat(maxY - minY + 4))
    : frame.insetBy(dx: 96, dy: 96)

// Critical: use the exact unscaled image rectangle, matching the native icon.
appIcon.draw(in: frame, from: NSRect(origin: .zero, size: appIcon.size),
             operation: .sourceOver, fraction: 1.0)

// The badge is proportional to the *visible* native tile. Keep it comfortably
// inside the rounded-square artwork instead of enlarging the square itself.
let badgeWidth = bounds.width * 0.45
let badgeHeight = bounds.height * 0.19
let badgeX = bounds.minX + bounds.width * 0.045
let badgeY = bounds.minY + bounds.height * 0.04
let badge = NSRect(x: badgeX, y: badgeY, width: badgeWidth, height: badgeHeight)
let plate = NSBezierPath(roundedRect: badge,
                         xRadius: badge.height * 0.20, yRadius: badge.height * 0.20)
NSColor(calibratedWhite: 0.07, alpha: 0.79).setFill()
plate.fill()

func bar(row: Int, fraction: CGFloat, red: CGFloat, green: CGFloat, blue: CGFloat) {
    let barWidth = badge.width * 0.78
    let barHeight = badge.height * 0.16
    let barX = badge.minX + badge.width * 0.11
    let barY = badge.minY + badge.height * (row == 0 ? 0.59 : 0.29)
    let track = NSBezierPath(roundedRect: NSRect(x: barX, y: barY, width: barWidth, height: barHeight),
                             xRadius: barHeight / 2, yRadius: barHeight / 2)
    NSColor(calibratedWhite: 1, alpha: 0.28).setFill()
    track.fill()
    let fill = NSBezierPath(roundedRect: NSRect(x: barX, y: barY, width: barWidth * fraction, height: barHeight),
                            xRadius: barHeight / 2, yRadius: barHeight / 2)
    NSColor(calibratedRed: red, green: green, blue: blue, alpha: 1).setFill()
    fill.fill()
}
bar(row: 0, fraction: 0.74, red: 22/255, green: 163/255, blue: 74/255) // 5h #16A34A
bar(row: 1, fraction: 0.48, red: 217/255, green: 119/255, blue: 6/255) // 7d #D97706


context.flushGraphics()
NSGraphicsContext.restoreGraphicsState()
guard let data = bitmap.representation(using: .png, properties: [:]) else {
    fputs("图标 PNG 编码失败\n", stderr)
    exit(1)
}
do {
    try data.write(to: URL(fileURLWithPath: outputPath), options: .atomic)
} catch {
    fputs("图标写入失败：\(error.localizedDescription)\n", stderr)
    exit(1)
}
