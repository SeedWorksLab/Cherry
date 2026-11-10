# Cherry

<p align="center">
  <img src="assets/cherry-banner.jpg" alt="Cherry — a private, local-first coffee brewing journal" width="640">
</p>

<p align="center">
  A private, offline-first Android coffee journal. Record a brew by voice, let a cloud LLM turn it into a structured record,<br>
  track what the coffee tasted like, and let a deterministic learning engine recommend what to brew next.<br>
  Everything stays on your device — the only network calls go to the AI provider you configure.
</p>

---

## About

Cherry is a personal coffee brewing journal, not a social network or a
cloud service. You plan a brew, talk through it while you make it, record how it
tasted, and the app gradually learns how the knobs you control — dose, water,
temperature, grind, pour structure — affect the result in the cup.

All data lives in a local SQLite database on the device — the single source of
truth. The app works fully offline. Manual entry is always a complete equal of
the voice path. There is no backend, no account, no advertising, and no
analytics.

**There is no local inference, ever.** Every AI operation — transcription and
LLM extraction — is a cloud HTTP call to the provider you configure in the app.
Your base URL, API key and model name are stored only on your device, are never
included in a backup, and are never sent anywhere except the base URL you typed.

## Key features

- **Plan → Brew → Tasted lifecycle** — plan a recipe, brew it, then record how it
  actually tasted, three linked stages of one record.
- **Voice-first recording** — start, pause and resume one appendable audio
  stream, tap phase markers (prep, brew, finish, taste, note) and attach moments
  as you go.
- **Cloud transcription** — either an OpenAI-compatible speech-to-text endpoint
  or Android's own speech recogniser, whichever you prefer.
- **LLM extraction** — a structured candidate record is pulled from the
  transcript with full field provenance, so you can see exactly what the AI
  filled and what you typed.
- **Bean catalogue** — roaster, origin, varietal, process, altitude, roast level
  and roast date, bag sizes, and remaining weight.
- **Equipment** — brewers by kind, grinders and their grind settings, with a
  comparability rule so settings are only compared within one grinder.
- **Nine brewing methods** — v60, chemex, kalita, french press, aeropress,
  clever, cold brew, espresso and moka, each with its own full step shape and a
  built-in canonical recipe.
- **Explore recipes** — a browsable library of built-in recipes with step-by-step
  technique, expected timing and healthy parameter ranges, plus a search and a
  method filter.
- **Technique coaching** — ask the app a question ("what's a sensible V60 flow
  rate?") and get an answer from your AI provider, grounded in your method and
  recent brews and adoptable as a plan in one tap. Built-in technique ranges work
  even offline.
- **Three rating modes** — from "I don't like it" up to the full SCA cupping
  form; every field is optional.
- **A learning recommender** — a deterministic statistical engine with three
  modes (safe, curious, adventurous) that knows which knobs to turn next. When it
  finds an obvious flaw — a broken pour time, a missing bloom, a knob you keep
  pushing the wrong way — it fixes that first instead of exploring around it. The
  LLM only writes the narrative; it never decides the recommendation.
- **Learn tab** — grind and time sensitivity, your taste profile, habitual
  mistakes and blind spots.
- **Notifications** — bean freshness, low stock, and an unlogged-session prompt.
- **Theme** — Material Design 3 with light, dark and system appearances.
- **Backup & restore** — export your whole database to a portable file, or
  restore from one.

## Data & privacy

- Single-user, local-first: the database never leaves your device unless you
  export it.
- Physical measurements (grams, millilitres, °C, seconds) are stored as REAL.
  Money, where it appears, is stored as integer cents.
- The only external service is the AI provider you configure yourself. The key
  is stored on-device only, excluded from backups, and never logged.
- No analytics, advertising, telemetry or third parties.

## Tech stack

- React Native via **Expo SDK**
- **TypeScript** (strict mode)
- **expo-sqlite** for local storage
- **Expo Router** for file-based navigation
- **React Native Paper** (Material Design 3) for UI
- **dayjs** for date handling
- **expo-audio** for recording and level metering
- **expo-notifications** for local notifications
- **expo-file-system** / **expo-sharing** for backup and audio files
- **Jest** + jest-expo for unit tests
- **react-native-web** for the desktop/web build

## Getting started

Prerequisites:

- Node.js 22+
- JDK 21
- Android SDK (API 29 / Android 10 or newer) and the `Pixel_6a` emulator

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm install`      | Install dependencies                          |
| `npm run start`    | Start the Expo dev server                     |
| `npm run android`  | Run in the Android emulator                   |
| `npm run web`      | Run the desktop/web build                     |
| `npm test`         | Run unit tests                                |
| `npm run typecheck`| TypeScript check (`tsc --noEmit`)             |
| `npm run lint`     | Lint the code (`expo lint`)                   |

## Project structure

```
src/
├── app/           # Expo Router screens (file-based routing: (tabs), record, plan, ...)
├── components/    # Reusable UI components (React Native Paper based)
├── config/        # App metadata and What's New entries
├── data/          # DataProvider (React context that owns app state)
├── database/      # SQLite schema, migrations, repositories and queries
├── models/        # TypeScript domain models
├── services/      # Pure business logic (recommendations, taste model, insights)
├── ai/            # Cloud provider transport, prompts, schemas, extraction
├── theme/         # Material 3 theming
└── utils/         # Generic helpers (date, units, formatting)
tests/             # Jest unit tests
assets/            # App icons, logo and banner
```

## Documentation

- [`idea.txt`](idea.txt) — full product and architecture specification
- [`theme.md`](theme.md) — complete design-token and component-theming spec
- [`AGENTS.md`](AGENTS.md) — coding conventions for AI agents

## License

AGPL-3.0 — see [LICENSE](LICENSE).
