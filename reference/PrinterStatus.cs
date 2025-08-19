using System;
using System.Collections.Generic;

namespace printer;

[Flags]
public enum ErrorInfo1 : byte
{
    None = 0,
    NoMediaWhenPrinting = 0x01,
    EndOfMedia_DieCutOnly = 0x02,
    TapeCutterJam = 0x04,

    // 0x08 not used
    MainUnitInUse = 0x10, // QL-560/650TD/1050

    // 0x20 not used
    // 0x40 not used
    FanDoesntWork = 0x80, // QL-1050/1060N
}

[Flags]
public enum ErrorInfo2 : byte
{
    None = 0,

    // 0x01, 0x02 not used
    TransmissionError = 0x04,

    // 0x08 not used
    CoverOpenedWhilePrinting = 0x10, // except QL-500

    // 0x20 not used
    CannotFeed = 0x40,
    SystemError = 0x80,
}

public enum MediaType : byte
{
    None = 0x00,
    Continuous = 0x0A,
    DieCut = 0x0B,
}

public enum StatusType : byte
{
    Reply = 0x00,
    PrintingCompleted = 0x01,
    ErrorOccurred = 0x02,
    Notification = 0x05,
    PhaseChange = 0x06,
}

public enum PhaseType : byte
{
    WaitingToReceive = 0x00,
    PrintingState = 0x01,
}

public enum ModelCode : byte
{
    Unknown = 0x00,
    QL500_550 = (byte)'O', // 0x4F
    QL560 = (byte)'1', // 0x31
    QL570 = (byte)'2', // 0x32
    QL580N = (byte)'3', // 0x33
    QL650TD = (byte)'Q', // 0x51
    QL700 = (byte)'5', // 0x35
    QL1050 = (byte)'P', // 0x50
    QL1060N = (byte)'4', // 0x34
}

public sealed record PrinterStatus(
    bool HeaderOk,
    ModelCode Model,
    byte MediaWidthMm,
    MediaType MediaType,
    byte MediaLengthMm,
    ErrorInfo1 Error1,
    ErrorInfo2 Error2,
    StatusType StatusType,
    PhaseType PhaseType,
    ushort PhaseNumber,
    byte Notification,
    int LeftMargin,
    int PrintableDots,
    int RightMargin
)
{
    public bool MediaPresent =>
        MediaType != MediaType.None && !Error1.HasFlag(ErrorInfo1.NoMediaWhenPrinting);

    public string? TryMapDkSupply()
    {
        // Simple examples; extend as needed
        var key = (MediaType, MediaWidthMm, MediaLengthMm);
        return _dkMap.TryGetValue(key, out var name) ? name : null;
    }

    private static readonly Dictionary<(MediaType, int, int), string> _dkMap = new()
    {
        { (MediaType.Continuous, 12, 0), "DK-22214 12mm continuous" },
        { (MediaType.Continuous, 29, 0), "DK-22210 29mm continuous" },
        { (MediaType.Continuous, 38, 0), "DK-22225 38mm continuous" },
        { (MediaType.Continuous, 50, 0), "DK-22223 50mm continuous" },
        { (MediaType.Continuous, 54, 0), "DK-22211 54mm continuous" },
        { (MediaType.Continuous, 62, 0), "DK-22205 62mm continuous" },
        { (MediaType.DieCut, 17, 54), "DK-1208 17×54" },
        { (MediaType.DieCut, 29, 90), "DK-1201 29×90" },
        { (MediaType.DieCut, 38, 90), "DK-1202 38×90" },
        { (MediaType.DieCut, 62, 29), "DK-1209 62×29" },
        { (MediaType.DieCut, 62, 100), "DK-1218 62×100" },
        { (MediaType.DieCut, 24, 24), "Round Ø24" },
    };

    // Derived from the PDF tables (Raster Command Reference, Print Data tables)
    // key: (MediaType, width-mm, length-mm(0 for continuous)) -> (LeftMargin, PrintablePins, RightMargin)
    private static readonly Dictionary<
        (MediaType, int, int),
        (int left, int printable, int right)
    > _pinLayout = new()
    {
        // Continuous length tape
        { (MediaType.Continuous, 12, 0), (585, 106, 29) },
        { (MediaType.Continuous, 29, 0), (408, 306, 6) },
        { (MediaType.Continuous, 38, 0), (295, 413, 12) },
        { (MediaType.Continuous, 50, 0), (154, 554, 12) },
        { (MediaType.Continuous, 54, 0), (130, 590, 0) },
        { (MediaType.Continuous, 62, 0), (12, 696, 12) },
        // Die-cut labels (WxH mm)
        { (MediaType.DieCut, 17, 54), (555, 165, 0) },
        { (MediaType.DieCut, 17, 87), (555, 165, 0) },
        { (MediaType.DieCut, 23, 23), (442, 236, 42) },
        { (MediaType.DieCut, 29, 42), (408, 306, 6) },
        { (MediaType.DieCut, 29, 90), (408, 306, 6) },
        { (MediaType.DieCut, 38, 90), (295, 413, 12) },
        { (MediaType.DieCut, 39, 48), (289, 425, 6) },
        { (MediaType.DieCut, 52, 29), (142, 578, 0) },
        { (MediaType.DieCut, 54, 29), (59, 602, 59) },
        { (MediaType.DieCut, 60, 86), (24, 672, 24) },
        { (MediaType.DieCut, 62, 29), (12, 696, 12) },
        { (MediaType.DieCut, 62, 100), (12, 696, 12) },
        // Round (Diameter mm => width==length)
        { (MediaType.DieCut, 12, 12), (513, 94, 113) },
        { (MediaType.DieCut, 24, 24), (442, 236, 42) },
        { (MediaType.DieCut, 58, 58), (51, 618, 51) },
    };

    private static bool TryGetPinLayout(
        MediaType mt,
        int widthMm,
        int lengthMm,
        out (int left, int printable, int right) pins
    )
    {
        // Exact match first
        if (
            _pinLayout.TryGetValue(
                (mt, widthMm, mt == MediaType.Continuous ? 0 : lengthMm),
                out pins
            )
        )
            return true;

        // Fallback: for die-cut, ignore length if an entry with this width exists and the values are consistent
        if (mt == MediaType.DieCut)
        {
            foreach (var kvp in _pinLayout)
            {
                if (kvp.Key.Item1 == MediaType.DieCut && kvp.Key.Item2 == widthMm)
                {
                    pins = kvp.Value;
                    return true;
                }
            }
        }

        // Fallback: for continuous, match just width
        if (mt == MediaType.Continuous)
        {
            if (_pinLayout.TryGetValue((mt, widthMm, 0), out pins))
                return true;
        }

        pins = default;
        return false;
    }

    public static PrinterStatus Parse(ReadOnlySpan<byte> s)
    {
        if (s.Length < 32)
            throw new ArgumentException("Status must be 32 bytes.", nameof(s));

        // Header sanity: 0:0x80, 1:0x20, 2:'B'
        bool headerOk = s[0] == 0x80 && s[1] == 0x20 && s[2] == 0x42;

        var model = Enum.IsDefined(typeof(ModelCode), (byte)s[4])
            ? (ModelCode)s[4]
            : ModelCode.Unknown;

        var mediaWidth = s[10];
        var mediaType = (MediaType)s[11];
        var mediaLength = s[17];

        var err1 = (ErrorInfo1)s[8];
        var err2 = (ErrorInfo2)s[9];

        var statusType = (StatusType)s[18];
        var phaseType = (PhaseType)s[19];
        ushort phaseNo = (ushort)((s[20] << 8) | s[21]);

        byte notif = s[22];

        // Compute margins/pins based on media
        int left = 0,
            printable = 0,
            right = 0;
        if (TryGetPinLayout(mediaType, mediaWidth, mediaLength, out var p))
        {
            left = p.left;
            printable = p.printable;
            right = p.right;
        }

        return new PrinterStatus(
            headerOk,
            model,
            mediaWidth,
            mediaType,
            mediaLength,
            err1,
            err2,
            statusType,
            phaseType,
            phaseNo,
            notif,
            left,
            printable,
            right
        );
    }
}
