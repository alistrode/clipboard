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
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne '40b974b3b093b3fe4976ca66091f62a466b36303440fbf81a578f0bce05c2b6a') {
        throw 'Runtime archive SHA-256 mismatch. Download the complete package again.'
    }
    Expand-Archive -Path $archive -DestinationPath $runtime -Force
    Remove-Item $archive
}
& $exe @args
