using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class SubtitleBridgeSetup
{
    private const string FooterMagic = "SBSETUP1";
    private static int exitCode = 1;

    [STAThread]
    private static int Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        if (Environment.GetEnvironmentVariable("SUBTITLE_BRIDGE_SETUP_HEADLESS") == "1")
        {
            return RunSetup();
        }

        using (var form = CreateProgressForm())
        {
            form.Shown += async (sender, args) =>
            {
                exitCode = await Task.Run(() => RunSetup());
                form.Close();
            };

            Application.Run(form);
        }

        if (exitCode != 0)
        {
            MessageBox.Show(
                "Subtitle Bridge could not be installed. Close any running Subtitle Bridge window, check your internet connection, and try again.",
                "Subtitle Bridge setup failed",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }

        return exitCode;
    }

    private static Form CreateProgressForm()
    {
        var form = new Form
        {
            Text = "Subtitle Bridge Setup",
            Width = 470,
            Height = 155,
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MaximizeBox = false,
            MinimizeBox = false,
            ControlBox = false,
            TopMost = true
        };

        var label = new Label
        {
            Left = 24,
            Top = 20,
            Width = 405,
            Height = 42,
            Text = "Installing Subtitle Bridge. This may take a minute while the media runtimes are prepared."
        };

        var progress = new ProgressBar
        {
            Left = 24,
            Top = 74,
            Width = 405,
            Height = 20,
            Style = ProgressBarStyle.Marquee,
            MarqueeAnimationSpeed = 25
        };

        form.Controls.Add(label);
        form.Controls.Add(progress);
        return form;
    }

    private static int RunSetup()
    {
        var extractRoot = Path.Combine(
            Path.GetTempPath(),
            "SubtitleBridge-setup-" + Guid.NewGuid().ToString("N")
        );

        try
        {
            Directory.CreateDirectory(extractRoot);
            var payloadZip = Path.Combine(extractRoot, "payload.zip");
            ExtractAppendedPayload(payloadZip);

            ZipFile.ExtractToDirectory(payloadZip, extractRoot);
            File.Delete(payloadZip);

            var packageDir = Path.Combine(extractRoot, "SubtitleBridge-win-x64");
            var installer = Path.Combine(packageDir, "Install-SubtitleBridge.ps1");
            if (!File.Exists(installer))
            {
                return 2;
            }

            var startInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments =
                    "-NoProfile -ExecutionPolicy Bypass -File " + QuoteArgument(installer),
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            using (var process = Process.Start(startInfo))
            {
                if (process == null)
                {
                    return 3;
                }

                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch
        {
            return 4;
        }
        finally
        {
            try
            {
                if (Directory.Exists(extractRoot))
                {
                    Directory.Delete(extractRoot, true);
                }
            }
            catch
            {
                // Temporary cleanup must not hide the setup result.
            }
        }
    }

    private static void ExtractAppendedPayload(string destinationPath)
    {
        var executablePath = Process.GetCurrentProcess().MainModule.FileName;
        using (var source = new FileStream(executablePath, FileMode.Open, FileAccess.Read, FileShare.Read))
        {
            if (source.Length < 16)
            {
                throw new InvalidDataException("Setup payload footer is missing.");
            }

            source.Seek(-16, SeekOrigin.End);
            var footer = new byte[16];
            ReadExactly(source, footer, 0, footer.Length);

            var magic = Encoding.ASCII.GetString(footer, 0, 8);
            if (!string.Equals(magic, FooterMagic, StringComparison.Ordinal))
            {
                throw new InvalidDataException("Setup payload footer is invalid.");
            }

            var payloadLength = BitConverter.ToInt64(footer, 8);
            var payloadStart = source.Length - 16 - payloadLength;
            if (payloadLength <= 0 || payloadStart < 0)
            {
                throw new InvalidDataException("Setup payload length is invalid.");
            }

            source.Seek(payloadStart, SeekOrigin.Begin);
            using (var destination = new FileStream(
                destinationPath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.None
            ))
            {
                CopyExactly(source, destination, payloadLength);
            }
        }
    }

    private static void CopyExactly(Stream source, Stream destination, long length)
    {
        var buffer = new byte[1024 * 1024];
        long remaining = length;

        while (remaining > 0)
        {
            var requested = (int)Math.Min(buffer.Length, remaining);
            var read = source.Read(buffer, 0, requested);
            if (read <= 0)
            {
                throw new EndOfStreamException("Setup payload ended unexpectedly.");
            }

            destination.Write(buffer, 0, read);
            remaining -= read;
        }
    }

    private static void ReadExactly(Stream source, byte[] buffer, int offset, int count)
    {
        var readTotal = 0;
        while (readTotal < count)
        {
            var read = source.Read(buffer, offset + readTotal, count - readTotal);
            if (read <= 0)
            {
                throw new EndOfStreamException();
            }

            readTotal += read;
        }
    }

    private static string QuoteArgument(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
