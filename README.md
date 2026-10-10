# Nyaya Setu — AI Bridge to Rights & Justice (Build With भारत 4.0)

Nyaya Setu ("Justice Bridge") is a voice-first, multilingual mobile companion that helps citizens navigate government welfare schemes, legal problems, and confusing official documents — in their own language, spoken and written.

Built for **Build With भारत 4.0** by Team Hackpeeps.

> ⚠️ Written and iterated on with AI pair-programming in a sandbox without internet or a live Android device — always test on your own machine before a demo.

---

## 1. What it does

**Three core pillars**, all screens accessible from the Home tab or bottom navigation:

| Feature | Description |
|---|---|
| **Scheme Navigator** | Describe your situation in your own words (voice or text) — Gemini finds relevant government welfare schemes (PM-KISAN, Sukanya Samriddhi, Atal Pension Yojana, PMMVY, and more) and explains eligibility and required documents. |
| **Legal Companion** | Step-by-step guidance for common legal situations — FIR filing, RTI requests, land disputes, family matters, cyber fraud, wage disputes. |
| **Document Simplifier** | Photograph any official notice or document — Gemini reads it directly (no OCR library needed) and explains it in plain language, extracting key actions and deadlines. |

**Supporting features:**

| Feature | Description |
|---|---|
| **Voice Translator** | Speak or type in any supported language, get an instant translation, spoken aloud. |
| **Visual Solver** | General-purpose camera Q&A (like Google Lens) — photograph anything and ask a question about it. |
| **Help Centers** | Nearby CSC centres, police stations, and Legal Services Authority offices, sorted by distance (sample data for the demo). |
| **13 Indian languages** | English, Hindi, Marathi, Bengali, Telugu, Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, Punjabi, Assamese — full UI translation, and Gemini auto-detects and replies in whichever language the user speaks or types. |
| **Text-to-speech** | Every AI reply — from typed questions or voice notes — is spoken aloud automatically, in the correct language. Speech speed is user-adjustable (Slow / Normal / Fast / Very Fast) in Settings. |
| **Saved chat history** | Conversations persist on-device (AsyncStorage) across app restarts. |

## 1b. 🐟 TinyFish live-web layer (new)

Every other AI app answers from memory. **Nyaya Setu checks the live official websites.**

| Feature | TinyFish API used | What the user sees |
|---|---|---|
| **🛰️ Sahayak Live** (centre tab) | **Agent API** (`/v1/automation/run-async` + `GET /v1/runs/{id}`) | Speak a task in any language → Gemini plans it → a TinyFish cloud browser opens the official .gov.in site and does the work **live inside the app** (embedded `streaming_url` + step timeline) → verified answer read aloud. Falls back to Search + Fetch if a site blocks the agent. |
| **✅ Verify live** (Scheme Navigator & Legal Companion) | **Search API** + **Fetch API** | One tap under any AI answer → checks official sites → badge: *Verified / Updated / Partially verified*, key facts, official link, source chips. |
| **🛡️ Scam Shield** (Document Simplifier) | **Search API** (web + news) | "Is this notice/SMS genuine?" → checks the official source + fraud alerts → *Looks genuine / Suspicious / Likely SCAM* + what to do (1930 helpline). |
| **📍 Real help centres** | **Search API** | GPS → city → real CSC, DLSA, police station and One Stop Centre listings with Call / Directions / Source buttons. |
| **📰 Live updates feed** (Home) | **Search API** (`domain_type=news`, last 7 days) | Latest scheme & fraud-alert news, translated into the user's language. Cached 6 h. |

Code: `src/services/tinyfishApi.js` (REST client, demo-mode fallback) and `src/services/liveIntel.js` (TinyFish + Gemini orchestration). Settings → **Test TinyFish connection** checks the key.

### Setup
Add to `.env` (key from https://agent.tinyfish.ai/api-keys):
```
EXPO_PUBLIC_TINYFISH_API_KEY=your_key_here
```
Without a key the app runs in **demo mode** with sample data, so it never breaks on stage.

## 2. Tech stack

- **Framework:** React Native + Expo (SDK 54)
- **Navigation:** React Navigation (bottom tabs + native stack)
- **AI:** Google Gemini (`gemini-3.5-flash-lite`) — multimodal text, image, and audio understanding in a single API, no separate OCR or speech-to-text pipeline
- **Voice input:** `expo-av` (recording) → sent directly to Gemini as audio
- **Voice output:** `expo-speech` (on-device text-to-speech, adjustable rate)
- **Device capabilities:** camera, microphone, location
- **Storage:** `@react-native-async-storage/async-storage` for chat history and settings persistence
- **Live web:** TinyFish Agent, Search and Fetch APIs (`react-native-webview` for the live browser view)
- **Build:** EAS Build (Android APK)
