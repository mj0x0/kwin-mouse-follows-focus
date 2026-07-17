# Changelog

All notable changes to this project are documented here. This project adheres to
[Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-07-17

Initial release.

### Added
- Warp the pointer onto a window when it gains focus (Alt+Tab, global shortcuts,
  tiling managers such as Polonium/Karousel, taskbar clicks, or a new window
  taking focus), using KWin's native `MoveMouseToFocus` action over D-Bus — no
  external tools (ydotool, xdotool, qdbus) and no interactive-move/tile-editor
  hacks.
- Pointer-proximity guard: if the cursor is already on — or within a configurable
  margin of — the newly focused window, no warp happens, so ordinary
  focus-follows-mouse hovering never yanks the cursor around.
- Move/resize guard: warps are suppressed during (and briefly after) an
  interactive move or resize, so dragging a window or a tile border is never
  interrupted.
- "Seam/gap tolerance" setting (default 32 px) that absorbs the gap between tiled
  windows and the resize-handle band — hovering the seam to grab a resize handle
  no longer steals focus and warps the cursor away.
- Ignores panels, the desktop, OSDs, notifications, menus, tooltips, and
  minimized/special windows.
- Configurable from System Settings → Window Management → KWin Scripts
  (pointer-outside toggle, seam/gap tolerance, debug logging).
- Works on Plasma 6, both Wayland and X11. Tested against Plasma 6.7.2 with
  Polonium 1.2.0.

[1.0.0]: https://github.com/mj0x0/kwin-mouse-follows-focus/releases/tag/v1.0.0
