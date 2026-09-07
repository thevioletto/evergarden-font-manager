/**
 * OS-level font installation / uninstallation for Windows.
 *
 * System-wide install (C:\Windows\Fonts, HKLM) requires elevation.
 * We spawn an elevated PowerShell process via "-Verb RunAs" which
 * triggers a UAC prompt. The font is then installed for all users.
 *
 * Uninstall uses the same elevated approach to remove from C:\Windows\Fonts
 * and deregister from HKLM.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";

export function getWindowsFontsDir(): string {
  const winDir = process.env.SystemRoot || "C:\\Windows";
  return path.join(winDir, "Fonts");
}

/** Returns %LOCALAPPDATA%\Microsoft\Windows\Fonts (per-user fallback) */
export function getWindowsUserFontsDir(): string {
  const localAppData =
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "Microsoft", "Windows", "Fonts");
}

/** Build the registry value name Windows expects for a font entry. */
function registryValueName(family: string, subfamily: string): string {
  const sub = (subfamily || "Regular").trim();
  const label = sub.toLowerCase() === "regular" ? family : `${family} ${sub}`;
  return `${label} (TrueType)`;
}

/**
 * Install a font to C:\Windows\Fonts for all users.
 * Spawns an elevated PowerShell process (UAC prompt).
 * Returns the destination path.
 */
export async function installFontToOS(
  srcPath: string,
  family: string,
  subfamily: string
): Promise<string> {
  if (os.platform() !== "win32") return srcPath;

  const destDir = getWindowsFontsDir();
  const base = path.basename(srcPath);
  const destPath = path.join(destDir, base);
  const valueName = registryValueName(family, subfamily);

  // PowerShell script that runs elevated:
  // 1. Copy font file to C:\Windows\Fonts
  // 2. Register in HKLM so it is available system-wide immediately
  // 3. Notify the system via AddFontResource so no reboot needed
  const ps = `
$src  = '${srcPath.replace(/'/g, "''")}';
$dest = '${destPath.replace(/'/g, "''")}';
Copy-Item -Path $src -Destination $dest -Force;
$regKey = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';
Set-ItemProperty -Path $regKey -Name '${valueName.replace(/'/g, "''")}' -Value '${base.replace(/'/g, "''")}';
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class FontHelper {
  [DllImport("gdi32.dll")] public static extern int AddFontResource(string lpFileName);
}
"@;
[FontHelper]::AddFontResource($dest) | Out-Null;
`.trim();

  await runElevatedPowerShell(ps);
  return destPath;
}

/**
 * Uninstall a font from C:\Windows\Fonts.
 * Spawns an elevated PowerShell process (UAC prompt).
 */
export async function uninstallFontFromOS(
  family: string,
  subfamily: string,
  installedPath: string
): Promise<void> {
  if (os.platform() !== "win32") return;

  const valueName = registryValueName(family, subfamily);
  const base = path.basename(installedPath);
  const systemPath = path.join(getWindowsFontsDir(), base);
  const userPath = installedPath;

  const ps = `
$regKeyHKLM = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';
$regKeyHKCU = 'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts';
$valueName = '${valueName.replace(/'/g, "''")}';
try { Remove-ItemProperty -Path $regKeyHKLM -Name $valueName -ErrorAction SilentlyContinue } catch {}
try { Remove-ItemProperty -Path $regKeyHKCU -Name $valueName -ErrorAction SilentlyContinue } catch {}
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class FontHelper2 {
  [DllImport("gdi32.dll")] public static extern bool RemoveFontResource(string lpFileName);
}
"@;
@('${systemPath.replace(/'/g, "''")}','${userPath.replace(/'/g, "''")}') | ForEach-Object {
  if (Test-Path $_) {
    [FontHelper2]::RemoveFontResource($_) | Out-Null;
    Remove-Item $_ -Force -ErrorAction SilentlyContinue;
  }
};
`.trim();

  await runElevatedPowerShell(ps);
}

/**
 * Run a PowerShell script elevated (UAC) with no visible window.
 *
 * Strategy: write a temp .vbs file that uses Shell.Application.ShellExecute
 * to launch PowerShell with the "runas" verb. wscript.exe runs VBS silently
 * (no console window), and ShellExecute with runas triggers the UAC prompt
 * without opening any terminal. We poll for a sentinel file that the PS
 * script writes on completion so we can await it.
 */
function runElevatedPowerShell(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmp = os.tmpdir();
    const id = Date.now().toString(36);
    const ps1File = path.join(tmp, `efm-${id}.ps1`);
    const doneFile = path.join(tmp, `efm-${id}.done`);
    const vbsFile = path.join(tmp, `efm-${id}.vbs`);

    // Append sentinel write so we know when the elevated process finishes
    const fullScript =
      script +
      `\nSet-Content -Path '${doneFile.replace(/'/g, "''")}' -Value 'done'`;
    fs.writeFileSync(ps1File, fullScript, "utf8");

    // VBS: silently invoke PowerShell elevated via ShellExecute runas verb
    // WindowStyle 0 = hidden, bWaitOnReturn = false (UAC needs its own pump)
    const vbs = `
Set sh = CreateObject("Shell.Application")
sh.ShellExecute "powershell.exe", _
  "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & "${ps1File.replace(/"/g, '""')}" & """", _
  "", "runas", 0
`.trim();
    fs.writeFileSync(vbsFile, vbs, "utf8");

    // Launch via wscript.exe — completely windowless
    const child = spawn("wscript.exe", ["//Nologo", "//B", vbsFile], {
      windowsHide: true,
      detached: false,
    });

    child.on("error", (err) => {
      cleanup();
      reject(err);
    });

    // wscript exits immediately after handing off to ShellExecute
    // Poll for the sentinel file the PS script writes on completion
    child.on("close", () => {
      const deadline = Date.now() + 120_000; // 2 min max (UAC wait)
      const poll = setInterval(() => {
        if (fs.existsSync(doneFile)) {
          clearInterval(poll);
          cleanup();
          resolve();
        } else if (Date.now() > deadline) {
          clearInterval(poll);
          cleanup();
          reject(new Error("Elevated install timed out"));
        }
      }, 500);
    });

    function cleanup() {
      for (const f of [ps1File, doneFile, vbsFile]) {
        try {
          fs.unlinkSync(f);
        } catch {
          /* ignore */
        }
      }
    }
  });
}

/**
 * Check whether a given file path is inside C:\Windows\Fonts
 * or the per-user fonts dir (both are installed by this app).
 */
export function isInstalledInWindowsFontsDir(filePath: string): boolean {
  if (os.platform() !== "win32") return false;
  const norm = path.normalize(filePath).toLowerCase();
  return (
    norm.startsWith(getWindowsFontsDir().toLowerCase()) ||
    norm.startsWith(getWindowsUserFontsDir().toLowerCase())
  );
}
