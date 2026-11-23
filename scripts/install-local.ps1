param([Parameter(Mandatory=$true)][string]$VaultPath, [ValidateSet('red-beard-dashboard','red-beard-weather')][string[]]$PluginIds = @('red-beard-dashboard','red-beard-weather'))
$ErrorActionPreference = 'Stop'
$sourceRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$workspace = Split-Path -Parent $sourceRoot
$vaultRoot = (Resolve-Path -LiteralPath $VaultPath).Path.TrimEnd('\')
if (-not (Test-Path -LiteralPath (Join-Path $vaultRoot 'Obsid-ia-n.md'))) { throw 'Expected the verified Red-Beard vault.' }
$pluginsRoot = Join-Path $vaultRoot '.obsidian\plugins'
$backupRoot = Join-Path $workspace ('red-beard-dashboard-install-backups\weather-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $vaultRoot '.obsidian\community-plugins.json') -Destination (Join-Path $backupRoot 'community-plugins.json')
$results = @()
foreach ($pluginId in $PluginIds) {
  $source = Join-Path $workspace $pluginId
  $destination = [System.IO.Path]::GetFullPath((Join-Path $pluginsRoot $pluginId))
  if (-not $destination.StartsWith($pluginsRoot + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Plugin target escaped the vault.' }
  $manifest = Get-Content -LiteralPath (Join-Path $source 'manifest.json') -Raw | ConvertFrom-Json
  if ($manifest.id -ne $pluginId) { throw 'Plugin manifest identity mismatch.' }
  $backup = Join-Path $backupRoot $pluginId
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  foreach ($file in @('manifest.json','main.js','styles.css')) {
    $from = Join-Path $source $file
    $to = Join-Path $destination $file
    if (Test-Path -LiteralPath $to) { Copy-Item -LiteralPath $to -Destination (Join-Path $backup $file) }
    Copy-Item -LiteralPath $from -Destination $to
    $builtHash = (Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash
    $installedHash = (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash
    if ($builtHash -ne $installedHash) { throw "Installed hash mismatch: $pluginId/$file" }
    $results += [pscustomobject]@{plugin=$pluginId;file=$file;sha256=$installedHash}
  }
}
$results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupRoot 'verified-hashes.json')
Write-Output ('Backup: ' + $backupRoot)
$results | Format-Table -AutoSize
