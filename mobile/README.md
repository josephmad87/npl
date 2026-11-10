# NPL mobile

Expo SDK 58 app for Android and iOS, using the same Expo/EAS delivery workflow as Takashinga. NPL has its own project and platform identifiers.

## Current scope

Native fixtures and news, pull-to-refresh, saved public content for offline reading, connection errors, foreground refresh and links to the website's match centre and supporter account. Snapshots are explicitly labelled; they are not a live-scoring subscription. Team lookup currently covers the first 100 records and fixtures the first 30. Pagination and native match detail are follow-up work.

Supporter account functions use the website inside an embedded view; native account storage is not implemented. Home, Live, Results, News and My NPL have bottom navigation. Match and article links stay inside the app. The home screen uses the website palette and logo, official story photography and recent results. Push registration/delivery is not yet implemented. Do not present this as the complete store release.

## Local checks

Run `npm ci`, `npm run typecheck`, and `npx expo lint`. Start with `npx expo start` and test in Expo Go. `EXPO_PUBLIC_API_URL` can override the public API; never put a private key in public configuration.

## Build profiles

- `preview`: signed, directly installable Android APK; iOS internal distribution requires registered devices and signing.
- `simulator`: iOS simulator build without store distribution.
- `production`: Android App Bundle and iOS App Store/TestFlight candidate; no automatic submission.

Use `eas build --platform android --profile preview` for Android testing and `eas build --platform ios --profile simulator` for an iOS simulator. For TestFlight, use the production profile after Apple signing is configured.

## Before distribution

Verify app identifiers against existing Firebase and store registrations. Configure NPL-specific push credentials, notification preferences and deep links. Verify API payloads, account/deletion links, physical-device behavior, offline/reconnect, TalkBack/VoiceOver and low-memory performance. Run the release checks in ../ops/ACCEPTANCE_CRITERIA.md. Store builds require account/signing setup and store review; a bundle export alone is not an installable app or acceptance.


## iPhone with Expo Go (free testing)

Install Expo Go from https://expo.dev/go and use `npm run start:iphone` on this Mac. Scan the generated preview QR with the iPhone Camera. Keep the Mac awake and connected. The tunnel allows the phone to use a different network. Sign into the same Expo account as the CLI if Expo Go requests it. This app targets SDK 58; update Expo Go if it reports an SDK mismatch.

The preview uses headless mode to avoid the optional React Native desktop debugger startup that stalled on this Mac. The preview manifest was verified locally and through the tunnel; the iOS JavaScript bundle returned HTTP 200 (5.75 MB). Physical iPhone rendering remains to be tested.
