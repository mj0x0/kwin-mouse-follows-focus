/*
    Mouse Follows Focus — KWin script for Plasma 6 (Wayland & X11)

    KDE ships "Focus follows mouse" but not the reverse. This script adds it:
    whenever window focus changes — Alt+Tab, a global shortcut, a tiling manager
    (Polonium), clicking a taskbar entry, a new window grabbing focus —
    the pointer is warped onto the newly focused window.

    Crucially, if focus changed because the pointer was already over (or right
    beside) the window — ordinary focus-follows-mouse hovering, or resting on the
    seam between two tiles — nothing happens, so casually moving the mouse across
    windows never yanks the cursor around.

    The warp itself reuses KWin's own built-in action "Move Mouse to Focus"
    (shortcut id "MoveMouseToFocus"), invoked over D-Bus via kglobalaccel. That
    keeps it native and flicker-free — no interactive-move/tile-editor hacks and
    no external tools (ydotool, xdotool, qdbus).

    This was only tested against Polonium 1.2.0 and KDE 6.7.2, but should work with any tiling script or layout for KDE.
    This will work best when the "Focus follows mouse" option is enabled in System Settings > Window Management > Window Behavior > Focus.

    Debug log:
        journalctl -b -f | grep -i "mousefollowsfocus:"
*/

const PREFIX = "mousefollowsfocus: ";

// While the user is interactively moving/resizing a window (e.g. dragging the
// shared border between two tiles), focus can flip to the neighbour. Warping the
// pointer then would yank it off the resize handle mid-drag. So we suppress warps
// during an interaction and for a short grace period afterwards — long enough to
// also swallow the focus re-evaluation KWin does on button-release.
const INTERACTION_GRACE_MS = 300;

const config = {
    // When true, skip the warp if the pointer already sits on (or right next to)
    // the newly focused window — i.e. focus most likely followed the mouse there.
    onlyWhenPointerOutside: true,
    // How many pixels of slack around a window's frame still count as "on" it.
    // This is what stops the cursor being yanked when you hover the seam/gap
    // between two tiles to grab a resize handle. Increase it if you use large
    // tile gaps and focus is still stolen there; 0 restores a strict inside-test.
    borderMargin: 32,
    // Enable for debug logging to journalctl
    debug: false,
};

// Timestamp (ms) of the most recent move/resize event on any window.
let lastInteraction = 0;

function loadConfig() {
    config.onlyWhenPointerOutside = readConfig("onlyWhenPointerOutside", true);
    config.borderMargin = readConfig("borderMargin", 32);
    config.debug = readConfig("debug", false);
}

function log(message) {
    console.info(PREFIX + message);
}

function debug(message) {
    if (config.debug) {
        log(message);
    }
}

/**
 * Whether a window is a real, interactive target we should warp the pointer to.
 * Excludes panels, the desktop, OSDs, notifications, menus, tooltips, etc.
 */
function isEligible(window) {
    if (!window || window.deleted) {
        return false;
    }
    if (window.minimized) {
        return false;
    }
    if (window.specialWindow) {
        return false;
    }
    if (
        window.dock ||
        window.desktopWindow ||
        window.notification ||
        window.criticalNotification ||
        window.onScreenDisplay ||
        window.tooltip ||
        window.splash ||
        window.dndIcon ||
        window.dropdownMenu ||
        window.popupMenu ||
        window.comboBox
    ) {
        return false;
    }
    return true;
}

/**
 * Whether the global pointer lies within `margin` pixels of the window's frame.
 *
 * A plain inside-test isn't enough for tiled layouts: when two tiles sit side by
 * side with a gap, the pointer hovering that gap (to grab a resize handle) is
 * outside *both* frames, yet focus-follows-mouse may hand focus to the neighbour.
 * Warping then yanks the cursor off the seam. Treating the frame as inflated by a
 * small margin absorbs the gap and the resize-handle band, so seam-hovering no
 * longer triggers a warp — while a genuine switch to a window whose nearest edge
 * is farther than `margin` away still does.
 */
function pointerNear(window, margin) {
    const p = workspace.cursorPos;
    const g = window.frameGeometry;
    return (
        p.x >= g.x - margin &&
        p.x < g.x + g.width + margin &&
        p.y >= g.y - margin &&
        p.y < g.y + g.height + margin
    );
}

/**
 * Warp the pointer onto the currently focused window using KWin's native
 * "Move Mouse to Focus" action. It always acts on the active window, which — at
 * the moment windowActivated fires — is exactly the window we care about.
 */
function warpToFocus() {
    callDBus(
        "org.kde.kglobalaccel",
        "/component/kwin",
        "org.kde.kglobalaccel.Component",
        "invokeShortcut",
        "MoveMouseToFocus"
    );
}

/** Whether a move/resize interaction happened within the grace window. */
function interactionInProgress() {
    return Date.now() - lastInteraction < INTERACTION_GRACE_MS;
}

function noteInteraction() {
    lastInteraction = Date.now();
}

/** Subscribe a window's move/resize signals so we can suppress warps during drags. */
function trackWindow(window) {
    window.interactiveMoveResizeStarted.connect(noteInteraction);
    window.interactiveMoveResizeStepped.connect(noteInteraction);
    window.interactiveMoveResizeFinished.connect(noteInteraction);
}

function onWindowActivated(window) {
    if (!isEligible(window)) {
        debug("ignoring activation of ineligible window: " + (window ? window.caption : "null"));
        return;
    }

    if (interactionInProgress()) {
        debug("move/resize in progress, not warping to '" + window.caption + "'");
        return;
    }

    if (config.onlyWhenPointerOutside && pointerNear(window, config.borderMargin)) {
        debug("pointer already on/near '" + window.caption + "', not warping");
        return;
    }

    debug("warping pointer to '" + window.caption + "'");
    warpToFocus();
}

function main() {
    loadConfig();
    workspace.windowList().forEach(trackWindow);
    workspace.windowAdded.connect(trackWindow);
    workspace.windowActivated.connect(onWindowActivated);
    log("started (onlyWhenPointerOutside=" + config.onlyWhenPointerOutside +
        ", borderMargin=" + config.borderMargin + ")");
}

main();
