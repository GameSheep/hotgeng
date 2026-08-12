param(
  [int]$BatchSize = 5,
  [string]$InputPath = (Join-Path $PSScriptRoot '..\data\full-archive-2026-08-12.json'),
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\data\international-machine-2026-08-12.json')
)

$ErrorActionPreference = 'Stop'
$archive = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $InputPath), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
$translations = @{}

if (Test-Path -LiteralPath $OutputPath) {
  $existing = [System.IO.File]::ReadAllText((Resolve-Path -LiteralPath $OutputPath), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  foreach ($item in $existing.memes) { $translations[$item.name] = $item }
}

function Invoke-Translation([string]$Text) {
  $attempt = 0
  while ($attempt -lt 4) {
    try {
      $response = Invoke-RestMethod -Method Post -Uri 'https://translate.googleapis.com/translate_a/single' -Body @{
        client = 'gtx'; sl = 'zh-CN'; tl = 'en'; dt = 't'; q = $Text
      } -TimeoutSec 60
      return (($response[0] | ForEach-Object { $_[0] }) -join '')
    } catch {
      $attempt++
      if ($attempt -ge 4) { throw }
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

$pending = @($archive.memes | Where-Object { -not $translations.ContainsKey($_.name) })
for ($offset = 0; $offset -lt $pending.Count; $offset += $BatchSize) {
  $last = [Math]::Min($offset + $BatchSize - 1, $pending.Count - 1)
  $batch = @($pending[$offset..$last])
  $parts = [System.Collections.Generic.List[string]]::new()
  for ($i = 0; $i -lt $batch.Count; $i++) {
    $meme = $batch[$i]
    $parts.Add("[[[M$i-TITLE]]]`n$($meme.name)")
    $parts.Add("[[[M$i-SUMMARY]]]`n$($meme.summary)")
    $parts.Add("[[[M$i-ORIGIN]]]`n$($meme.origin)")
    $parts.Add("[[[M$i-MEANING]]]`n$($meme.new_meaning)")
    $parts.Add("[[[M$i-USE]]]`n$($meme.usage_scenes)")
    $parts.Add("[[[M$i-FIRST]]]`n$($meme.first_appearance)")
  }

  $translated = Invoke-Translation ($parts -join "`n")
  $matches = [regex]::Matches($translated, '(?s)\[\[\[M(\d+)-(TITLE|SUMMARY|ORIGIN|MEANING|USE|FIRST)\]\]\]\s*(.*?)(?=\r?\n\[\[\[M\d+-|$)')
  $fields = @{}
  foreach ($match in $matches) { $fields["$($match.Groups[1].Value)-$($match.Groups[2].Value)"] = $match.Groups[3].Value.Trim() }

  for ($i = 0; $i -lt $batch.Count; $i++) {
    $meme = $batch[$i]
    $required = @('TITLE', 'SUMMARY', 'ORIGIN', 'MEANING', 'USE', 'FIRST')
    if (@($required | Where-Object { -not $fields.ContainsKey("$i-$_") }).Count) {
      throw "Translation markers were incomplete for $($meme.name). Re-run to resume."
    }
    $translations[$meme.name] = [ordered]@{
      name = $meme.name
      title_en = $fields["$i-TITLE"]
      pronunciation = ''
      literal_en = $fields["$i-SUMMARY"]
      meaning_en = $fields["$i-MEANING"]
      culture_en = $fields["$i-ORIGIN"]
      use_en = $fields["$i-USE"]
      example_en = $fields["$i-FIRST"]
      translation_method = 'machine-assisted-from-editorial-chinese'
    }
  }

  $ordered = @($archive.memes | ForEach-Object { if ($translations.ContainsKey($_.name)) { $translations[$_.name] } })
  $json = [ordered]@{ generated_at = (Get-Date).ToUniversalTime().ToString('o'); source = 'editorial Chinese archive'; memes = $ordered } | ConvertTo-Json -Depth 8
  [System.IO.File]::WriteAllText($OutputPath, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Translated $($translations.Count) / $($archive.memes.Count)"
}

Write-Host "Saved $($translations.Count) distinct English guides to $OutputPath"
