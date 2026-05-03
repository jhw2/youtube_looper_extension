# Release Build

The repo keeps GA4 production secrets out of git. Create a Chrome Web Store
release build with prod analytics injected only into the generated `dist`
folder.

## Build

Create `env.local` in the project root:

```bash
GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA_API_SECRET=your_api_secret
```

Then run from the project root:

```bash
npm run build:release
```

The script reads `env.local`, injects those values into the release-only copy of
`background.js`, and creates:

```text
dist/youtube-looper-extension-chrome-webstore.zip
```

Upload the generated zip to the Chrome Web Store. The release bundle includes
only extension files, so `node_modules`, `package.json`, and other local
development files stay out of the upload.

## Local Development

- Source files in the repo keep `ANALYTICS_CONFIG` empty.
- Local testing does not send prod GA events unless you manually store config in
  `chrome.storage.local`.
- You can still keep your own browser excluded with the analytics opt-out flag.
