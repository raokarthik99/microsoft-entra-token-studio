# Entra Token Client

A lightweight, developer-focused utility for fetching and inspecting Microsoft Entra ID tokens. Built with **SvelteKit** and **MSAL Node**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![SvelteKit](https://img.shields.io/badge/SvelteKit-2.0-orange.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)

## 🚀 Features

- **Dual Auth Flows**: Support for both **Client Credentials** (App Token) and **Authorization Code** (User Token) flows.
- **Token Inspection**: Built-in JWT decoder to instantly view claims, scopes, and expiration.
- **History Tracking**: Automatically saves recent requests and tokens to local storage for quick reuse.
- **Developer Friendly**: One-click copy to clipboard, pre-filled forms based on history, and a clean, responsive UI.
- **Secure**: Server-side token exchange using `msal-node` to keep client secrets safe.

## 🛠️ Prerequisites

- **Node.js** (v18 or higher recommended)
- **pnpm** (Project uses pnpm for package management)
- A **Microsoft Entra Tenant** with permissions to register applications.

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd entra-token-client
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your Microsoft Entra details:
   ```env
   TENANT_ID=your-tenant-id
   CLIENT_ID=your-client-id
   CLIENT_SECRET=your-client-secret
   PORT=5173
   REDIRECT_URI=http://localhost:5173/auth/callback
   ```

## 🔑 Microsoft Entra Setup

To use this application, you need to register an app in the Azure Portal:

1. Go to **Microsoft Entra ID** > **App registrations** > **New registration**.
2. Name your app (e.g., "Entra Token Client").
3. Set **Supported account types** to "Accounts in this organizational directory only" (Single tenant).
4. Under **Redirect URI**, select **Web** and enter:
   `http://localhost:5173/auth/callback`
5. Click **Register**.
6. Copy the **Application (client) ID** and **Directory (tenant) ID** to your `.env` file.
7. Go to **Certificates & secrets** > **New client secret**. Copy the value to `CLIENT_SECRET` in `.env`.
8. (Optional) Go to **API permissions** to add scopes like `User.Read`, `Mail.Read`, etc., depending on what you want to test.

## 🏃‍♂️ Usage

1. **Start the development server**
   ```bash
   pnpm run dev
   ```

2. **Open the application**
   Navigate to [http://localhost:5173](http://localhost:5173) in your browser.

3. **Generate Tokens**
   - **App Token**: Enter a resource URL (default: `https://graph.microsoft.com`) to get a token for your application service principal.
   - **User Token**: Enter scopes (default: `User.Read`) to sign in as a user and get a delegated token.

## 🏗️ Tech Stack

- **Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Auth Library**: [@azure/msal-node](https://www.npmjs.com/package/@azure/msal-node)
- **Styling**: Vanilla CSS with modern variables and responsiveness.
- **Package Manager**: [pnpm](https://pnpm.io/)

## 📝 License

This project is licensed under the MIT License.
