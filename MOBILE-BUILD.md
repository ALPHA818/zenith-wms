# Mobile Build Guide - Android & iOS

This guide explains how to build and deploy **Zenith WMS** as native mobile applications for Android and iOS.

## Prerequisites

### For Android Development
- **Node.js** (v16 or higher)
- **Java Development Kit (JDK)** 17 or higher
  - Download from [Oracle](https://www.oracle.com/java/technologies/downloads/) or use OpenJDK
  - Set `JAVA_HOME` environment variable
- **Android Studio**
  - Download from [developer.android.com](https://developer.android.com/studio)
  - Install Android SDK (API 33 or higher recommended)
  - Install Android SDK Build-Tools
  - Set `ANDROID_HOME` or `ANDROID_SDK_ROOT` environment variable

### For iOS Development (macOS only)
- **macOS** (required for iOS development)
- **Xcode** 14 or higher
  - Download from Mac App Store
  - Install Xcode Command Line Tools: `xcode-select --install`
- **CocoaPods**
  - Install: `sudo gem install cocoapods`

## Initial Setup

### 1. Build the Web Application
First, build your web application:
```bash
npm run build:mobile
```

This creates an optimized production build in the `dist/` directory.

### 2. Initialize Mobile Platforms

#### Option A: Set up both platforms at once
```bash
npm run mobile:setup
```

#### Option B: Set up platforms individually
```bash
# Add Android platform
npm run cap:add:android

# Add iOS platform (macOS only)
npm run cap:add:ios
```

This creates `android/` and `ios/` directories with native project files.

## Building for Android

### 1. Sync Web Assets to Android
After any changes to your web code, sync to Android:
```bash
npm run build:android
```

Or manually:
```bash
npm run build:mobile
npm run cap:sync:android
```

### 2. Open Android Studio
```bash
npm run cap:open:android
```

### 3. Build in Android Studio
1. Wait for Gradle sync to complete
2. Select your device/emulator from the dropdown
3. Click **Run** (green play button) or **Build > Build Bundle(s) / APK(s)**
4. For production APK: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. For release build (Google Play): **Build > Generate Signed Bundle / APK**

### 4. Configure Signing (for Release Builds)
Create a keystore file:
```bash
keytool -genkey -v -keystore zenith-wms-release.keystore -alias zenith-wms -keyalg RSA -keysize 2048 -validity 10000
```

Update `capacitor.config.ts`:
```typescript
android: {
  buildOptions: {
    keystorePath: 'path/to/zenith-wms-release.keystore',
    keystorePassword: 'YOUR_KEYSTORE_PASSWORD',
    keystoreAlias: 'zenith-wms',
    keystoreAliasPassword: 'YOUR_ALIAS_PASSWORD',
  }
}
```

**⚠️ Important**: Never commit your keystore file or passwords to version control!

### 5. Build APK via Command Line
```bash
cd android
./gradlew assembleDebug          # Debug APK
./gradlew assembleRelease        # Release APK
./gradlew bundleRelease          # Android App Bundle (AAB) for Play Store
```

The APK will be in: `android/app/build/outputs/apk/`

## Building for iOS

### 1. Sync Web Assets to iOS
After any changes to your web code:
```bash
npm run build:ios
```

Or manually:
```bash
npm run build:mobile
npm run cap:sync:ios
```

### 2. Install CocoaPods Dependencies
```bash
cd ios/App
pod install
cd ../..
```

### 3. Open Xcode
```bash
npm run cap:open:ios
```

### 4. Configure Signing
1. In Xcode, select your project in the left panel
2. Select the **App** target
3. Go to **Signing & Capabilities**
4. Select your **Team** (you need an Apple Developer account)
5. Xcode will automatically handle provisioning profiles

### 5. Build in Xcode
1. Select your device or simulator from the toolbar
2. Click **Product > Build** (⌘B)
3. For running on device: **Product > Run** (⌘R)
4. For archiving: **Product > Archive**

### 6. Create IPA for Distribution
1. Click **Product > Archive**
2. In the Archives window, select your archive
3. Click **Distribute App**
4. Choose distribution method:
   - **App Store Connect** - for App Store submission
   - **Ad Hoc** - for testing on registered devices
   - **Enterprise** - for enterprise distribution
   - **Development** - for development testing

## Testing

### Android Emulator
```bash
# List available emulators
emulator -list-avds

# Start an emulator
emulator -avd <avd_name>
```

### iOS Simulator
Open Xcode and select a simulator from the device menu, or:
```bash
# List simulators
xcrun simctl list devices

# Boot a simulator
xcrun simctl boot <device_id>
```

## Syncing Changes

After making changes to your web code, rebuild and sync:

```bash
# For Android
npm run build:android

# For iOS
npm run build:ios

# For both platforms
npm run build:mobile
npm run cap:sync
```

## Adding Native Plugins

To add Capacitor plugins (camera, geolocation, etc.):

```bash
npm install @capacitor/camera
npm run cap:sync
```

Popular plugins:
- `@capacitor/camera` - Camera access
- `@capacitor/geolocation` - GPS location
- `@capacitor/filesystem` - File system access
- `@capacitor/network` - Network information
- `@capacitor/splash-screen` - Splash screen control
- `@capacitor/status-bar` - Status bar styling
- `@capacitor/storage` - Native storage

## Troubleshooting

### Android Issues

**Gradle build fails:**
```bash
cd android
./gradlew clean
cd ..
npm run cap:sync:android
```

**SDK not found:**
- Set `ANDROID_HOME` environment variable
- In Android Studio: Tools > SDK Manager to install missing components

**Build tools version mismatch:**
- Update in `android/app/build.gradle`

### iOS Issues

**CocoaPods errors:**
```bash
cd ios/App
pod repo update
pod install --repo-update
cd ../..
```

**Signing errors:**
- Ensure you're logged into Xcode with your Apple ID
- Check your developer account status at developer.apple.com

**Deployment target issues:**
- Update `ios/App/Podfile` if needed
- Clean build folder: Xcode > Product > Clean Build Folder

### General Issues

**Assets not updating:**
```bash
npm run build:mobile
npx cap sync --force
```

**Clear everything and rebuild:**
```bash
rm -rf android ios
npm run mobile:setup
```

## Distribution

### Android (Google Play Store)
1. Create a Google Play Developer account ($25 one-time fee)
2. Build a signed AAB: `cd android && ./gradlew bundleRelease`
3. Upload AAB to Google Play Console
4. Fill in store listing, screenshots, etc.
5. Submit for review

### iOS (Apple App Store)
1. Enroll in Apple Developer Program ($99/year)
2. Create App ID in Apple Developer portal
3. Archive in Xcode: Product > Archive
4. Upload to App Store Connect
5. Fill in app information, screenshots, etc.
6. Submit for review

## Useful Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build:mobile` | Build web assets for mobile |
| `npm run cap:sync` | Sync web assets to all platforms |
| `npm run cap:sync:android` | Sync to Android only |
| `npm run cap:sync:ios` | Sync to iOS only |
| `npm run cap:open:android` | Open Android Studio |
| `npm run cap:open:ios` | Open Xcode |
| `npm run build:android` | Build and sync to Android |
| `npm run build:ios` | Build and sync to iOS |
| `npm run mobile:setup` | Initial setup for both platforms |

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Studio User Guide](https://developer.android.com/studio/intro)
- [Xcode Documentation](https://developer.apple.com/documentation/xcode)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)

## Notes

- Always test on real devices before releasing
- Keep your keystore file secure and backed up (Android)
- Update app version in `package.json` before each release
- Both platforms require different app icons and splash screens
- Consider using [Capacitor Assets](https://github.com/ionic-team/capacitor-assets) to generate app icons and splash screens
