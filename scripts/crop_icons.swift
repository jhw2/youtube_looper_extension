import AppKit

let paths = CommandLine.arguments.dropFirst()

guard !paths.isEmpty else {
    fputs("Usage: crop_icons.swift <png> [<png> ...]\n", stderr)
    exit(1)
}

for path in paths {
    guard let image = NSImage(contentsOfFile: path) else {
        fputs("Failed to load \(path)\n", stderr)
        continue
    }

    var proposedRect = NSRect(origin: .zero, size: image.size)
    guard let source = image.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
        fputs("Failed to decode \(path)\n", stderr)
        continue
    }

    let width = source.width
    let height = source.height
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo
    ) else {
        fputs("Failed to build context for \(path)\n", stderr)
        continue
    }

    context.draw(source, in: CGRect(x: 0, y: 0, width: width, height: height))

    guard let data = context.data else {
        fputs("Failed to read pixels for \(path)\n", stderr)
        continue
    }

    let pixels = data.bindMemory(to: UInt8.self, capacity: width * height * 4)
    var minX = width
    var minY = height
    var maxX = -1
    var maxY = -1

    for y in 0..<height {
        for x in 0..<width {
            let offset = (y * width + x) * 4
            let alpha = pixels[offset + 3]
            if alpha > 0 {
                minX = min(minX, x)
                minY = min(minY, y)
                maxX = max(maxX, x)
                maxY = max(maxY, y)
            }
        }
    }

    guard maxX >= minX, maxY >= minY else {
        fputs("No visible pixels in \(path)\n", stderr)
        continue
    }

    let cropRect = CGRect(
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
    )

    guard let cropped = source.cropping(to: cropRect) else {
        fputs("Failed to crop \(path)\n", stderr)
        continue
    }

    guard let scaledContext = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: width * 4,
        space: colorSpace,
        bitmapInfo: bitmapInfo
    ) else {
        fputs("Failed to build scaled context for \(path)\n", stderr)
        continue
    }

    scaledContext.interpolationQuality = .high
    scaledContext.clear(CGRect(x: 0, y: 0, width: width, height: height))
    scaledContext.draw(cropped, in: CGRect(x: 0, y: 0, width: width, height: height))

    guard let scaledImage = scaledContext.makeImage() else {
        fputs("Failed to render cropped image for \(path)\n", stderr)
        continue
    }

    let rep = NSBitmapImageRep(cgImage: scaledImage)
    guard let pngData = rep.representation(using: .png, properties: [:]) else {
        fputs("Failed to encode \(path)\n", stderr)
        continue
    }

    do {
        try pngData.write(to: URL(fileURLWithPath: path))
        print("Cropped \(path): \(Int(cropRect.width))x\(Int(cropRect.height)) -> \(width)x\(height)")
    } catch {
        fputs("Failed to write \(path): \(error)\n", stderr)
    }
}
