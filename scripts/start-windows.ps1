$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$runtime = Join-Path $root '.runtime'
$exe = Join-Path $runtime 'clipboard-windows-x64\Clipboard.exe'
if (-not (Test-Path $exe)) {
    New-Item -ItemType Directory -Path $runtime -Force | Out-Null
    $archive = Join-Path $runtime 'windows.zip'
    $output = [System.IO.File]::Create($archive)
    try {
        Get-ChildItem (Join-Path $root 'deliverables\windows.part*') | Sort-Object Name | ForEach-Object {
            $inputFile = [System.IO.File]::OpenRead($_.FullName)
            try { $inputFile.CopyTo($output) } finally { $inputFile.Dispose() }
        }
    } finally { $output.Dispose() }
    $hasher = [System.Security.Cryptography.SHA256]::Create()
    $inputFile = [System.IO.File]::OpenRead($archive)
    try { $hash = [BitConverter]::ToString($hasher.ComputeHash($inputFile)).Replace('-', '').ToLowerInvariant() }
    finally { $inputFile.Dispose(); $hasher.Dispose() }
    if ($hash -ne 'a44b17ae0faa570a2b2d85a849f0e4e7e5253520b1ba123166bef37c4dc2a998') {
        throw 'Runtime archive SHA-256 mismatch. Download the complete package again.'
    }
    [System.Reflection.Assembly]::LoadWithPartialName('System.IO.Compression.FileSystem') | Out-Null
    [System.IO.Compression.ZipFile]::ExtractToDirectory($archive, $runtime)
    Remove-Item $archive
}
& $exe @args
