Write-Host "Reverting OBS Studio optimization..."
$obsData = Join-Path $env:APPDATA "obs-studio"
function Set-IniValue($file, $section, $key, $value) {
    $content = [System.IO.File]::ReadAllText($file)
    if ($content -match "(?m)^$key=.*$") {
        $content = $content -replace "(?m)^$key=.*$", "$key=$value"
    } elseif ($content -match "(?m)^\[$section\]") {
        $content = $content -replace "(?m)^\[$section\]", "[$section]`r`n$key=$value"
    } else {
        $content = "$content`r`n[$section]`r`n$key=$value"
    }
    [System.IO.File]::WriteAllText($file, $content)
}
$globalIni = Join-Path $obsData "global.ini"
if (Test-Path $globalIni) {
    Set-IniValue $globalIni "General" "ProcessPriority" "Normal"
}
$profilesDir = Join-Path $obsData "basic\profiles"
if (Test-Path $profilesDir) {
    Get-ChildItem -Path $profilesDir -Directory | ForEach-Object {
        $basicIni = Join-Path $_.FullName "basic.ini"
        if (Test-Path $basicIni) {
            Set-IniValue $basicIni "General" "PreviewEnabled" "true"
        }
    }
}
Write-Host "OBS Studio optimization reverted."
