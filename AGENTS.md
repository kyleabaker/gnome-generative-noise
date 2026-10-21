# Agent & Developer Guidelines: GNOME Generative Noise

This document defines the coding standards, security requirements, architectural guidelines, and contribution rules for maintaining and extending the **Generative Noise** GNOME Shell extension.

---

## 1. Code Standards & JavaScript (GJS) Best Practices

- **ES Modules (ESM):** All runtime scripts (`extension.js`, `prefs.js`) must be written using standard ECMAScript modules compatible with modern GNOME Shell (45+).
- **JSDoc Documentation:** Every class, method, and private helper function must be documented using clear JSDoc comments detailing parameters, return types, and visibility (`@private`).
- **Strict Null/Undefined Hygiene:** Always validate object existence and schema defaults defensively before runtime property access.

---

## 2. Security & Fuzzing Guidelines

- **No Shell String Evaluation:** Never use `GLib.spawn_command_line_async` or shell-evaluated strings for executing system binaries or pipeline parameters. Always use array-based argument passing (`GLib.spawn_async`).
- **Input Sanitization:** All values retrieved from `GSettings` (such as `noise-type` or `volume`) must be strictly validated against whitelist arrays and mathematical bounds before being passed to system APIs or process arguments.

---

## 3. UI/UX & Accessibility (a11y) Standards

- **GNOME HIG Compliance:** Widgets must adhere strictly to the GNOME Human Interface Guidelines, utilizing standard Libadwaita components in preferences windows and Shell Toolkit (`St`) widgets in panel extensions.
- **Accessibility Labels:** All interactive `St.Button` and `PanelMenu.Button` instances must include explicit `accessibility_label` properties for screen reader (Orca) compatibility.

---

## 4. Lifecycle & Memory Management Rules

- **Signal Disconnection:** Every signal connected via `.connect()` (on `GSettings`, `Gio.DBusProxy`, or custom objects) must have a corresponding `.disconnect()` call implemented inside the `disable()` lifecycle method.
- **Resource Destruction:** Menu hierarchies, panel indicators, and custom layout boxes must be explicitly destroyed (`.destroy()`) on disable to prevent memory leaks in the GNOME Shell process.
- **Orphan Prevention:** Background processes must be tracked by PID and sent a termination signal (`kill -15`) during disable or reload routines.
