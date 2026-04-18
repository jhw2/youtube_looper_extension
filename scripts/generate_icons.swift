import CoreFoundation
import CoreGraphics
import CoreText
import Foundation
import ImageIO
import UniformTypeIdentifiers

let sizes = [16, 32, 48, 128]
let outputDirectory = URL(fileURLWithPath: "icons", isDirectory: true)

let backgroundStart = CGColor(red: 124 / 255, green: 140 / 255, blue: 1.0, alpha: 1.0)
let backgroundEnd = CGColor(red: 244 / 255, green: 114 / 255, blue: 182 / 255, alpha: 1.0)

func makeGradient(colors: [CGColor]) -> CGGradient {
    let space = CGColorSpaceCreateDeviceRGB()
    return CGGradient(colorsSpace: space, colors: colors as CFArray, locations: [0.0, 1.0])!
}

func addRoundedRect(_ context: CGContext, rect: CGRect, radius: CGFloat) {
    let path = CGPath(
        roundedRect: rect,
        cornerWidth: radius,
        cornerHeight: radius,
        transform: nil
    )
    context.addPath(path)
}

func drawAB(in context: CGContext, size: CGFloat) {
    let letters = "AB" as CFString
    let targetInset = size * 0.18
    let targetRect = CGRect(
        x: targetInset,
        y: targetInset,
        width: size - (targetInset * 2),
        height: size - (targetInset * 2)
    )

    let baseFontSize: CGFloat = 100
    let baseFont = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, baseFontSize, nil)
    let baseAttributes = [
        kCTFontAttributeName: baseFont,
        kCTKernAttributeName: baseFontSize * 0.02
    ] as CFDictionary
    let baseAttributed = CFAttributedStringCreate(nil, letters, baseAttributes)!
    let baseLine = CTLineCreateWithAttributedString(baseAttributed)

    let ascent = CTFontGetAscent(baseFont)
    let descent = CTFontGetDescent(baseFont)
    let baseHeight = ascent + descent
    let baseBounds = CTLineGetBoundsWithOptions(baseLine, [.excludeTypographicLeading])
    let widthScale = targetRect.width / baseBounds.width
    let heightScale = targetRect.height / baseHeight
    let fontSize = floor(baseFontSize * min(widthScale, heightScale))

    let font = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, fontSize, nil)
    let kern = max(0, fontSize * 0.02)
    let attributes = [
        kCTFontAttributeName: font,
        kCTForegroundColorAttributeName: CGColor(red: 1, green: 1, blue: 1, alpha: 0.98),
        kCTKernAttributeName: kern
    ] as CFDictionary
    let attributed = CFAttributedStringCreate(nil, letters, attributes)!
    let line = CTLineCreateWithAttributedString(attributed)

    context.saveGState()
    context.translateBy(x: 0, y: size)
    context.scaleBy(x: 1, y: -1)
    context.textPosition = .zero
    let imageBounds = CTLineGetImageBounds(line, context)
    let x = targetRect.midX - imageBounds.midX
    let baselineY = targetRect.midY - imageBounds.midY
    context.textPosition = CGPoint(x: x, y: baselineY)
    CTLineDraw(line, context)
    context.restoreGState()
}

func drawIcon(size: Int, contentInset: CGFloat = 0) -> CGImage? {
    let width = size
    let height = size
    let colorSpace = CGColorSpaceCreateDeviceRGB()

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return nil
    }

    let canvas = CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height))
    context.interpolationQuality = .high
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)
    context.clear(canvas)

    context.translateBy(x: 0, y: canvas.height)
    context.scaleBy(x: 1, y: -1)

    let backgroundRect = canvas.insetBy(dx: contentInset, dy: contentInset)
    let backgroundRadius = backgroundRect.width * 0.23

    context.saveGState()
    addRoundedRect(context, rect: backgroundRect, radius: backgroundRadius)
    context.clip()
    context.drawLinearGradient(
        makeGradient(colors: [backgroundStart, backgroundEnd]),
        start: CGPoint(x: backgroundRect.minX, y: backgroundRect.minY),
        end: CGPoint(x: backgroundRect.maxX, y: backgroundRect.maxY),
        options: []
    )
    context.restoreGState()

    context.saveGState()
    context.translateBy(x: contentInset, y: contentInset)
    drawAB(in: context, size: backgroundRect.width)
    context.restoreGState()

    return context.makeImage()
}

func writePNG(_ image: CGImage, to url: URL) throws {
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        throw NSError(domain: "generate_icons", code: 1, userInfo: [NSLocalizedDescriptionKey: "Failed to create PNG destination"])
    }
    CGImageDestinationAddImage(destination, image, nil)
    if !CGImageDestinationFinalize(destination) {
        throw NSError(domain: "generate_icons", code: 2, userInfo: [NSLocalizedDescriptionKey: "Failed to finalize PNG"])
    }
}

for size in sizes {
    guard let image = drawIcon(size: size) else {
        fputs("Failed to render icon\(size).png\n", stderr)
        continue
    }

    let url = outputDirectory.appendingPathComponent("icon\(size).png")
    do {
        try writePNG(image, to: url)
        print("Wrote \(url.path)")
    } catch {
        fputs("Failed to write \(url.path): \(error)\n", stderr)
    }
}

if let paddedImage = drawIcon(size: 128, contentInset: 16) {
    let paddedURL = outputDirectory.appendingPathComponent("icon128-padded.png")
    do {
        try writePNG(paddedImage, to: paddedURL)
        print("Wrote \(paddedURL.path)")
    } catch {
        fputs("Failed to write \(paddedURL.path): \(error)\n", stderr)
    }
} else {
    fputs("Failed to render icon128-padded.png\n", stderr)
}
