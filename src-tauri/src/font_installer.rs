/// OS-level font installation/uninstallation for Windows.
/// Port of font-installer.ts — same PowerShell/VBS elevation strategy.

use std::path::{Path, PathBuf};

pub fn get_windows_fonts_dir() -> PathBuf {
    let win_dir = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    Path::new(&win_dir).join("Fonts")
}

pub fn get_windows_user_fonts_dir() -> PathBuf {
    let local = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("C:\\Users\\Default\\AppData\\Local"))
            .to_string_lossy()
            .into_owned()
    });
    Path::new(&local)
        .join("Microsoft")
        .join("Windows")
        .join("Fonts")
}

fn registry_value_name(family: &str, subfamily: &str) -> String {
    let sub = if subfamily.trim().is_empty() { "Regular" } else { subfamily.trim() };
    if sub.to_lowercase() == "regular" {
        format!("{family} (TrueType)")
    } else {
        format!("{family} {sub} (TrueType)")
    }
}

pub fn get_imported_fonts_directory_str(user_data: &str) -> String {
    crate::font_scanner::get_imported_fonts_directory(user_data)
        .to_string_lossy()
        .into_owned()
}

pub fn is_installed_in_windows_fonts_dir(file_path: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let norm = file_path.to_lowercase();
        let sys = get_windows_fonts_dir().to_string_lossy().to_lowercase();
        let user = get_windows_user_fonts_dir().to_string_lossy().to_lowercase();
        norm.starts_with(&sys) || norm.starts_with(&user)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = file_path;
        false
    }
}

/// Install a font to C:\Windows\Fonts for all users via elevated PowerShell.
pub fn install_font_to_os(
    src_path: &str,
    family: &str,
    subfamily: &str,
) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    return Ok(src_path.to_string());

    #[cfg(target_os = "windows")]
    {
        let dest_dir = get_windows_fonts_dir();
        let base = Path::new(src_path)
            .file_name()
            .ok_or("Invalid source path")?
            .to_string_lossy();
        let dest_path = dest_dir.join(base.as_ref());
        let dest_str = dest_path.to_string_lossy();
        let value_name = registry_value_name(family, subfamily);

        let escape = |s: &str| s.replace('\'', "''");
        let ps = format!(
            r#"$src  = '{src}';
$dest = '{dest}';
Copy-Item -Path $src -Destination $dest -Force;
$regKey = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts';
Set-ItemProperty -Path $regKey -Name '{value}' -Value '{base}';
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class FontHelper {{
  [DllImport("gdi32.dll")] public static extern int AddFontResource(string lpFileName);
}}
"@;
[FontHelper]::AddFontResource($dest) | Out-Null;"#,
            src = escape(src_path),
            dest = escape(&dest_str),
            value = escape(&value_name),
            base = escape(&base),
        );

        run_elevated_powershell(&ps)?;
        Ok(dest_str.into_owned())
    }
}

/// Uninstall a font from C:\Windows\Fonts via elevated PowerShell.
pub fn uninstall_font_from_os(
    family: &str,
    subfamily: &str,
    installed_path: &str,
) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    return Ok(());

    #[cfg(target_os = "windows")]
    {
        let value_name = registry_value_name(family, subfamily);
        let base = Path::new(installed_path)
            .file_name()
            .map(|f| f.to_string_lossy().into_owned())
            .unwrap_or_default();
        let system_path = get_windows_fonts_dir()
            .join(&base)
            .to_string_lossy()
            .into_owned();

        let escape = |s: &str| s.replace('\'', "''");
        let ps = format!(
            r#"$regKeyHKLM = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts';
$regKeyHKCU = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts';
$valueName = '{value}';
try {{ Remove-ItemProperty -Path $regKeyHKLM -Name $valueName -ErrorAction SilentlyContinue }} catch {{}}
try {{ Remove-ItemProperty -Path $regKeyHKCU -Name $valueName -ErrorAction SilentlyContinue }} catch {{}}
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class FontHelper2 {{
  [DllImport("gdi32.dll")] public static extern bool RemoveFontResource(string lpFileName);
}}
"@;
@('{system_path}','{user_path}') | ForEach-Object {{
  if (Test-Path $_) {{
    [FontHelper2]::RemoveFontResource($_) | Out-Null;
    Remove-Item $_ -Force -ErrorAction SilentlyContinue;
  }}
}};"#,
            value = escape(&value_name),
            system_path = escape(&system_path),
            user_path = escape(installed_path),
        );

        run_elevated_powershell(&ps)
    }
}

#[cfg(target_os = "windows")]
fn run_elevated_powershell(script: &str) -> Result<(), String> {

    let tmp = std::env::temp_dir();
    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    let ps1 = tmp.join(format!("efm-{id}.ps1"));
    let done_file = tmp.join(format!("efm-{id}.done"));
    let vbs = tmp.join(format!("efm-{id}.vbs"));

    // Write PS script with sentinel
    let full_script = format!(
        "{script}\nSet-Content -Path '{}' -Value 'done'",
        done_file.to_string_lossy().replace('\'', "''")
    );
    std::fs::write(&ps1, &full_script).map_err(|e| e.to_string())?;

    // Write VBS launcher
    let vbs_content = format!(
        r#"Set sh = CreateObject("Shell.Application")
sh.ShellExecute "powershell.exe", _
  "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{ps1}""", _
  "", "runas", 0"#,
        ps1 = ps1.to_string_lossy().replace('"', "\"\""),
    );
    std::fs::write(&vbs, &vbs_content).map_err(|e| e.to_string())?;

    std::process::Command::new("wscript.exe")
        .args(["//Nologo", "//B", &vbs.to_string_lossy()])
        .spawn()
        .map_err(|e| e.to_string())?;

    // Poll for done file (max 2 minutes)
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(120);
    loop {
        if done_file.exists() {
            break;
        }
        if std::time::Instant::now() > deadline {
            cleanup_files(&[&ps1, &done_file, &vbs]);
            return Err("Elevated install timed out".into());
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    cleanup_files(&[&ps1, &done_file, &vbs]);
    Ok(())
}

fn cleanup_files(files: &[&Path]) {
    for f in files {
        let _ = std::fs::remove_file(f);
    }
}
