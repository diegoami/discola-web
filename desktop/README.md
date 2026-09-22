# desktop/ — the Tauri wrapper

Packages `public/` — the same directory Netlify serves — into a Windows desktop
app. Like `mobile/`'s Capacitor wrapper it adds **no build step**:
`public/` stays a directory of static files and Tauri embeds it unchanged, which
is what keeps the web build toolchain-free (`SPEC.md` §2).

| key | value | |
|---|---|---|
| identifier | `com.discola.desktop` | **permanent** — it keys the webview's storage |
| frontendDist | `../../public` | relative to `src-tauri/tauri.conf.json` |
| window | 1280 × 800 | the size `tools/check_ui.mjs` asserts |

`com.discola.desktop` cannot be changed after a release: `localStorage` is scoped to the
webview origin, so a different identifier is a different app with empty storage.
That is why the spike's `net.discoa.spike` was thrown away.

## Build

```sh
npm ci
npm run build        # tauri build --no-bundle
```

The executable lands at `src-tauri/target/release/discola.exe`.

Installers and code signing remain deferred. Packaging and publishing — both
targets, one release — are `tools/package_release.mjs` and
`tools/publish_release.mjs`; see [`../DESKTOP.md`](../DESKTOP.md)'s Releasing
section.

## Icons

Do not edit `src-tauri/icons/` by hand. They are generated, with the web and
Android icons, by `tools/make_icons.py`:

```sh
python3 tools/make_icons.py
```
