# Native permissions and deep-link checklist

The native projects are created with Capacitor after the web bundle is configured. Review these values in the generated iOS and Android projects before testing GetStream RTC.

## iOS (`ios/App/App/Info.plist`)

Add clear, user-facing explanations:

```xml
<key>NSCameraUsageDescription</key>
<string>MAI Life Wars uses your camera when you choose to broadcast in a live battle.</string>
<key>NSMicrophoneUsageDescription</key>
<string>MAI Life Wars uses your microphone when you choose to speak during a live battle.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>MAI Life Wars lets you choose a profile image for your fighter profile.</string>
```

Only add additional usage descriptions when the corresponding feature is implemented and enabled.

## Android (`android/app/src/main/AndroidManifest.xml`)

Verify that the generated manifest includes the permissions required by the selected GetStream SDK and Capacitor plugins, at minimum:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.INTERNET" />
```

Request camera and microphone permissions in context, explain why they are needed, and gracefully handle denial. A spectator must not be prompted to broadcast unless they explicitly choose to become a participant.

## Password reset and PayPal return

Configure a verified HTTPS hosting subdomain for the Supabase recovery redirect and PayPal return/cancel URLs. If you later configure app/universal links, verify the association files and native URL handling on real devices. Do not assume that a browser redirect automatically returns to the installed app.

## Recording consent

Promotional recording is off by default. Do not start a recording until the backend has confirmed current consent for every participant, the app has shown a clear recording notice, and the selected GetStream recording API has been verified. Moderation transcription and promotional video recording are separate purposes and must not be conflated.
