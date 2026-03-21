# SpendAI — On-Device Expense Tracker

AI-powered expense tracker that runs entirely on-device. No cloud, no backend. Built with Expo + RunAnywhere SDK.

## Prerequisites

- **Node.js** 18+ and npm
- **Android Studio** with an emulator (e.g. Medium Phone API 36) or a physical Android device
- **Java JDK** — Android Studio bundles one at `C:\Program Files\Android\Android Studio\jbr`

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set JAVA_HOME (required every new terminal on Windows)

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
```

To make it permanent, add `JAVA_HOME` to your System Environment Variables.

### 3. Build and run on Android

```bash
npx expo run:android
```

First build takes ~20-30 minutes. After that, just start the dev server:

```bash
npx expo start
```

Press `a` to open on the emulator/device.

### 4. Web preview (limited — no AI features)

```bash
npx expo start --web
```

Press `w` — uses mock AI responses, no voice features.

### Model Downloads

On first launch the app automatically downloads 3 AI models (~340 MB total):

| Model | Purpose | Size |
|-------|---------|------|
| LFM2-350M-Q4_K_M | LLM chat & expense analysis | ~238 MB |
| sherpa-onnx-whisper-tiny.en | Speech-to-text | ~40 MB |
| vits-piper-en_US-lessac-medium | Text-to-speech | ~60 MB |

Watch `adb logcat | grep SpendAI` for download/load progress. Models are cached after the first download.

## Project Structure

```
src/
├── services/          # Core logic — DB, AI, SMS, categories
├── screens/           # Full-screen views
├── components/        # Reusable UI pieces
├── constants/         # Categories list
├── theme/             # Colors
└── types.ts           # Shared TypeScript types
App.tsx                # Entry — providers, navigation, SMS listener
```

## Key Files

| File | What it does |
|------|-------------|
| `services/ModelService.tsx` | RunAnywhere SDK init, downloads + loads LLM, STT, TTS, VAD models. Exposes `generate()`, `transcribe()`, `speak()`, `startListening()` via React Context |
| `services/DatabaseService.ts` | SQLite CRUD for transactions. In-memory fallback on web |
| `services/SMSService.ts` | Listens for incoming SMS, extracts amounts via regex. `fireTestSMS()` for testing |
| `services/CategoryService.ts` | Builds LLM prompts for categorization and chat |
| `services/seedData.ts` | Populates fake transactions for development |
| `screens/DashboardScreen.tsx` | Main screen — totals, chart, transaction list |
| `screens/InsightsScreen.tsx` | AI chat — financial analysis, voice input/output, salary modal |
| `screens/ConfirmTransactionScreen.tsx` | Categorize a detected transaction with AI suggestion |
| `screens/DevScreen.tsx` | Fire test SMS templates, view model status |

## How to Make Changes

### Adding a new screen

1. Create `src/screens/YourScreen.tsx`
2. Add the route to `RootStackParamList` in `src/types.ts`
3. Add `<Stack.Screen>` in `App.tsx`

### Adding a new category

Edit `src/constants/categories.ts` — add an entry to the `CATEGORIES` array. The rest of the app reads from this array automatically.

### Changing LLM prompts

All prompts live in `src/services/CategoryService.ts`. Edit the system/user prompt strings there. The chat prompt is `buildChatPrompt()`.

### Modifying the database schema

1. Update the `CREATE TABLE` statement in `DatabaseService.ts` → `getDb()`
2. Update the `Transaction` interface in the same file
3. Update the web fallback (`webFallback`) to match
4. Update any insert/query functions that touch the changed columns

### Working with RunAnywhere models

Models are registered and loaded in `ModelService.tsx`. To add a new model:

1. Add model constants (ID, URL, memory) at the top of the file
2. Register with `ONNX.addModel()` or `LlamaCPP.addModel()` in `initializeModel()`
3. Download and load in the same function
4. Expose any new methods through the context

### Testing without a physical device

Use the **DevScreen** (tap the gear icon on Dashboard → Dev). It has pre-filled SMS templates you can fire to test the full pipeline: SMS → amount extraction → AI categorization → confirm → save to DB.

On web, the app uses:
- In-memory store instead of SQLite
- Mock AI responses that parse transaction data directly
- No voice features (STT/TTS require RunAnywhere native SDK)

## Important Version Constraints

- **`react-native-nitro-modules`** must stay at **0.31.10** — RunAnywhere 0.18.1 uses the `updateNative` API which was removed in newer versions
- **Gradle** must be **8.13** — if `npx expo prebuild` regenerates `android/`, it resets to 9.0 which has an `IBM_SEMERU` error. Fix in `android/gradle/wrapper/gradle-wrapper.properties`:
  ```properties
  distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
  ```
- **`android/local.properties`** must have your SDK path:
  ```
  sdk.dir=C:\\Users\\<YOUR_USERNAME>\\AppData\\Local\\Android\\Sdk
  ```

## Constraints

- All AI inference uses `RunAnywhere.generateStream()` — never external APIs
- All data stays in on-device SQLite — no network storage
- Parse LLM JSON responses in try/catch — always fallback to null
- User always confirms categories — AI only pre-selects, never auto-saves

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Gradle requires JVM 17, found JVM 8` | Set `JAVA_HOME` to Android Studio's JBR (see setup step 2) |
| `IBM_SEMERU` error during build | Downgrade Gradle to 8.13 (see version constraints above) |
| `SDK location not found` | Create/fix `android/local.properties` with your SDK path |
| App crashes on launch | Must use dev client build (`npx expo run:android`), not Expo Go |
| LLM very slow on emulator | Expected on x86_64 — use physical device or set `FORCE_MOCK_LLM = true` in `ModelService.tsx` |
| Port 8081 in use | Kill other Metro processes or `npx expo start --port 8082` |
| Models not downloading | Check internet; watch `adb logcat \| grep SpendAI` for progress |

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Expo (managed workflow) |
| Navigation | React Navigation 7 (native stack) |
| Database | expo-sqlite (SQLite on device) |
| AI Runtime | RunAnywhere SDK (LlamaCPP + ONNX) |
| LLM | LFM2-350M (on-device, GGUF) |
| STT | Whisper Tiny (on-device, ONNX) |
| TTS | Piper Lessac (on-device, ONNX) |
| VAD | Silero VAD (on-device, ONNX) |
| Voice Recording | react-native-live-audio-stream (raw PCM 16kHz) |
| TTS Playback | expo-av |
| SMS | react-native-sms-listener |
| Notifications | expo-notifications |


## Helper guide 

```

Save it as `E:\HackXtreme\scripts\patch-expo-cli.js`

Then also create a `README` note for teammates — add this to your `README.md` under Setup:
```
5. Copy .so files (required after every npm install)
   See scripts/copy-so-files.md for instructions
=>
   cd E:\HackXtreme
   powershell -ExecutionPolicy Bypass -File .\scripts\setup-native-libs.ps1