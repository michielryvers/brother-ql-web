using LibUsbDotNet.LibUsb;
using LibUsbDotNet.Main;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace printer;

/// <summary>
/// Concrete printer that uses LibUsbDotNet for transport, delegating image and command logic to PrinterCore.
/// </summary>
public class LibUsbPrinter : IDisposable
{
    private readonly UsbContext _usbContext;
    private readonly IUsbDevice _device;
    private readonly UsbEndpointReader _reader;
    private readonly UsbEndpointWriter _writer;

    public PrinterStatus Status { get; private set; }

    public LibUsbPrinter()
    {
        _usbContext = new UsbContext();
        _device = _usbContext.Find(new UsbDeviceFinder { Vid = 0x04F9 });
        _device.Open();
        DetachKernelDriver();
        _device.SetConfiguration(1);
        _device.ClaimInterface(0);

        _reader = _device.OpenEndpointReader(ReadEndpointID.Ep01);
        _writer = _device.OpenEndpointWriter(WriteEndpointID.Ep02);

        Status = ReadStatus();
    }

    public PrinterStatus ReadStatus()
    {
        _writer.Write(Commands.RequestStatus, 10000, out var _);
        var frame = ReadStatusFrame(10000);
        return Status = PrinterCore.ParseStatus(frame);
    }

    public async Task<PrinterStatus> ReadStatusAsync()
    {
        await _writer.WriteAsync(Commands.RequestStatus, 10000);
        var frame = await ReadStatusFrameAsync(10000);
        return Status = PrinterCore.ParseStatus(frame);
    }

    public async Task<Image<L8>> CreateDitheredImage(
        Image<Rgba32> image,
        int brightness = 150,
        int contrast = 80
    )
    {
        return await Task.FromResult(
            PrinterCore.CreateDitheredImage(image, Status.PrintableDots, brightness, contrast)
        );
    }

    public async Task PrintDitheredImage(Image<L8> ditheredImage)
    {
        var lines = PrinterCore.ConvertToLines(
            ditheredImage,
            Status.PrintableDots,
            Status.LeftMargin
        );
        await SendLines(lines);
    }

    public async Task PrintImage(Image<Rgba32> image)
    {
        using var mono = PrinterCore.CreateDitheredImage(image, Status.PrintableDots);
        var lines = PrinterCore.ConvertToLines(mono, Status.PrintableDots, Status.LeftMargin);
        await SendLines(lines);
    }

    private async Task SendLines(IEnumerable<byte[]> lines)
    {
        await _writer.WriteAsync(Commands.Initialize, 10000);

        Status = await ReadStatusAsync();

        if (Status.PhaseType != PhaseType.WaitingToReceive)
        {
            throw new Exception($"Printer error: {Status.Error1} / {Status.Error2}");
        }

        await _writer.WriteAsync(Commands.SwitchToRasterMode, 10000);
        await _writer.WriteAsync(Commands.NoCompression, 10000);
        await _writer.WriteAsync(Commands.PrintInformation(Status, lines.Count()), 10000);
        await _writer.WriteAsync(Commands.AutoCut, 10000);
        await _writer.WriteAsync(Commands.Set600DpiAndCut, 10000);
        if (Status.MediaType == MediaType.Continuous)
        {
            await _writer.WriteAsync(Commands.SetMarginAmount, 10000);
        }
        foreach (var line in lines)
        {
            await _writer.WriteAsync(Commands.RasterData(line), 10000);
        }
        await _writer.WriteAsync(Commands.PrintWithFeeding, 10000);

        await PrinterCore.WaitForPrintToFinishAsync(ReadStatusFrameAsync, TimeSpan.FromSeconds(30));
    }

    private byte[] ReadStatusFrame(int timeoutMs = 2000)
    {
        var buf = new byte[32];
        int have = 0;

        while (have < buf.Length)
        {
            int want = buf.Length - have; // ask for only what's left
            var ec = _reader.Read(buf, have, want, timeoutMs, out var read);
            if (ec == LibUsbDotNet.Error.Timeout && read == 0)
            {
                continue; // keep waiting
            }
            if (ec != LibUsbDotNet.Error.Success)
            {
                throw new Exception($"Read failed: {ec}");
            }
            have += read;
        }
        return buf;
    }

    private async Task<byte[]> ReadStatusFrameAsync(int timeoutMs = 2000)
    {
        return await Task.Run(() => ReadStatusFrame(timeoutMs));
    }

    private void DetachKernelDriver()
    {
        var handleProp = _device.GetType().GetProperty("UsbHandle");
        var devHandle = handleProp?.GetValue(_device);
        var monoApiType = Type.GetType("LibUsbDotNet.LibUsb.MonoUsbApi, LibUsbDotNet");
        var kernelActive = monoApiType?.GetMethod("libusb_kernel_driver_active");
        var detach = monoApiType?.GetMethod("libusb_detach_kernel_driver");

        if (kernelActive is not null && detach is not null && devHandle is not null)
        {
            var active = (int)kernelActive.Invoke(null, [devHandle, 0])!;
            if (active == 1)
            {
                detach.Invoke(null, [devHandle, 0]);
                Thread.Sleep(50);
            }
        }
    }

    public void Dispose()
    {
        _device.ReleaseInterface(0);
        _device.Close();
        _usbContext.Dispose();
        GC.SuppressFinalize(this);
    }
}
