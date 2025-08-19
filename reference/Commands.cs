using printer;

public static class Commands
{
    // Request status: ESC i S
    public static byte[] RequestStatus = [0x1B, (byte)'i', (byte)'S'];

    // Initialize: ESC @
    public static byte[] Initialize = [0x1B, (byte)'@'];

    // Switch to Raster mode: ESC i a 01
    public static byte[] SwitchToRasterMode = [0x1B, (byte)'i', (byte)'a', 0x01];

    // Print Information: ESC i z {n1..n10}
    public static byte[] PrintInformation(PrinterStatus status, int lines)
    {
        bool isDieCut = status.MediaType == MediaType.DieCut;

        byte n1 = 0;
        n1 |= 0x80; // printer recovery always on (recommended)
        n1 |= 0x02; // KIND valid
        n1 |= 0x04; // WIDTH valid
        if (isDieCut)
        {
            n1 |= 0x08; // LENGTH valid ONLY for die-cut
        }

        byte n2 = (byte)status.MediaType; // 0x0A continuous, 0x0B die-cut
        byte n3 = status.MediaWidthMm; // width in mm
        byte n4 = isDieCut ? status.MediaLengthMm : (byte)0; // continuous: 0

        return
        [
            0x1B,
            (byte)'i',
            (byte)'z',
            n1,
            n2,
            n3,
            n4,
            (byte)(lines & 0xFF),
            (byte)((lines >> 8) & 0xFF),
            (byte)((lines >> 16) & 0xFF),
            (byte)((lines >> 24) & 0xFF), // n5..n8: raster count (0=unspecified over USB)
            0x00,
            0x00, // n9,n10
        ];
    }

    // Auto Cut: ESC i M @
    public static byte[] AutoCut = [0x1B, (byte)'i', (byte)'M', (byte)'@'];

    // Set to 600dpi + cut at end: ESC i K H
    public static byte[] Set600DpiAndCut = [0x1B, (byte)'i', (byte)'K', (byte)'H'];

    // Set to 600dpi + cut at end: ESC i K H
    public static byte[] CutAtEnd = [0x1B, (byte)'i', (byte)'K', 0x08];

    // Set margin amount: ESC i d 0x23 0x00
    public static byte[] SetMarginAmount = [0x1B, (byte)'i', (byte)'d', 0x23, 0x00];

    // Raster data: g 0x00 0x5A {byte[] rasterData}
    public static byte[] RasterData(byte[] rasterData)
    {
        // MaskMargins62mm(rasterData);
        var length = rasterData.Length;
        var command = new byte[3 + length];
        command[0] = (byte)'g';
        command[1] = 0x00; // Raster data type
        command[2] = 0x5A; // 90 bytes of raster data
        Array.Copy(rasterData, 0, command, 3, length);
        return command;
    }

    // End of page: 0x0C
    public static byte[] EndOfPage = [0x0C];

    // Print With Feeding: 0x1A
    public static byte[] PrintWithFeeding = [0x1A];

    // No Compression: M 0x00
    public static byte[] NoCompression = [0x4D, 0x00];

    // Automatic Status Notification: ESC i ! 0x00
    public static byte[] AutomaticStatusNotification = [0x1B, (byte)'i', (byte)'!', 0x00];

    // Cut each 1: ESC i A 0x01
    public static byte[] CutEach1 = [0x1B, (byte)'i', (byte)'A', 0x01];

    static void MaskMargins62mm(
        byte[] line /* len 90 */
    )
    {
        // Left 12 bits: byte0 all 0, top 4 bits of byte1 0
        line[0] = 0x00;
        line[1] = 0x00;
        line[2] = 0x00;
        line[3] &= 0x0F; // keep only low 4 bits

        // Right 12 bits: bottom 4 bits of byte88 0, byte89 all 0
        line[86] &= 0xF0; // keep only high 4 bits
        line[87] = 0x00;
        line[88] = 0x00;
        line[89] = 0x00;
    }
}
