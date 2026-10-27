$ErrorActionPreference='Stop'
[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Windows.Forms
[Console]::WriteLine('{"ready":true}')
while($null -ne ($line=[Console]::ReadLine())){
  $request=$null
  try{
    $request=ConvertFrom-Json $line
    $text=[System.Windows.Forms.Clipboard]::GetText([System.Windows.Forms.TextDataFormat]::UnicodeText)
    [Console]::WriteLine((@{id=$request.id;ok=$true;text=$text}|ConvertTo-Json -Compress))
  }catch{
    [Console]::WriteLine((@{id=$request.id;ok=$false}|ConvertTo-Json -Compress))
  }
}
