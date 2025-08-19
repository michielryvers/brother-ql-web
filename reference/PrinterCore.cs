using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Advanced;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace printer;

/// <summary>
/// Core, transport-agnostic printer logic: image processing, line packing,
/// command sequencing helpers, and status parsing. No USB or I/O here.
/// </summary>
public static class PrinterCore
{
    /// <summary>
    /// Create a dithered monochrome image sized to the printer's printable width.
    /// Matches the logic used in the existing Printer implementation.
    /// </summary>
    public static Image<L8> CreateDitheredImage(
        Image<Rgba32> image,
        int printableDots,
        int brightness = 150,
        int contrast = 80
    )
    {
        // Clone to avoid mutating the original passed-in image lifecycle.
        var src = image.Clone();

        // Always print with the longest side as the height
        if (src.Height < src.Width)
        {
            src.Mutate(x => x.Rotate(RotateMode.Rotate90));
        }

        var targetWidth = printableDots;
        var targetHeight = (int)Math.Round(src.Height * (targetWidth / (double)src.Width) * 2);

        src.Mutate(x => x.Resize(new Size(targetWidth, targetHeight)));

        // Adjust brightness and contrast
        if (brightness != 100 || contrast != 100)
        {
            src.Mutate(x => x.Brightness(brightness / 100f).Contrast(contrast / 100f));
        }

        // Convert to dithered monochrome
        var mono = src.CloneAs<L8>(); // single-channel luminance
        mono.Mutate(x => x.Dither(KnownDitherings.Atkinson, new[] { Color.Black, Color.White }));

        src.Dispose();
        return mono;
    }

    /// <summary>
    /// Convert a monochrome L8 image to printer raster lines (90 bytes per line),
    /// respecting left margin and MSB-first bit packing.
    /// </summary>
    public static IEnumerable<byte[]> ConvertToLines(
        Image<L8> mono,
        int printableDots,
        int leftMargin
    )
    {
        if (mono.Width != printableDots)
        {
            throw new InvalidOperationException("Image width does not match printable dots.");
        }

        for (int y = 0; y < mono.Height; y++)
        {
            var row = mono.DangerousGetPixelRowMemory(y);
            var line = new byte[90];

            for (int px = 0; px < printableDots; px++)
            {
                if (row.Span[px].PackedValue > 127) // white pixel
                {
                    continue;
                }

                int bit = leftMargin + px;
                int byteIdx = bit >> 3; // /8
                int bitInByte = 7 - (bit & 7); // MSB-first
                line[byteIdx] |= (byte)(1 << bitInByte);
            }

            yield return line;
        }
    }

    /// <summary>
    /// Parse a 32-byte status frame into a PrinterStatus.
    /// </summary>
    public static PrinterStatus ParseStatus(byte[] frame)
    {
        return PrinterStatus.Parse(frame);
    }

    /// <summary>
    /// Waits for printing to finish by repeatedly reading status frames via the provided delegate.
    /// Throws if an error status is encountered or on timeout.
    /// </summary>
    /// <param name="readStatusFrameAsync">A delegate that reads exactly 32 status bytes with a timeout (ms).</param>
    /// <param name="overall">Overall timeout.</param>
    public static async Task WaitForPrintToFinishAsync(
        Func<int, Task<byte[]>> readStatusFrameAsync,
        TimeSpan overall
    )
    {
        var deadline = DateTime.UtcNow + overall;
        bool sawCompleted = false;

        while (DateTime.UtcNow < deadline)
        {
            var frame = await readStatusFrameAsync(2000);
            var st = PrinterStatus.Parse(frame);

            if (st.StatusType == StatusType.ErrorOccurred)
            {
                throw new Exception($"Printer error: {st.Error1} / {st.Error2}");
            }

            if (st.StatusType == StatusType.PrintingCompleted)
            {
                sawCompleted = true;
            }

            if (sawCompleted)
            {
                return;
            }
        }

        throw new TimeoutException("Timed out waiting for idle state.");
    }
}
