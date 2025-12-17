// Enable prerendering for static adapter (Tauri builds)
// Server-side routes (API endpoints) will still run on the server in web mode
// In Tauri mode, the sidecar handles these operations via IPC

export const prerender = true;
export const ssr = false;
