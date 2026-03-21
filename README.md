# SpendAI — On-Device Expense Tracker

AI-powered expense tracker that runs entirely on-device. No cloud, no backend. Built with Expo + RunAnywhere SDK.

## Prerequisites

- Node.js 18+
- npm
- [RunAnywhere AI Studio](https://runanywhere.ai) app installed on a physical Android device (for AI + SMS features)
- Android emulator works for UI development (use DevScreen to simulate SMS)

## Setup

```bash
npm install
npx expo start
```

- Press `w` for web preview (mock AI responses, no voice)
- Press `a` for Android (requires emulator or AI Studio on physical device)
- Scan QR code with RunAnywhere AI Studio for full AI features

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

## Constraints

- `react-native-reanimated` must be `^3.x` — NOT 4.x (AI Studio compatibility)
- All AI inference uses `RunAnywhere.generateStream()` — never external APIs
- All data stays in on-device SQLite — no network storage
- Parse LLM JSON responses in try/catch — always fallback to null
- User always confirms categories — AI only pre-selects, never auto-saves

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
| SMS | react-native-sms-listener |
| Notifications | expo-notifications |
