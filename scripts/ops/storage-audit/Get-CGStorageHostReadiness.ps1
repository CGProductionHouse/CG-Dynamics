[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

function Invoke-SafeRead {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Action
    )

    try {
        return @(& $Action)
    }
    catch {
        return @([pscustomobject]@{
            read_error = $_.Exception.Message
        })
    }
}

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null

$capturedAt = (Get-Date).ToUniversalTime().ToString('o')
$computer = Get-CimInstance Win32_ComputerSystem
$operatingSystem = Get-CimInstance Win32_OperatingSystem

$adapters = Invoke-SafeRead {
    Get-NetAdapter | Select-Object Name, InterfaceDescription, Status, LinkSpeed, MacAddress, ifIndex
}

$profiles = Invoke-SafeRead {
    Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory, IPv4Connectivity, IPv6Connectivity
}

$ipConfiguration = Invoke-SafeRead {
    Get-NetIPConfiguration | ForEach-Object {
        [pscustomobject]@{
            interface_alias = $_.InterfaceAlias
            interface_index = $_.InterfaceIndex
            ipv4_addresses = @($_.IPv4Address | ForEach-Object IPAddress)
            ipv4_gateway = @($_.IPv4DefaultGateway | ForEach-Object NextHop)
            dns_servers = @($_.DNSServer.ServerAddresses)
        }
    }
}

$disks = Invoke-SafeRead {
    Get-Disk | Select-Object Number, FriendlyName, SerialNumber, UniqueId, BusType, PartitionStyle,
        OperationalStatus, HealthStatus, Size, IsOffline, IsReadOnly
}

$physicalDisks = Invoke-SafeRead {
    Get-PhysicalDisk | Select-Object FriendlyName, SerialNumber, UniqueId, MediaType, BusType,
        HealthStatus, OperationalStatus, Size
}

$diskDevices = Invoke-SafeRead {
    Get-CimInstance Win32_DiskDrive | Select-Object Index, Model, SerialNumber, InterfaceType,
        MediaType, PNPDeviceID, Status, Size
}

$storageReliability = Invoke-SafeRead {
    Get-PhysicalDisk -ErrorAction Stop | Get-StorageReliabilityCounter -ErrorAction Stop |
        Select-Object DeviceId, Temperature, TemperatureMax, ReadErrorsTotal, WriteErrorsTotal,
            Wear, PowerOnHours
}

$volumes = Invoke-SafeRead {
    Get-Volume | Select-Object DriveLetter, FileSystemLabel, FileSystem, Size, SizeRemaining,
        HealthStatus, DriveType, Path, UniqueId
}

$partitions = Invoke-SafeRead {
    Get-Partition | Select-Object DiskNumber, PartitionNumber, DriveLetter, AccessPaths, Type, Size, IsReadOnly, IsOffline
}

$smbShares = Invoke-SafeRead {
    Get-SmbShare -ErrorAction Stop | Select-Object Name, Path, Description, FolderEnumerationMode, EncryptData, Special
}

$smbConnections = Invoke-SafeRead {
    Get-SmbConnection -ErrorAction Stop | Select-Object ServerName, ShareName, Dialect, Encrypted, ContinuouslyAvailable
}

$serverService = Invoke-SafeRead {
    Get-Service LanmanServer | Select-Object Name, Status, StartType
}

$firewallProfiles = Invoke-SafeRead {
    Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction
}

$remoteAccessServices = Invoke-SafeRead {
    $namePattern = 'AnyDesk|TeamViewer|RustDesk|Parsec|Tailscale|ZeroTier|TermService|sshd|VNC|ScreenConnect|Splashtop|ChromeRemoteDesktop'
    Get-Service | Where-Object {
        $_.Name -match $namePattern -or $_.DisplayName -match $namePattern
    } | Select-Object Name, DisplayName, Status, StartType
}

$smb1Feature = Invoke-SafeRead {
    Get-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -ErrorAction Stop |
        Select-Object FeatureName, State
}

$rdpPolicy = Invoke-SafeRead {
    $value = Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server' `
        -Name fDenyTSConnections -ErrorAction Stop
    [pscustomobject]@{
        enabled = ([int]$value.fDenyTSConnections -eq 0)
    }
}

$report = [ordered]@{
    schema_version = 1
    capture_kind = 'cg_storage_host_readiness'
    captured_at_utc = $capturedAt
    read_only = $true
    computer = [ordered]@{
        name = $env:COMPUTERNAME
        manufacturer = $computer.Manufacturer
        model = $computer.Model
        domain = $computer.Domain
        part_of_domain = $computer.PartOfDomain
        os_caption = $operatingSystem.Caption
        os_version = $operatingSystem.Version
    }
    adapters = @($adapters)
    network_profiles = @($profiles)
    ip_configuration = @($ipConfiguration)
    disks = @($disks)
    physical_disks = @($physicalDisks)
    disk_devices = @($diskDevices)
    storage_reliability = @($storageReliability)
    volumes = @($volumes)
    partitions = @($partitions)
    smb_shares = @($smbShares)
    smb_connections = @($smbConnections)
    smb_server_service = @($serverService)
    firewall_profiles = @($firewallProfiles)
    remote_access_services = @($remoteAccessServices)
    smb1_feature = @($smb1Feature)
    rdp_policy = @($rdpPolicy)
}

$jsonPath = Join-Path $outputRoot 'host-readiness.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$summary = @(
    "CG storage host readiness (read-only)"
    "Captured UTC: $capturedAt"
    "Computer: $($env:COMPUTERNAME)"
    "Output: $jsonPath"
    "Disks discovered: $(@($disks).Count)"
    "Volumes discovered: $(@($volumes).Count)"
    "Active adapters: $(@($adapters | Where-Object Status -eq 'Up').Count)"
    "SMB shares visible: $(@($smbShares).Count)"
    "No security settings, shares, accounts, files, labels, drive letters or firewall rules were changed."
)

$summaryPath = Join-Path $outputRoot 'host-readiness.txt'
$summary | Set-Content -LiteralPath $summaryPath -Encoding UTF8

[pscustomobject]@{
    report = $jsonPath
    summary = $summaryPath
    captured_at_utc = $capturedAt
}
