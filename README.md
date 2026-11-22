# Antigravity Web UI (Next.js + Gemini App Aesthetic)

A mobile-first, high-performance web interface for the Antigravity Autonomous Agent CLI (`agy`), designed in the visual identity of **Google Gemini (`gemini.google.com`)**.

---

## Features
- **Google Gemini Material Dark Theme**: `#131314` canvas, `#1e1f20` elevated surfaces/pills, and `#282a2c` borders.
- **Signature 4-Point Gemini Sparkle**: Custom gradient vector star logo.
- **Strict Zero Emojis**: 100% clean SVG vector icons throughout.
- **Google Sans Only**: Loaded directly from Google Fonts (`Google Sans`, `Google Sans Text`, `Google Sans Code`).
- **Full Developer Code Box**: Line numbers gutter (`user-select: none`), language badge, and 1-click **Copy code** button.
- **Usage & Quota Monitor**: Live topbar pill with turn counts, plus modal showing daily volume, estimated tokens, model distribution, rate limits, and Nest container RAM/disk limits.
- **Dynamic Model Selector**: Gemini 3.8 Flash, Claude Sonnet 4.6 (Thinking), Claude Opus 4.6 (Thinking), and GPT-OSS 120B with reasoning effort levels (Low / Med / High / Max).
- **Mobile-First & Docked**: `100dvh` viewport, input capsule docked safely above virtual keyboards, safe-area insets, and 16px font to prevent iOS auto-zoom.
- **Interactive Controls**: Abort / Stop generation, Speech Recognition mic, Audio read aloud (TTS), prompt editing, and chat export.

---

## Deploy to Vercel (1-Click from Phone)

1. Open **[vercel.com/new](https://vercel.com/new)** on your phone.
2. Select the repository **`tanzeemrockz/antigravity-web`**.
3. Under **Environment Variables**, add:
   - **`NEST_BACKEND_URL`**: `https://wide-quilt-warranties-manager.trycloudflare.com` *(or your active Cloudflare Tunnel URL)*
4. Click **Deploy**!
