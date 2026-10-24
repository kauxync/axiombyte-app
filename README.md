<p align="center">
  <img src="./assets/images/icon.png" width="108" height="108" alt="AxiomByte Logo" style="border-radius: 24px;" />
</p>

<h1 align="center">AxiomByte</h1>

<p align="center">
  <strong>Computer Science & Discrete Mathematics learning environment engineered for high-performance offline & online study.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v1.0.0-0284C7?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/Build-1-10B981?style=flat-square" alt="Build Number" />
  <img src="https://img.shields.io/badge/Expo_SDK-v58.0-black?style=flat-square&logo=expo" alt="Expo SDK" />
  <img src="https://img.shields.io/badge/React_Native-0.88-61DAFB?style=flat-square&logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web-475569?style=flat-square" alt="Platforms" />
</p>

---

## 📖 Overview

**AxiomByte** is an academic-grade mobile application developed by **Kauxync Technologies** designed for engineering, computer science, and discrete mathematics students. Built with an offline-first architecture, AxiomByte provides structured curriculum tracks, interactive roadmaps, sandboxed code labs, daily learning streak tracking, and academic grant rewards.

---

## ✨ Key Features

- **🗺️ Interactive Curriculums & Roadmaps**:
  Structured engineering roadmaps across Core CS, Discrete Mathematics, Data Structures, Algorithms, Operating Systems, and Architecture with persistent offline caching.

- **💻 In-App Interactive Code Lab**:
  Embedded, secure sandbox execution environment (`InteractiveCodeCard`) supporting JavaScript, HTML/CSS, and algorithms directly within lecture notes.

- **📝 Mathematical & Technical Notes**:
  Rich Markdown rendering with full LaTeX / KaTeX equations, syntax-highlighted code blocks, and validated external reference links.

- **🔥 Daily Study Streaks & Gamification**:
  Motivating daily study streak system with recovery shield freezes, milestone badges, and longest-streak records.

- **🪙 Academic Reward Wallet (Axiom Coins)**:
  Peer-to-peer campus referral mechanics and academic grant coin rewards redeemable against platform perks and learning materials.

- **📱 Safe Device Telemetry & Installation Sync**:
  Privacy-first, anonymous device telemetry (screen dimensions, OS versions, architecture, thermal metrics) tracking single installs without collecting personally identifiable hardware IDs (IMEI/MAC) in compliance with GDPR & India DPDP Act 2023.

- **🚀 Mandatory In-App Over-The-Air (OTA) Updates**:
  Zero-reinstall OTA updates distributed over Expo Updates (`production` & `preview` channels) with automated update notifications.

- **🛡️ Hardened Security**:
  Zero ad-trackers, sandboxed web views with external link whitelisting, OAuth PKCE flow (Google & GitHub), and biometric/secure token storage via `expo-secure-store`.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [Expo SDK 58](https://expo.dev/) (Managed Workflow + Continuous Native Generation)
- **Runtime**: [React Native 0.88](https://reactnative.dev/) with [React 19.3](https://react.dev/)
- **Navigation**: [Expo Router v58](https://docs.expo.dev/router/introduction/) (File-based Routing)
- **Styling & Theming**: Custom Dynamic Theme Engine (Light, Slate Dark & System Adaptive)
- **Security & Storage**: `expo-secure-store`, `@react-native-async-storage/async-storage`, `expo-crypto`
- **Native Modules**: `expo-notifications`, `expo-dev-client`, `expo-device`, `expo-updates`
- **Backend & APIs**: High-performance REST microservices (`axiombytedb.kauxync.in`) with isolated OAuth broker (`axiombyte.kauxync.in`).

---

## 📁 Project Structure

```text
learn.kauxync/
├── assets/                  # App icons, splash screens, branding & typography
├── src/
│   ├── app/                 # Expo Router screens & route layouts
│   │   ├── _layout.tsx      # Root application layout & provider wrapping
│   │   ├── (tabs)/          # Primary tab navigation (Notes, Roadmaps, Profile)
│   │   └── ...              # Sub-routes and modal screens
│   ├── components/          # Reusable UI components
│   │   ├── InteractiveCodeCard.tsx  # Sandboxed code execution runner
│   │   ├── MarkdownContentView.tsx  # LaTeX & Markdown renderer
│   │   ├── ProfileWalletView.tsx    # User profile, wallet & system details
│   │   ├── RoadmapsView.tsx         # Learning roadmaps and nodes
│   │   └── SubjectsNotesView.tsx    # Subject notes and reading views
│   ├── context/             # Global React Contexts (Auth, Theme, Curriculum)
│   ├── data/                # Static curriculum databases & roadmap data
│   ├── services/            # Client services
│   │   ├── api.ts                   # Backend REST client
│   │   ├── codeRunner.ts            # Web code sandbox service
│   │   ├── deviceTelemetryService.ts# Anonymous installation telemetry
│   │   ├── notificationService.ts   # Push & local notification handlers
│   │   └── updates.ts               # Over-The-Air update managers
│   └── types/               # TypeScript definitions
├── app.json                 # Expo configuration & native plugin manifests
└── eas.json                 # Expo Application Services build profiles
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or v22 LTS recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)
- [EAS CLI](https://docs.expo.dev/eas/) (`npm install -g eas-cli`)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kauxync/axiombyte-app.git
   cd axiombyte-app
   ```

2. **Install dependencies**:
   ```bash
   npx expo install
   ```

3. **Start the local development server**:
   ```bash
   npx expo start
   ```

---

## 📦 Building with EAS (Expo Application Services)

AxiomByte is configured with three EAS build profiles:

### 1. Development Build
Includes developer client tools and all native modules:
```bash
npx eas-cli@latest build --profile development --platform android
```

### 2. Preview Build (Standalone APK)
Directly installable standalone APK for testing real production behavior:
```bash
npx eas-cli@latest build --profile preview --platform android
```

### 3. Production Build (Google Play Store AAB)
Optimized Android App Bundle (`.aab`) ready for store submission:
```bash
npx eas-cli@latest build --profile production --platform android
```

---

## 🏷️ Release Notes: v1.0.0 (Build 1)

- **Initial Stable Production Release**:
  - Full Computer Science and Discrete Mathematics curriculum support.
  - Interactive sandboxed code runner embedded in lecture notes.
  - Secure anonymous installation telemetry without duplicate device registration on reinstallation.
  - Push notification channel initialization and permissions flow.
  - Dynamic in-app Over-The-Air (OTA) update checking.
  - Integrated student wallet, streak freeze recovery, and referral bonuses.

---

## 🏢 Organization & Support

- **Developed By**: Kaushalendra Kumar
- **Organization**: Kauxync Technologies (Kauxync Inc.)
- **Website**: [axiombyte.kauxync.in](https://axiombyte.kauxync.in)
- **Support**: [support@kauxync.in](mailto:support@kauxync.in)

---

## 📄 License

Proprietary. Copyright © 2026 Kauxync Technologies. All rights reserved.
