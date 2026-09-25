# JugaadVision — Linux Platform Integration

## 0. Status and scope

**`JugaadVision.Platform` contains no implementations.** The project exists, targets `net10.0`,
references `JugaadVision.Core`, and currently has exactly one `PackageReference`
(`Microsoft.Extensions.Logging.Abstractions`). Every class named in this document is a
specification to be written, not code that exists. Type names below are the names the
implementation should use; if a name changes, `JugaadVision.App/Services/ServiceCollectionExtensions.cs`
is the only place that has to follow.

This document replaces the Windows integration plan. WinUI 3 and MSIX cannot be built on a Linux
development machine, so the shell is Avalonia and the platform surface is the freedesktop one.
Where the product spec still names Windows mechanisms, the mapping is given explicitly in
section 11 so the delta is auditable rather than assumed.

Every command output quoted in this document was captured on the reference machine: Arch Linux,
Hyprland on Wayland, `XDG_SESSION_TYPE=wayland`, x86-64, .NET SDK 10.0.401, runtime 10.0.11,
Avalonia 12.1.3.

## 1. The contracts being satisfied

From `JugaadVision.Core/Abstractions/IPlatformServices.cs` and `IHardwareMonitor.cs`:

| Interface | Members | Linux implementation |
|-----------|---------|----------------------|
| `ISecretStore` | `IsSecureStoreAvailable`, `GetAsync`, `SetAsync`, `DeleteAsync` | `LibSecretSecretStore`, `EncryptedFileSecretStore` |
| `INotificationService` | `NotifyAsync` | `FreedesktopNotificationService` |
| `IHardwareMonitor` | `CaptureAsync` | `LinuxHardwareMonitor` |
| `ISystemTrayService` | `Show`, `UpdateTooltip`, `Activated`, `Hide` | `StatusNotifierTrayService` |
| `IFileDialogService` | `OpenFileAsync`, `OpenFolderAsync`, `SaveFileAsync` | Avalonia's `StorageProvider` (no Platform class) |

Design rule for all of them: every member must complete without throwing when the underlying
facility is absent. A missing `notify-send`, a locked keyring, or a session bus with no notification
daemon is a degraded-capability state that the UI reports, not an exception that escapes into a
view model. The interfaces have no error channel beyond return values, so every failure must land
in a log entry plus a null/false return.

## 2. Secret storage

### 2.1 Primary path: the Secret Service

`ISecretStore` maps to Secret Service (`org.freedesktop.secrets`), the standard behind GNOME
Keyring, KWallet's Secret Service bridge, and `libsecret`. Access is via P/Invoke against
`libsecret-1.so` (present at `/usr/lib/libsecret-1.so`, package `libsecret 0.21.7-1` on the
reference machine) rather than by shelling out to `secret-tool`. Shelling out would put a secret on
a process argument list and on the child's stdin pipe; the library call keeps the value in-process.

On the reference machine the service is owned by `gnome-keyring-daemon` and a full round trip
succeeds:

```
$ busctl --user list | grep org.freedesktop.secrets
org.freedesktop.secrets   936  gnome-keyring-d ...
$ printf 'probe-secret-value\n' | secret-tool store --label='jgv probe' application jugaadvision
$ secret-tool lookup application jugaadvision
probe-secret-value
$ secret-tool clear application jugaadvision
```

That probe used `secret-tool` only to prove the service is live and unlocked. The shipped code
uses the library.

**Schema.** One item per provider credential, in the `default` (login) collection:

- `schema` = `org.jugaadvision.secret`
- `application` = `jugaadvision`
- `key` = the `reference` string passed by the caller, e.g. `provider:openrouter:apiKey`
- `label` = human-readable, e.g. `JugaadVision — OpenRouter API key`

Lookup uses `SecretService.search_sync` with a `SecretSchema` built from
`SECRET_SCHEMA_DONT_MATCH_NAME` attributes; `replace` on `SetAsync`; `SECRET_SERVICE_COLLECTION_DEFAULT`.
Values are read as UTF-8 strings. Blobs are out of scope: an API key is text, and the interface is
`Task<string?>`.

`IsSecureStoreAvailable` is true when `secret_service_get_sync(SECRET_SERVICE_NONE, NULL)` returns a
non-NULL `SecretService*` **and** the default collection can be opened. The first call is a blocking
C call, so it must run on a background thread and be cached — the property is not allowed to
re-probe the bus on every access.

`secret_service_get_sync` also raises the desktop unlock prompt, which blocks. Therefore the first
`GetAsync`/`SetAsync` must be wrapped in `Task.Run` with a cancellation token, and the UI must show a
"waiting for keyring unlock" state rather than looking hung.

### 2.2 Fallback path: AES-256-GCM encrypted file

`EncryptedFileSecretStore` covers headless boxes, containers, and sessions where no keyring daemon
is running — CI, minimal installs, and the common "no D-Bus session" case.

Format, at `$XDG_CONFIG_HOME/jugaadvision/secrets.enc` (`~/.config/jugaadvision/secrets.enc`):

```
magic      8 bytes   "JGVSEC01"
version    1 byte    0x01
iterations 4 bytes   little-endian uint32, PBKDF2-HMAC-SHA256
salt      32 bytes   random, CSPRNG, written once at creation
nonce     12 bytes   fresh per write
tag       16 bytes   AES-GCM authentication tag
payload    n bytes   AES-256-GCM ciphertext of the serialised secret map
```

Payload is a UTF-8 JSON object mapping `reference` to plaintext secret. Every `SetAsync` rewrites
the whole file with a new nonce. Writes go to a temp file in the same directory, `fsync`, then
`File.Move` (atomic on the same filesystem), then `fsync` the directory. File mode `0600`, directory
mode `0700`.

**The master-key problem, stated plainly.** AES-256-GCM is only as good as the key that decrypts
it. DPAPI on Windows solves this with a user-logon-bound key that other processes running as the
same user cannot trivially read. On Linux there is no equivalent primitive in the base system:

- Storing the key next to the ciphertext in the same file defeats encryption entirely.
- Storing the key in an environment variable leaks it to every process the user launches, and to
  `/proc/<pid>/environ` for same-uid readers.
- Deriving the key from a user-typed passphrase is the only construction that is actually
  secure, and it costs a prompt at every cold start.

The decision this document specifies:

1. The fallback key is derived with PBKDF2-HMAC-SHA256 from a **passphrase the user must type**,
   or from a **keyfile the user explicitly points at** (a USB stick, a password-manager
   attachment). Never from a constant, a machine ID, a hostname, or a timestamp.
2. Until the user provides one, the fallback store refuses to persist anything. `SetAsync` returns
   without writing and logs an instruction; the caller surfaces a Settings error telling the user
   to install/enable a keyring or configure a passphrase.
3. `IsSecureStoreAvailable` is **false** for the file store, always. The Settings screen and the
   provider-configuration flow must read this property and say so in plain words: "no OS keyring
   detected; keys will be encrypted with a passphrase you supply, and are not protected by your
   login session." A user who does not know their key is not user-scoped on a shared machine
   should not be told the credential is safe.
4. A failed or wrong passphrase must fail closed: return `null` from `GetAsync` and `false` from
   `DeleteAsync`, never fall back to treating the file as plaintext.

The provider configuration flow must not silently pick the fallback when the Secret Service is
present. Selection is: Secret Service if available, otherwise file store if configured, otherwise
the app runs with cloud providers unconfigured and Settings says why.

### 2.3 Logging rules

`AdvancedSettings.VerboseProviderLogging` may produce verbose traces, and the spec requires
"never in plaintext, never in logs". Concretely:

- Log the `reference` and a success/failure flag. Never the secret.
- Never log a full request `Authorization` header, even at verbose level. Log the header name and
  a boolean `present`.
- Exception messages from `libsecret` contain attribute keys, not values; they are safe. Do not wrap
  a secret in an exception message for any reason.

## 3. Notifications

`FreedesktopNotificationService` targets the `org.freedesktop.Notifications` D-Bus interface. It is
implemented with a thin generated/proxy binding over the session bus rather than by invoking
`notify-send`, because the interface's `CloseNotification` and `GetCapabilities` calls are needed to
avoid leaking notification handles, and because spawning a process per notification is wasteful
during a batch download.

The reference machine has the bus name owned by a live host:

```
$ busctl --user list | grep -E 'Notifications|StatusNotifier'
org.freedesktop.Notifications   158141  quickshell  ...
org.kde.StatusNotifierHost-...  158141  quickshell  ...
org.kde.StatusNotifierWatcher   158141  quickshell  ...
```

`NotifyAsync` maps `NotificationLevel` to the spec's urgency values and the platform's actions:

| `NotificationLevel` | `expire_timeout` | Suggested action label | Use |
|---------------------|------------------|-----------------------|-----|
| `Information` | 5000 ms | `View` | neutral progress |
| `Success` | 5000 ms | `View` | download complete, generation complete |
| `Warning` | 0 (sticky) | `Dismiss` | VRAM budget exceeded, low disk |
| `Error` | 0 (sticky) | `Retry` | generation failed, provider unreachable |

The app name shown by the notification daemon comes from `g_get_prgname()` and, on daemons that read
it, the desktop entry. This is another reason the `.desktop` file in section 6 must exist and be
installed even for an AppImage run from `~/Downloads`.

Which notifications fire is governed by `NotificationSettings.NotifyOnGenerationComplete`,
`NotifyOnDownloadComplete` and `NotifyOnError`. The service does not read settings itself; the
call sites do, so that a muted category never reaches D-Bus at all.

Degradation: if the `org.freedesktop.Notifications` name has no owner, `NotifyAsync` must resolve
normally and log at debug. `INotificationService` has no error return, so failing loudly would mean
throwing on a purely cosmetic feature.

## 4. System tray

### 4.1 Protocol

`StatusNotifierTrayService` implements the StatusNotifierItem specification: register
`org.kde.StatusNotifierItem-<pid>-<id>` on the session bus, then register that name with the
`org.kde.StatusNotifierWatcher` host, and set `org.kde.StatusNotifierItem` plus
`org.kde.StatusNotifierItem.IsMenu` properties. The watcher name is the current convention; the
older `org.freedesktop.StatusNotifierWatcher` is probed as a fallback for daemons that have not
moved.

Menu: the tray menu is exported as an `org.kde.StatusNotifierItem` `Menu` object, with items
`Open`, `Show`, `Hide`, `Quit`. `Activated` on `ISystemTrayService` fires when the item is
activated with the primary mouse button; a left-click that shows a menu is handled by the
`ContextMenuAboutToShow` / `Activate` pair.

Behaviour is driven by two `NotificationSettings` fields: `ShowTrayIcon` (whether `Show` is called
at startup) and `MinimizeToTray` (whether closing the main window hides instead of exits). When
`MinimizeToTray` is false, closing the window must genuinely exit, and the tray item must be torn
down first or the daemon will keep a dead item in the panel.

### 4.2 The portability risk, stated plainly

StatusNotifier/AppIndicator support is **not universal on Linux desktops**. This is a real
portability risk, not a theoretical one:

- **KDE Plasma** implements the SNI host natively. Works.
- **Hyprland, Sway, and most wlroots compositors** depend on a separate host — the reference
  machine runs one under `quickshell` (`org.kde.StatusNotifierHost-158141-...` above). Works only
  while that host is running; it is not part of the compositor.
- **GNOME** (43 and later) removed tray support from the shell. It needs the
  `ubuntu-appindicator` extension, which is not installed by default on Fedora or Arch GNOME and is
  a user decision. Without it, a StatusNotifierItem is simply invisible.
- **X11-only desktops** still need a host; the app cannot assume one exists.

Two mitigations this document specifies, in order:

1. The app must detect the absence of an SNI host at startup
   (`org.kde.StatusNotifierWatcher` or `org.freedesktop.StatusNotifierWatcher` unowned) and set
   `MinimizeToTray` to false in the running session, overriding the persisted setting. If tray
   support is missing, "close to tray" becomes a way to make the app unreachable, and the user must
   not be able to fall into that trap. The Settings toggle is greyed out with the reason shown.
2. The legacy `XEmbed`/`_NET_SYSTEM_TRAY` protocol is a fallback path for X11 sessions only. It
   requires a Gtk/Qt widget host, which is a large dependency for a marginal case, so it is
   explicitly **out of scope for the MVP**. A tray-less run is a supported configuration, not a
   failure — the app remains fully usable from its window.

`ISystemTrayService` is therefore allowed to become a no-op implementation on an unsupported
desktop, and the UI must not depend on tray presence for any required action.

## 5. File associations and single-instance argument handling

### 5.1 The desktop entry

`packaging/jugaadvision.desktop`, installed to `/usr/share/applications/jugaadvision.desktop` (system
wide) or `~/.local/share/applications/jugaadvision.desktop` (per user, the only option inside an
AppImage):

```ini
[Desktop Entry]
Type=Application
Version=1.5
Name=JugaadVision
GenericName=AI Creative Workstation
Comment=Local-first AI model management and generation
Exec=jugaadvision %U
TryExec=jugaadvision
Icon=jugaadvision
Terminal=false
Categories=Graphics;Development;Utility;
MimeType=application/x-jugaadvision-project;
StartupWMClass=JugaadVision
StartupNotify=true
Keywords=ai;gguf;llama;inference;model;
```

`%U` is required, not `%f` or `%F`: the app must accept multiple file arguments, because a
multi-select open in a file manager passes several paths in one launch.

`StartupWMClass=JugaadVision` must match `ApplicationName` in the Avalonia app, or the compositor
will place the window under a generic entry and the app icon in the taskbar will not group
correctly. This is the single most commonly missed line in a Linux port.

The `MimeType` value is a custom type. It has no IANA registration, which is correct for an
application-private format: the file is not a document other applications need to read.

### 5.2 Registering the association

```
# per user (no root)
xdg-mime install --mode=user --set-default packaging/jugaadvision.desktop application/x-jugaadvision-project
update-desktop-database ~/.local/share/applications
xdg-mime query default application/x-jugaadvision-project   # -> jugaadvision.desktop
```

`/usr/bin/xdg-mime` is present on the reference machine. `xdg-mime query default text/plain`
currently returns `nvim.desktop`, which confirms the mechanism works in this session.

The desktop file must also declare the extension as its own MIME type so the file manager shows
"JugaadVision project" rather than "unknown":

```
# written on first run / install to
#   $XDG_DATA_HOME/mime/packages/jugaadvision-jgvproj.xml
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-jugaadvision-project">
    <comment>JugaadVision project</comment>
    <glob pattern="*.jgvproj"/>
    <magic priority="60">
      <match type="string" value="JUGAADVISION" offset="0"/>
    </magic>
    <sub-class-of type="application/json"/>
  </mime-type>
</mime-info>
```

The magic rule requires `.jgvproj` files to begin with the ASCII literal `JUGAADVISION` followed by
a format version byte, so that a project file is identified by content and not by an attacker-supplied
extension. `AppProject` in Core is a POCO serialised to JSON, so the writer must emit this preamble
before the JSON body and the reader must skip it. This is a change to the serialisation layer in
`JugaadVision.Storage`, not to the `AppProject` model.

### 5.3 Single instance

A second launch with a path must hand the path to the running instance instead of starting a second
process. Two independent single-instance mechanisms are required, because Avalonia covers only one
of the two paths.

**Launch from a file manager / desktop entry** uses the D-Bus activation path, which is the
freedesktop-native answer:

- Publish `org.jugaadvision.App` on the session bus at startup and own the name.
- Add a `DBusActivatable` `Service` section to the desktop entry so a second launch activates the
  running instance rather than execing a new one.
- The activated instance receives the file arguments over the `org.freedesktop.Application` call.

**Launch from a shell, a file manager that does not do activation, or the AppImage binary itself**
uses a lock file, because the D-Bus route is not reachable in every session:

- `$XDG_RUNTIME_DIR/jugaadvision.lock`, opened with `FileShare.None` and a short timeout.
- Acquired once, held for process lifetime, deleted on exit.
- On contention, the new process reads the path from the lock file's contents, writes its own
  argument to `$XDG_RUNTIME_DIR/jugaadvision.open.<pid>`, and signals the running instance with a
  `SIGUSR1`, then exits with code 0.
- The primary instance handles `SIGUSR1` by draining all `jugaadvision.open.*` files, in creation
  order, and passing each path to the same open path the activation route uses.

Both routes must converge on one method: `OpenProjectAsync(string path)` on the projects view
model. It validates the preamble (§5.2), confirms the extension, reads the file, and updates
`LastOpenedAt`. Anything that fails to parse opens the file empty and shows an actionable dialog
rather than a stack trace.

The AppImage case has a wrinkle worth noting: a mounted AppImage's `$APPIMAGE` path is stable per
mount but differs per invocation, so a second `xdg-open` of the same AppImage is a genuinely new
process, not a re-exec. The lock file is what makes it work.

## 6. File dialogs

`IFileDialogService` is satisfied by Avalonia's `StorageProvider` (`TopLevel.StorageProvider.OpenFilePickerAsync`,
`OpenFolderPickerAsync`, `SaveFilePickerAsync`). It is implemented in the App layer, not in
`JugaadVision.Platform`, because it needs a live `TopLevel`, and it is the one platform service
that must not shell out to `zenity` or `kdialog` — those would produce a dialog belonging to a
different toolkit and a different theme than the rest of the app.

`FileFilter.JgvProject`, `FileFilter.Gguf` and `FileFilter.Image` map directly onto
`FilePickerFileType` with `Patterns`. `FileFilter.All` maps to a type with the wildcard `*.*`.
The `*` in `FileFilter.All.Extensions` is a `FileFilter` display convention, not a glob — do not
pass `*` through as a pattern, which some backends treat literally.

Backend note: on X11 without a native portal, Avalonia uses GTK interop for file picking, which
requires the app to be built against GTK or to fall back to a managed picker. On Wayland with
`xdg-desktop-portal` present, the portal path is used. This is handled by the toolkit, not here.

## 7. Hardware detection

`LinuxHardwareMonitor.CaptureAsync` builds a `HardwareSnapshot`. It must be cheap enough to poll on a
timer, so the design rule is: **fast path on every call, slow probes cached with a TTL**.

### 7.1 CPU

| Field | Source | Verified on the reference machine |
|-------|--------|----------------------------------|
| `ModelName` | first `model name` in `/proc/cpuinfo` | `Intel(R) Core(TM) i7-6820HQ CPU @ 2.70GHz` |
| `LogicalCoreCount` | count of `/sys/devices/system/cpu/cpu[0-9]*` | 8 |
| `PhysicalCoreCount` | unique `(physical_package_id, core_id)` across those directories | 4 |
| `LoadAverage` | 1-minute field of `/proc/loadavg` divided by `LogicalCoreCount` | 3.99/8 = 0.499 |
| `Architecture` | `uname -m`, from `RuntimeInformation.OSArchitecture` | `x86_64` |

`LoadAverage` is specified as 0.0–1.0 across logical cores, so it must be normalised; the raw
1-minute load average is not that value and must not be surfaced directly.

`PhysicalCoreCount` is the value that has to be right for `HardwareSettings.ThreadCount`, since
llama.cpp wants physical cores, not hyperthreads. `lscpu` is available but is a separate process
per call; reading sysfs topology directly is faster and gives the same answer (both report 4/8 on
the reference machine). `lscpu -p=Core,Socket | grep -vc '^#'` returns 8 (logical) and deduplicating
the `(socket, core)` pairs returns 4, which matches sysfs. Cache `ModelName` and both core counts
for the process lifetime; they do not change.

### 7.2 Memory

| Field | Source | Verified |
|-------|--------|----------|
| `TotalBytes` | `MemTotal` in `/proc/meminfo`, kB to bytes | 32,548,344 kB = 34,179,527,168 B (~31.0 GiB) |
| `AvailableBytes` | `MemAvailable` in `/proc/meminfo` | 21,831,772 kB |

`MemAvailable` is the correct figure, not `MemFree`. `MemFree` excludes reclaimable page cache and
understates what a model load can actually claim, which would make the
`HardwareSettings.PreflightMemory` preflight reject loads that would have succeeded. If
`MemAvailable` is missing (pre-3.14 kernels), fall back to `MemFree + Buffers + Cached`.

`MemoryInfo.UsedBytes` is computed in the record as `TotalBytes - AvailableBytes`; do not
populate it independently and do not try to write to a record with only `init`-style properties.

### 7.3 GPUs

GPU enumeration is the only part of the monitor that shells out, and it is where the CPU-only
fallback in UC-02 originates.

**Enumeration** — `lspci -mm -nn`, filtered to class `0300` (VGA), `0302` (3D controller) and
`0380` (display controller). Two devices are present:

```
00:02.0 VGA compatible controller: Intel Corporation Skylake-H GT2 [HD Graphics 530] (rev 06)
01:00.0 VGA compatible controller: NVIDIA Corporation GM107GLM [Quadro M1000M] (rev a2)
```

`lspci` is at `/usr/bin/lspci` and needs no privileges for this query. Parse the `-mm -nn` form
rather than the human-readable form; the free-form text is locale- and revision-dependent, the
machine-readable fields are not. Note that `lspci -mm 01:00.0` with a device argument is rejected
by this `pciutils` build — filter the full list in-process instead of passing selectors.

**Vendor and driver binding** — walk `/sys/bus/pci/devices/<slot>/` for `vendor` and `device`
(a sysfs bind-mount of `/usr/share/hwdata/pci.ids` gives readable names without parsing `lspci`
text) and `driver` for the bound kernel module. Also useful: `/sys/class/drm/renderD*` enumerates
render nodes, and `/dev/dri/renderD128` (Intel) and `renderD129` (NVIDIA) both exist here.

**Vendor-specific data:**

- NVIDIA: `nvidia-smi --query-gpu=name,memory.total,memory.used,driver_version
  --format=csv,noheader,nounits`. Verified output: `Quadro M1000M, 4096, 0, 580.178.04`.
  `memory.total` of 4096 MiB is 4,294,967,296 B. This is the only source of true NVIDIA VRAM, since
  PCI BAR size is a 256 MiB-aligned aperture and not the card's memory.
- Intel/AMD: no `nvidia-smi` equivalent. `TotalMemoryBytes` is reported from
  `/sys/class/drm/cardN/device/mem_info_vram_total` where it exists (AMD) and otherwise set to 0
  with a note in the log. Do not guess VRAM from BAR size for these; shared-memory iGPUs like the
  HD Graphics 530 report system RAM, not dedicated VRAM.

**Compute capability.** `GpuInfo.ComputeApi` is set by probing, in this order:

1. NVIDIA + `nvidia-smi` succeeded → `"cuda"`, `IsUsableForInference = true`.
2. `vulkaninfo --summary` succeeded and listed a device → `"vulkan"`. Verified on the reference
   machine: `Intel (R) HD Graphics 530 (SKL GT2)` on the `Intel open-source Mesa driver`, and
   `Quadro M1000M` on `NVIDIA`. `vulkaninfo` is at `/usr/bin/vulkaninfo`, with ICDs in
   `/usr/share/vulkan/icd.d/` (`intel_hasvk_icd.json`, `intel_icd.json`, `nvidia_icd.json`).
   Vulkan compute is a real path for GPU offload but is a larger implementation than the CUDA
   backend, so MVP treats it as informational.
3. `nvidia-smi` failed but the device is bound to the `nouveau` or `nvidia` module → `ComputeApi`
   stays null, `IsUsableForInference = false`. This is the "GPU present, no usable driver" state.
4. Nothing → the device is still listed with `IsUsableForInference = false`.

**The GPU-present-but-not-usable case.** This is not an error and must not be rendered as one. On
this machine, if the proprietary NVIDIA driver were absent, `01:00.0` would still enumerate from
`lspci` while `nvidia-smi` would fail. The contract then is:

- `GpuInfo` is still present in `HardwareSnapshot.Gpus`, with the real name and vendor, so the user
  sees what is in the machine.
- `IsUsableForInference = false` and `ComputeApi = null`.
- The Home screen (UC-07) shows the GPU row with an explicit "driver not available for compute"
  state, and offers a one-line remedy: install the `nvidia` driver package for the Quadro, or use
  the Intel integrated GPU. It does not show a bare 0-byte VRAM figure, which reads as a
  hardware fault.
- The runtime selector (UC-02) offers CPU inference and marks GPU offload unavailable with the
  reason. When `HardwareSettings.ForceCpuOnly` is true, CPU is selected regardless, and the GPU row
  is informational only.

`HardwareSnapshot.HasGpu` is true in this case, so it must not be used as the "can we use a GPU"
test. The UI's CPU-only notice is gated on `HasGpu == false`; the degraded-GPU notice is gated on
`HasGpu && Gpus.All(g => !g.IsUsableForInference)`. Those are two different messages.

**Process spawn budget.** `lspci` and `nvidia-smi` cost tens of milliseconds each. Enumerate once
at startup and cache for 30 s; `/proc` and sysfs values are read on every capture. `nvidia-smi`
utilisation queries for the live Home readout are polled on the same cadence as the rest of the
snapshot and are cancellable, so closing the app mid-poll cannot leave an orphan `nvidia-smi`.

## 8. DPI scaling

PRODUCT_SPEC.md §5 requires 100%, 125%, 150% and 200%.

On Wayland, scaling is a per-output compositor property. The compositor sends the client a buffer
size in device pixels together with a `wl_surface.set_buffer_scale` (integer scale) or, with the
`fractional-scale-v1` protocol, a scale factor such as 1.25 or 1.5. Avalonia's X11/Wayland backends
consume that scale factor and render at it. The application receives a
`ScalingFactorChanged` event and updates its pixel metrics; there is no per-application DPI override
to request.

Consequences that shape what the app must and must not do:

- **The scaling requirement is largely free.** 125% and 150% are the compositor's job on Wayland.
  The app must not implement a DPI switch of its own, and must not multiply font sizes by a scale
  factor it read from somewhere — that double-applies the scale.
- **On X11**, Avalonia receives the X resource DPI and applies its own scaling. X11 fractional
  scaling is generally absent, so 125% and 150% are only reproducible on X11 if the compositor
  supports the RandR 1.5 scaling mode and exports it. Where it does not, the app renders at
  whatever integer scale X reports and the user sees 100% or 200%, not 125%. This is a compositor
  limitation and is documented, not worked around.
- **Layout must be scale-independent.** All sizes come from Avalonia's device-independent units. The
  spec's 1280x720 minimum window is in DIPs, not device pixels; a 1280x720 DIP window at 200% is
  2560x1440 physical pixels, which fits the 4K upper bound.
- **Surfaces the app does not own are not scaled.** The SNI tray icon is rasterised by the panel at
  panel size. Ship a 22x22 and a 24x24 `hicolor` icon set in the AppImage; a single 256x256 icon
  downsampled by the panel looks soft.
- **Bitmaps generated by the app** (previews, thumbnails) should be generated at
  `RenderScaling * logicalSize` and displayed in DIPs, or previews will be soft at 150% and 200%.

`AvaloniaXamlLoader` picks up the scale through `TopLevel.RenderScaling`; nothing in
`JugaadVision.Platform` is involved. This item is listed here only to record that it was considered
and requires no Linux-specific code.

## 9. Packaging

### 9.1 Publish

```
dotnet publish src/desktop/JugaadVision.App/JugaadVision.App.csproj \
  -c Release -r linux-x64 --self-contained true \
  -p:PublishSingleFile=true \
  -p:IncludeNativeLibrariesForSelfExtract=true \
  -p:DebugType=none -o dist/jugaadvision
```

A self-contained `linux-x64` publish is already verified working on this machine. That is the
load-bearing fact: the app ships with the .NET runtime inside it, so the target machine needs no
.NET installation, which is the whole point of replacing MSIX.

Two caveats. `JugaadVision.App.csproj` currently sets `<OutputType>WinExe</OutputType>`, which on
Linux produces a console-attaching binary; that must become `Exe`. And single-file publish plus
Avalonia requires `IncludeNativeLibrariesForSelfExtract=true` or `libSkiaSharp`/Avalonia native
assets fail to resolve at startup.

A `linux-arm64` RID publish is a separate matrix entry and is not verified; the reference machine is
x86-64 only. Do not claim ARM64 support in release notes until it has been published and run.

### 9.2 AppImage

AppImage is the AppImage answer to MSIX: a single self-mounting file, no root install, no package
manager.

```
appimagetool --no-appstream \
  --arch x86_64 \
  dist/AppDir jugaadvision-0.1.0-x86_64.AppImage
```

Neither `appimagetool` nor `linuxdeploy` is installed on the reference machine. The build must
either install it (from AppImageKit, not AUR, so the build is reproducible) or the AppImage step is
skipped and a `.tar.gz` is published instead. This is a real gap in the toolchain, not a design
choice, and it should be closed before any release.

AppDir layout the build must produce:

```
AppDir/
  AppRun                        -> usr/bin/jugaadvision
  jugaadvision.desktop          -> usr/share/applications/jugaadvision.desktop
  jugaadvision.png/.svg         -> usr/share/icons/hicolor/{22x22,24x24,48x48,256x256}/apps/
  jugaadvision-jgvproj.xml      -> usr/share/mime/packages/
  usr/bin/jugaadvision          (self-contained publish output)
  usr/lib/                      (bundled native deps: llama.cpp, sqlite)
```

A hard constraint for an AppImage: the SquashFS mount is read-only and `noexec`-prone. All writable
state — settings, SQLite database, downloaded models, staging, secrets file — must live under
`$XDG_DATA_HOME/jugaadvision` / `$XDG_CONFIG_HOME/jugaadvision` / `$XDG_CACHE_HOME/jugaadvision`.
`GenerationSettings.OutputDirectory` already defaults to null and "defaults to the XDG user data
dir", which is what makes this work; the packaging step must not write anywhere under `AppDir`.

### 9.3 tar.gz

`tar --zstd -cf jugaadvision-0.1.0-linux-x64.tar.xz -C dist/AppDir .` with a separate
`./install.sh` that copies the desktop entry and MIME package into `/usr/share` and runs
`update-desktop-database`. This is the fallback for a machine that cannot run FUSE, and it is the
distribution channel for the flatpak/snap wrappers later if either is pursued.

### 9.4 Paths

| Purpose | Path | Env override |
|---------|------|--------------|
| Settings JSON | `$XDG_CONFIG_HOME/jugaadvision/settings.json` | `XDG_CONFIG_HOME` (default `~/.config`) |
| SQLite database | `$XDG_DATA_HOME/jugaadvision/jugaadvision.db` | `XDG_DATA_HOME` (default `~/.local/share`) |
| Logs | `$XDG_STATE_HOME/jugaadvision/logs/` | `XDG_STATE_HOME` (default `~/.local/state`) |
| Cache / staging | `$XDG_CACHE_HOME/jugaadvision/` | `XDG_CACHE_HOME` (default `~/.cache`) |
| Models | `$XDG_DATA_HOME/jugaadvision/models/` | `ModelSettings.ModelDirectories` |
| Generated assets | `$XDG_DATA_HOME/jugaadvision/assets/` | `GenerationSettings.OutputDirectory` |
| Secrets (fallback) | `$XDG_CONFIG_HOME/jugaadvision/secrets.enc` | — |
| Single-instance lock | `$XDG_RUNTIME_DIR/jugaadvision.lock` | — |

The spec's Windows equivalent, `%LOCALAPPDATA%`, maps to `XDG_DATA_HOME`. This satisfies the spec
requirement "user content survives app restart and uninstall" — an AppImage is deleted by removing
one file, and the data directory is untouched.

`FilePath` in `AppProject` is the path of the backing `.jgvproj`. On Linux this is a normal path
under the user's home. Two rules: paths are stored as given, never normalised to Windows-style
separators or drive letters, and relative paths are resolved against the project file's own
directory when the project is opened (so a project plus its assets can be moved together).

## 10. Implementation shape in `JugaadVision.Platform`

Proposed file layout. Nothing here exists yet.

```
JugaadVision.Platform/
  Secrets/
    LibSecretSecretStore.cs          ISecretStore over libsecret-1
    NativeMethods.cs                 SecretService/SecretItem/secret_* P/Invoke
    EncryptedFileSecretStore.cs      ISecretStore, AES-256-GCM + PBKDF2
    AeadFileCipher.cs                encrypt/decrypt/write-atomic
  Notifications/
    FreedesktopNotificationService.cs
    NotificationServerProxy.cs       org.freedesktop.Notifications binding
  Tray/
    StatusNotifierTrayService.cs     ISystemTrayService
    StatusNotifierItem.cs            the SNI object and its properties
    TrayMenu.cs                      exported Menu object
  Hardware/
    LinuxHardwareMonitor.cs          IHardwareMonitor
    ProcCpuReader.cs                 /proc/cpuinfo + sysfs topology
    ProcMemoryReader.cs              /proc/meminfo
    DiskSpaceReader.cs               statvfs, filters pseudo and duplicate mounts
    PciGpuEnumerator.cs              lspci + sysfs, per-GPU records
    NvidiaSmiProbe.cs                VRAM and driver version
    VulkanProbe.cs                   compute capability fallback
  SingleInstance/
    SingleInstanceLock.cs            runtime lock file
    OpenRequestInbox.cs              $XDG_RUNTIME_DIR open-file hand-off
  Packaging/  (not compiled; docs + the .desktop/MIME templates that ship)
  DependencyInjection/
    ServiceCollectionExtensions.cs   AddJugaadVisionPlatform()
```

The `JugaadVision.Platform.csproj` will need, when implementation starts: `AllowUnsafeBlocks` for
the `libsecret` P/Invoke, and possibly a `System.Net.Sockets`/`System.IO.Pipes` reference for
`System.IO.Pipes` (in-box). Central package management is in force, so any new dependency must be
registered in `Directory.Packages.props`, not inline in the csproj.

`TreatWarningsAsErrors` is on for every project in the solution. A library whose P/Invoke signature
is wrong must fail the build on the nullable/unused warnings, not at runtime on a user's machine.

Registration, in the App composition root:

```csharp
services.AddJugaadVisionPlatform(sp => sp
    .AddSingleton<IPlatformPaths, XdgPlatformPaths>()
    .AddSingleton<IHardwareMonitor, LinuxHardwareMonitor>()
    .AddSingleton<INotificationService, FreedesktopNotificationService>()
    .AddSingleton<ISystemTrayService, StatusNotifierTrayService>()
    .AddSingleton<ISecretStore>(sp => SecretStoreFactory.Create(sp))
    .AddSingleton<IFileDialogService, AvaloniaFileDialogService>());
```

`SecretStoreFactory.Create` is the one place that decides Secret Service versus file fallback, so
the choice is visible in one function and testable.

## 11. Requirement mapping: Windows to Linux

| Original Windows requirement | Linux equivalent | Justification |
|------------------------------|------------------|---------------|
| WinUI 3 / `NavigationView` shell | Avalonia 12.1.3 shell, `UsePlatformDetect` | Avalonia is already the pinned UI framework in `Directory.Packages.props` and the App project; the reference build compiles |
| Credential Manager / DPAPI | Secret Service via `libsecret-1` (P/Invoke), AES-256-GCM file fallback with a user-supplied key | freedesktop standard, implemented by GNOME Keyring and KWallet, verified live on the reference machine. No DPAPI-equivalent primitive exists on Linux; the fallback's key problem is stated in §2.2 rather than papered over |
| MSIX installer | AppImage (primary) plus `.tar.gz` (fallback), both from a self-contained `linux-x64` publish | Self-contained publish already verified. AppImage is the closest Linux analogue: one file, no root, no package manager. MSIX is unobtainable here because MSIX tooling is Windows-only |
| `NotifyIcon` / system tray | StatusNotifierItem over D-Bus, `org.kde.StatusNotifierWatcher` | The current freedesktop tray protocol. Portable risk documented in §4.2: GNOME needs `ubuntu-appindicator`, wlroots compositors need a separate host; a tray-less run is a supported configuration |
| Toast notifications | `org.freedesktop.Notifications` D-Bus service | The Linux desktop notification standard, present in this session |
| File associations (`.jgvproj`) | `.desktop` entry with `MimeType`, `xdg-mime install`, a `shared-mime-info` package, `StartupWMClass` | The freedesktop mechanism. `xdg-mime` present at `/usr/bin/xdg-mime` and verified working. Content magic added so the association is not purely extension-driven |
| Second launch opens in running instance | D-Bus activation (`DBusActivatable`) plus an `$XDG_RUNTIME_DIR` lock file | Two mechanisms because the AppImage case bypasses activation. Both converge on one `OpenProjectAsync` |
| Native file pickers | Avalonia `StorageProvider` (portal on Wayland, GTK interop on X11) | Uses the desktop's own dialogs, themed consistently with the app, unlike a `zenity` subprocess |
| DPI 100/125/150/200% | Wayland `wl_surface.set_buffer_scale` and `fractional-scale-v1`, consumed by Avalonia | Largely free: the compositor owns scaling and Avalonia renders at the scale it is given. §8 records the X11 fractional-scaling gap and forbids the app from scaling itself |
| `WMI` / `Win32_VideoController` | `/proc/cpuinfo`, `/proc/meminfo`, sysfs CPU topology, `lspci`, `nvidia-smi`, `vulkaninfo`, `statvfs` | All present and verified on the reference machine. `nvidia-smi` is the only trustworthy NVIDIA VRAM source |
| `%LOCALAPPDATA%` data root | `$XDG_DATA_HOME/jugaadvision` | The XDG Base Directory specification; satisfies the "survives uninstall" requirement, which an AppImage cannot do in-place |
| `System.Diagnostics.Process` for `nvidia-smi` | `System.Diagnostics.Process` on .NET, same API | No port needed; only the arguments change |

## 12. Test strategy

The platform layer is where tests are cheapest, because the interfaces are narrow and the
dependencies are all local binaries.

- **`LinuxHardwareMonitor` against the real machine.** A test asserts the reference machine's
  `CpuInfo.PhysicalCoreCount == 4`, `LogicalCoreCount == 8`, `MemoryInfo.TotalBytes > 30 GiB`, and
  that `Gpus` contains the Intel HD Graphics 530 and the Quadro M1000M. This is a smoke test
  against `/proc`, not a unit test with a fake, and it is skipped when `/proc/meminfo` is absent.
- **A `FakeFileSystem` and an injected `IProcessRunner` for lspci/nvidia-smi.** The GPU branch
  matrix (`nvidia-smi` ok / absent / failing) is the one worth exhaustively covering, because the
  `IsUsableForInference = false` path is the most likely to be wrong and the least likely to be hit
  by a human tester. Feed it recorded `nvidia-smi` CSV for all three states.
- **`EncryptedFileSecretStore` round trip.** Encrypt, decrypt, compare; assert the file is not
  plaintext-searchable; assert a wrong passphrase returns `null` and does not throw; assert the GCM
  tag rejects a tampered payload. This is the one place where a bug leaks credentials.
- **A tray service test that runs only when a StatusNotifierWatcher is present.** It is a
  capability probe, not a requirement.
- **Headless Avalonia for the file dialogs** (`Avalonia.Headless` is already referenced) to
  confirm `FileFilter` to `FilePickerFileType` conversion.
- **A packaging smoke test**: publish self-contained, run `./JugaadVision.App --version` from the
  publish directory, and assert the process starts. This is the regression guard for the
  `PublishSingleFile` plus native-library-extraction trap in §9.1.

## 13. Open risks

1. **Tray portability.** The largest portability risk. Mitigation in §4.2; the app must remain
   fully usable with no tray.
2. **AppImage toolchain is not installed.** `appimagetool` and `linuxdeploy` are both absent. Until
   that is fixed, the only shippable artifact is a tarball, which is a worse experience than MSIX.
   Close this first.
3. **`.jgvproj` content magic requires a Storage change.** The `JUGAADVISION` preamble must be
   written and skipped by the serialiser, and it is not compatible with a project file written by an
   earlier build. `AppProject.SchemaVersion`-style handling is needed.
4. **Single-instance coverage is untested.** Both paths (D-Bus activation and lock file) need to be
   exercised from a real second process, not from within one test process.
5. **Multi-GPU selection is unspecified.** This machine has two GPUs. Whether the app uses the
   Quadro, the Intel iGPU, or lets the user pick is a product decision that `HardwareSettings`
   (which has only `ForceCpuOnly`, `ThreadCount` and `VramBudgetBytes`) does not currently express.
   Flag it before the Hardware settings screen is built.
6. **ARM64 is unpublished and unverified.** Do not claim it.
