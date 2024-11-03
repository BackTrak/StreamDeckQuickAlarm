param (
    [string]$mp3FilePath = "C:\Users\Nick\Downloads\ding-126626.mp3"
)


function PlayMp3OnWindows([string] $mp3FilePath)
{
    Add-Type -AssemblyName PresentationCore
    $mediaPlayer = New-Object system.windows.media.mediaplayer


    $mediaPlayer.open($mp3FilePath)

    # Register an event to kill MediaPlayer when PowerShell exits
    # Register-EngineEvent -SourceIdentifier PowerShell.Exiting -SupportEvent -Action {
    #     if ($mediaPlayer -and $mediaPlayer.CanPause) {
    #         $mediaPlayer.Stop()
    #     }
    # }

    $continuePlaying = $true
    while($continuePlaying -eq $true)
    {
        $mediaPlayer.Play()

        while ($mediaPlayer.IsBuffering -or $mediaPlayer.Position -eq 0 ) {
            Start-Sleep -Milliseconds 50
        }

        while ($mediaPlayer.NaturalDuration.HasTimeSpan -and $mediaPlayer.Position.Ticks -lt $mediaPlayer.NaturalDuration.TimeSpan.Ticks) {
            Start-Sleep -Milliseconds 50
        }
        
        $mediaPlayer.Position = 0

        # $char = [Console]::In.Peek()
        # if ([Console]::KeyAvailable -and $char -ne -1) {
        #     $continuePlaying = $false
        # }
    }
}

PlayMp3OnWindows -mp3FilePath $mp3FilePath