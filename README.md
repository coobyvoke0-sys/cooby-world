# LoveChat ❤️

A private two-person chat website with text chat and WebRTC voice/video calling.

## 1. Install
Install Node.js 18+.

```bash
npm install
```

## 2. Configure
Copy `.env.example` to `.env` and change both secrets.

```bash
cp .env.example .env
```

The `COUPLE_INVITE_CODE` is the secret code required to create an account.

## 3. Run

```bash
npm start
```

Open `http://localhost:3000`.

Create the first account using the private invite code. Your partner creates the second account with the same code.

## Calls
Voice/video calls use WebRTC. For development, the included Google STUN server helps peers discover each other. For reliable calls across restrictive networks, add a TURN server to the `iceServers` list in `public/app.js`.

## Production security
Use HTTPS, a strong random JWT secret, a real TURN server, rate limiting, secure cookies/token storage, backups, and a managed database before exposing the app publicly.

This starter intentionally keeps the system small: exactly two people are expected to use the private invite code. For a production couples app, enforce a two-member couple relationship in the database rather than relying only on the invite code.
