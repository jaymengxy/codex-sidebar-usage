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

// macOS application icons often contain transparent safe-area padding. Drawing
// their entire bitmap into 1024x1024 preserves that inset and makes the icon
// appear noticeably smaller than the tile shown in Finder and the Dock.
// Sample the ALPHA footprint first, then scale the visible artwork to fit.
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
let sampleStep = 4
for y in stride(from: 0, to: side, by: sampleStep) {
    for x in stride(from: 0, to: side, by: sampleStep) {
        // Ignore faint shadow pixels when computing the visible artwork bounds.
        if let pixel = sample.colorAt(x: x, y: y), pixel.alphaComponent >= 0.08 {
            minX = min(minX, x)
            minY = min(minY, y)
            maxX = max(maxX, x)
            maxY = max(maxY, y)
        }
    }
}
var iconRect = frame
if maxX >= minX && maxY >= minY {
    let visibleWidth = CGFloat(maxX - minX + sampleStep)
    let visibleHeight = CGFloat(maxY - minY + sampleStep)
    let visibleSize = max(visibleWidth, visibleHeight)
    // Aim for ~98% occupancy without clipping the visible rounded silhouette.
    let scale = max(1.0, min(CGFloat(side - 20) / visibleSize, 1.60))
    let centerX = CGFloat(minX + maxX + sampleStep) / 2
    let centerY = CGFloat(minY + maxY + sampleStep) / 2
    iconRect = NSRect(x: CGFloat(side) / 2 - centerX * scale,
                      y: CGFloat(side) / 2 - centerY * scale,
                      width: CGFloat(side) * scale,
                      height: CGFloat(side) * scale)
    fputs("图标可见区域：\(Int(visibleWidth))×\(Int(visibleHeight))，缩放：\(String(format: "%.2f", Double(scale)))x\n", stderr)
}
appIcon.draw(in: iconRect, from: NSRect(origin: .zero, size: appIcon.size),
             operation: .sourceOver, fraction: 1.0)

// Lower-left 2-row bar plate. The fills are static visual identifiers,
// not current account quota; data lives in the actual sidebar widget.
let plate = NSBezierPath(roundedRect: NSRect(x: 82, y: 85, width: 450, height: 210),
                         xRadius: 47, yRadius: 47)
NSColor(calibratedWhite: 0.07, alpha: 0.79).setFill()
plate.fill()

func bar(y: CGFloat, fraction: CGFloat, red: CGFloat, green: CGFloat, blue: CGFloat) {
    let x: CGFloat = 126
    let width: CGFloat = 356
    let height: CGFloat = 34
    let track = NSBezierPath(roundedRect: NSRect(x: x, y: y, width: width, height: height),
                              xRadius: height / 2, yRadius: height / 2)
    NSColor(calibratedWhite: 1, alpha: 0.28).setFill()
    track.fill()
    let fill = NSBezierPath(roundedRect: NSRect(x: x, y: y, width: width * fraction, height: height),
                             xRadius: height / 2, yRadius: height / 2)
    NSColor(calibratedRed: red, green: green, blue: blue, alpha: 1).setFill()
    fill.fill()
}
bar(y: 207, fraction: 0.74, red: 22/255, green: 163/255, blue: 74/255) // 5h #16A34A
bar(y: 145, fraction: 0.48, red: 217/255, green: 119/255, blue: 6/255) // 7d #D97706

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
