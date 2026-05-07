# Oracle Cloud ARM Instance Auto-Retry Script
# Keeps trying to create VM.Standard.A1.Flex until a capacity slot opens
# Run with: powershell -ExecutionPolicy Bypass -File retry-oracle-instance.ps1

$Env:OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING = "True"
$oci        = "C:\Users\HP COMPUTER.S\AppData\Local\Programs\Python\Python39\Scripts\oci.exe"
$config     = "C:\trackme\.oci\config"
$tenancy    = "ocid1.tenancy.oc1..aaaaaaaalwrokfjejjl4cbq6cnkuma7urx4aftfqrotydrmdh5auiepkmgqq"
$ad         = "HfKs:AP-SINGAPORE-1-AD-1"
$subnet     = "ocid1.subnet.oc1.ap-singapore-1.aaaaaaaaso2bezgaqno7euby57eegmrctrfgpiveobaszvsaawb5dpbfpnza"
$imageId    = "ocid1.image.oc1.ap-singapore-1.aaaaaaaalx7qs4u3onszbfy3bc3nyesnb5adfwtbjltzpbsyspym7edlsbma"
$sshPubKey  = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCkramH24yjT5CZx1lOHn4ArjarUkeV55PM7pAUeZr+yrZhko/8f0Ws2d7WqYIgFaVbWKjGxrkV1WR9CUgETRwfInZYeCwboaNwP2nPlg3EXsu2ryeqbgmqC0pY23snXS6xQFMn7mWJk40dQk4eX0uco+lvKkD1aLSPMCPhFCieYnJ90TPGLTNy+T7PoSR9kury3um3t1L4mvenaxzNpQm0QnA27Ux9ClZnJvRThImANqAVKboxGa0NjG24M7T3np1LLb54Qu6iVsigk1KyPQnIhFi9SMkpbtSvjrbaQEqa7yXmft8jxDvcbomh/9N+KM9fPuKtjt04b1XInQt9cRRL traccar-server"

$shapeConfig = '{"ocpus":4,"memoryInGBs":24}'
$retryDelay  = 300  # seconds between attempts (5 minutes)
$attempt     = 0

Write-Host "=== Oracle ARM Instance Retry Script ===" -ForegroundColor Cyan
Write-Host "Shape  : VM.Standard.A1.Flex (4 OCPU / 24 GB)" -ForegroundColor Cyan
Write-Host "Region : Singapore AD-1" -ForegroundColor Cyan
Write-Host "Retry  : every $retryDelay seconds" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

while ($true) {
    $attempt++
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Attempt #$attempt — trying to launch instance..." -ForegroundColor White

    # Write SSH public key to temp file (OCI CLI requires a file path)
    $tmpKey = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $tmpKey -Value $sshPubKey -Encoding utf8

    $result = & $oci --config-file $config compute instance launch `
        --compartment-id $tenancy `
        --availability-domain $ad `
        --shape "VM.Standard.A1.Flex" `
        --shape-config $shapeConfig `
        --image-id $imageId `
        --subnet-id $subnet `
        --assign-public-ip true `
        --display-name "traccar-server" `
        --ssh-authorized-keys-file $tmpKey `
        2>&1

    Remove-Item $tmpKey -ErrorAction SilentlyContinue

    if ($LASTEXITCODE -eq 0 -or ($result -match '"lifecycle-state": "RUNNING"') -or ($result -match '"lifecycle-state": "PROVISIONING"')) {
        Write-Host ""
        Write-Host "SUCCESS! Instance is being provisioned!" -ForegroundColor Green
        Write-Host $result
        # Extract public IP
        $ip = $result | Select-String '"public-ip":\s*"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1
        if ($ip) {
            Write-Host ""
            Write-Host "=== PUBLIC IP: $ip ===" -ForegroundColor Green
            Write-Host "SSH: ssh -i 'C:\Users\HP COMPUTER.S\Downloads\fazalghaniqureshi@gmail.com-2026-05-07T11_11_08.765Z.pem' ubuntu@$ip" -ForegroundColor Green
            $ip | Set-Clipboard
            Write-Host "IP copied to clipboard!" -ForegroundColor Green
        }
        break
    } elseif ($result -match "Out of capacity") {
        Write-Host "  → Out of capacity. Waiting $retryDelay seconds..." -ForegroundColor Yellow
    } elseif ($result -match "LimitExceeded") {
        Write-Host "  → Limit exceeded (instance may already exist). Check OCI Console." -ForegroundColor Red
        break
    } else {
        Write-Host "  → Unexpected response:" -ForegroundColor Red
        Write-Host ($result | Select-Object -First 5)
        Write-Host "  Waiting $retryDelay seconds before retry..." -ForegroundColor Yellow
    }

    Start-Sleep -Seconds $retryDelay
}
