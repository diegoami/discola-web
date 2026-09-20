# mobile/ — the Android wrapper

Capacitor packages `public/` — the same directory Netlify serves — into an APK.
There is no build step and no `beforeBuildCommand`: `cap sync` copies the
directory as it stands. See [`../ANDROID.md`](../ANDROID.md) for the whole plan.

## The identity, and why it is here

`capacitor.config.json` is where the app's identity is **recorded**. It is JSON
rather than Geoclick2027's `capacitor.config.ts` because Discola has no
TypeScript toolchain and this file does not justify introducing one.

| key | value | |
|---|---|---|
| `appId` | `com.discola.app` | the package name — **permanent** |
| `appName` | `Discola` | what shows under the icon; freely changeable |
| `webDir` | `../public` | relative to this file |

`appId` is the one that cannot be taken back. `cap add android` copies it into
`android/app/build.gradle` as `namespace` and `applicationId`, and from there it
goes into the manifest and into the store listing. Once an APK with that id has
been installed or published, a different id is a different app: it installs
alongside rather than upgrading, and the old one can never be updated again.
Changing it after `cap add android` means editing the generated Gradle files
too, or deleting `android/` and regenerating.

`appName` is only a label and can change in any release.

## android/ — generated and committed

`android/` exists and is committed, minus `keystore.properties` and any `*.jks`,
which must never be. It was produced by `cap add android` against the SDK, and
`cap sync android` copies `../public` into it. Regenerating is only needed after
changing `appId`; `../ANDROID.md` §3 has the toolchain and §5 the packaging.

```sh
cd mobile
npm install
npx cap sync android     # needs ANDROID_HOME
```
