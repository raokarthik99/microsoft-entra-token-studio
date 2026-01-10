use serde::{Deserialize, Serialize};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use std::sync::Arc;
use std::sync::OnceLock;
use tauri::Manager;
use std::path::{Path, PathBuf};

#[derive(Clone)]
struct SidecarEnv {
    data_dir: Option<String>,
    cache_key_b64: Option<String>,
    cache_key_source: Option<String>,
}

static SIDECAR_ENV: OnceLock<SidecarEnv> = OnceLock::new();

fn get_or_create_cache_key_b64(identifier: &str) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use keyring::Entry;

    let service = "Entra Token Studio";
    let account = format!("{}:msal-cache-key", identifier);
    let entry = Entry::new(service, &account).map_err(|e| format!("Failed to initialize keyring: {e}"))?;

    match entry.get_password() {
        Ok(existing) if !existing.trim().is_empty() => Ok(existing),
        Ok(_) | Err(keyring::Error::NoEntry) => {
            // Missing or empty entry: generate and store a new key.
            let _ = entry.delete_credential();
            let mut key = [0u8; 32];
            getrandom::getrandom(&mut key).map_err(|e| format!("Failed to generate cache key: {e}"))?;
            let b64 = STANDARD.encode(key);
            entry
                .set_password(&b64)
                .map_err(|e| format!("Failed to write keyring entry: {e}"))?;
            Ok(b64)
        }
        Err(err) => {
            // Do not rotate/overwrite the key on unexpected failures to avoid invalidating an existing cache.
            Err(format!("Failed to read keyring entry: {err}"))
        }
    }
}

fn cache_key_file_path(data_dir: &Path, identifier: &str) -> PathBuf {
    // Scope the key to the app identifier to avoid collisions across forks/dev builds.
    data_dir.join(format!("msal-cache-key.{identifier}.b64"))
}

fn is_valid_cache_key_b64(value: &str) -> bool {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return false;
    }
    STANDARD
        .decode(trimmed)
        .map(|decoded| decoded.len() == 32)
        .unwrap_or(false)
}

fn get_or_create_cache_key_b64_file(data_dir: &Path, identifier: &str) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use std::fs;
    use std::io::Write;

    let path = cache_key_file_path(data_dir, identifier);

    if let Ok(existing) = fs::read_to_string(&path) {
        if is_valid_cache_key_b64(&existing) {
            return Ok(existing.trim().to_string());
        }
    }

    fs::create_dir_all(data_dir).map_err(|e| format!("Failed to create cache key directory: {e}"))?;

    let mut key = [0u8; 32];
    getrandom::getrandom(&mut key).map_err(|e| format!("Failed to generate cache key: {e}"))?;
    let b64 = STANDARD.encode(key);

    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)
            .map_err(|e| format!("Failed to write cache key file: {e}"))?;
        file.write_all(b64.as_bytes())
            .map_err(|e| format!("Failed to write cache key file: {e}"))?;
    }

    #[cfg(not(unix))]
    {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&path)
            .map_err(|e| format!("Failed to write cache key file: {e}"))?;
        file.write_all(b64.as_bytes())
            .map_err(|e| format!("Failed to write cache key file: {e}"))?;
    }

    Ok(b64)
}

pub fn init_sidecar_env(app: &tauri::AppHandle) {
    // Best-effort: if keyring fails (e.g. missing secret service), the sidecar will fall back to
    // a less secure file cache with strict permissions.
    let identifier = app.config().identifier.clone();
    let data_dir_path = app
        .path()
        .app_data_dir()
        .ok();
    let data_dir = data_dir_path.as_ref().map(|p| p.to_string_lossy().to_string());

    let mut cache_key_b64: Option<String> = None;
    let mut cache_key_source: Option<String> = None;

    // In debug builds, prefer a stable on-disk key so local dev restarts (and rebuilds) keep auth state.
    // In release builds, prefer the OS keyring for strong at-rest protection.
    let prefer_keyring = !cfg!(debug_assertions)
        || std::env::var("ENTRA_TOKEN_STUDIO_DEV_USE_KEYRING")
            .ok()
            .as_deref()
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);

    if prefer_keyring {
        if let Ok(key) = get_or_create_cache_key_b64(&identifier) {
            cache_key_b64 = Some(key);
            cache_key_source = Some("keyring".to_string());
        }
    }

    if cache_key_b64.is_none() {
        // File-backed key is used as a dev-friendly fallback (and optionally as a runtime fallback).
        let allow_file_fallback = cfg!(debug_assertions)
            || std::env::var("ENTRA_TOKEN_STUDIO_ALLOW_FILE_CACHE_KEY")
                .ok()
                .as_deref()
                .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
                .unwrap_or(false);

        if allow_file_fallback {
            if let Some(dir) = data_dir_path.as_ref() {
                if let Ok(key) = get_or_create_cache_key_b64_file(dir, &identifier) {
                    cache_key_b64 = Some(key);
                    cache_key_source = Some("file".to_string());
                }
            }
        }
    }

    let _ = SIDECAR_ENV.set(SidecarEnv {
        data_dir,
        cache_key_b64,
        cache_key_source: cache_key_source.or(Some("none".to_string())),
    });
}

/// JSON-RPC request structure
#[derive(Serialize)]
struct JsonRpcRequest {
    jsonrpc: &'static str,
    id: u64,
    method: String,
    params: serde_json::Value,
}

/// JSON-RPC response structure
#[derive(Deserialize)]
struct JsonRpcResponse {
    #[allow(dead_code)]
    jsonrpc: String,
    #[allow(dead_code)]
    id: Option<u64>,
    result: Option<serde_json::Value>,
    error: Option<JsonRpcError>,
}

#[derive(Deserialize)]
struct JsonRpcError {
    #[allow(dead_code)]
    code: i32,
    message: String,
    #[allow(dead_code)]
    data: Option<serde_json::Value>,
}

/// Sidecar process manager
pub struct SidecarManager {
    pub child: Option<Child>,
    request_id: u64,
    /// Stores the last startup error for diagnostics
    pub start_error: Option<String>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            child: None,
            request_id: 0,
            start_error: None,
        }
    }

    /// Check if Node.js is available in PATH or common locations
    fn find_node_executable() -> Option<PathBuf> {
        use std::process::Command as StdCommand;
        
        // First try "node" directly (works if in PATH)
        if StdCommand::new("node")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Some(PathBuf::from("node"));
        }

        // Common Node.js installation paths on macOS
        let common_paths: Vec<PathBuf> = vec![
            PathBuf::from("/usr/local/bin/node"),
            PathBuf::from("/opt/homebrew/bin/node"),
            PathBuf::from("/usr/bin/node"),
        ];

        for path in common_paths {
            if path.exists() {
                return Some(path);
            }
        }

        // Check nvm installation path (common on developer machines)
        if let Some(home) = dirs::home_dir() {
            // nvm installs node versions in ~/.nvm/versions/node/<version>/bin/node
            // We check if the nvm directory exists but won't enumerate versions
            let nvm_base = home.join(".nvm/versions/node");
            if nvm_base.exists() {
                // Try to find any installed node version
                if let Ok(entries) = std::fs::read_dir(&nvm_base) {
                    for entry in entries.flatten() {
                        let node_bin = entry.path().join("bin/node");
                        if node_bin.exists() {
                            return Some(node_bin);
                        }
                    }
                }
            }
        }

        None
    }

    /// Start the Node.js sidecar process
    pub async fn start(&mut self) -> Result<(), String> {
        if self.child.is_some() {
            return Ok(());
        }

        // Clear any previous error
        self.start_error = None;

        // Find the sidecar executable path
        // Production paths (Tauri bundles resources differently per platform):
        //   - macOS: {app_bundle}/Contents/Resources/sidecar/dist/index.js
        //   - Windows/Linux: {exe_dir}/sidecar/dist/index.js
        // Development: {workspace_root}/sidecar/dist/index.js
        let sidecar_script = {
            let exe_path = std::env::current_exe()
                .map_err(|e| {
                    let msg = format!("Failed to get executable path: {}", e);
                    self.start_error = Some(msg.clone());
                    msg
                })?;
            let exe_dir = exe_path.parent().ok_or_else(|| {
                let msg = "Failed to get parent directory".to_string();
                self.start_error = Some(msg.clone());
                msg
            })?;

            // Build list of paths to check
            let mut paths_to_check: Vec<PathBuf> = Vec::new();
            
            // On macOS, Tauri places resources in Contents/Resources
            #[cfg(target_os = "macos")]
            {
                // exe_dir is {app_bundle}/Contents/MacOS
                // Resources are at {app_bundle}/Contents/Resources
                if let Some(contents_dir) = exe_dir.parent() {
                    let resources_path = contents_dir.join("Resources").join("sidecar").join("dist").join("index.js");
                    paths_to_check.push(resources_path);
                }
            }
            
            // Also check next to executable (Windows/Linux, and fallback)
            let exe_sidecar_path = exe_dir.join("sidecar").join("dist").join("index.js");
            paths_to_check.push(exe_sidecar_path.clone());

            // Find the first path that exists
            let prod_path = paths_to_check.iter().find(|p| p.exists());
            
            if let Some(path) = prod_path {
                log::info!("Using production sidecar path: {:?}", path);
                path.clone()
            } else {
                // Development fallback: use workspace root
                // Go up from src-tauri/target/debug to workspace root
                let workspace_root = exe_dir
                    .ancestors()
                    .find(|p| p.join("sidecar").join("dist").join("index.js").exists())
                    .ok_or_else(|| {
                        let checked_paths: Vec<String> = paths_to_check.iter().map(|p| format!("{:?}", p)).collect();
                        let msg = format!(
                            "Could not find sidecar dist directory. Checked paths: {}. \
                             Make sure the sidecar is built (cd sidecar && npm run build)",
                            checked_paths.join(", ")
                        );
                        self.start_error = Some(msg.clone());
                        msg
                    })?;
                log::info!("Using development sidecar path from workspace: {:?}", workspace_root);
                workspace_root.join("sidecar").join("dist").join("index.js")
            }
        };

        log::info!("Starting sidecar from: {:?}", sidecar_script);

        // Find Node.js executable
        let node_path = Self::find_node_executable().ok_or_else(|| {
            let msg = "Node.js not found. Please install Node.js (https://nodejs.org) and ensure it's in your PATH. \
                       On macOS, you may need to install via Homebrew: brew install node".to_string();
            log::error!("{}", msg);
            self.start_error = Some(msg.clone());
            msg
        })?;

        log::info!("Using Node.js from: {:?}", node_path);

        let mut command = Command::new(&node_path);
        command.arg(&sidecar_script);

        if let Some(env) = SIDECAR_ENV.get() {
            if let Some(dir) = &env.data_dir {
                command.env("ENTRA_TOKEN_STUDIO_DATA_DIR", dir);
            }
            if let Some(key) = &env.cache_key_b64 {
                command.env("ENTRA_TOKEN_STUDIO_CACHE_KEY", key);
            }
            if let Some(source) = &env.cache_key_source {
                command.env("ENTRA_TOKEN_STUDIO_CACHE_KEY_SOURCE", source);
            }
        }

        // Ensure common CLI paths are available to sidecar for Azure CLI discovery
        let path_additions = match std::env::consts::OS {
            "macos" => vec!["/opt/homebrew/bin", "/usr/local/bin", "/usr/local/sbin"],
            "linux" => vec!["/usr/local/bin", "/usr/bin", "/bin"],
            _ => vec![],
        };
        if !path_additions.is_empty() {
            let current_path = std::env::var("PATH").unwrap_or_default();
            let new_path = format!("{}:{}", path_additions.join(":"), current_path);
            command.env("PATH", new_path);
        }

        let child = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                let msg = if e.kind() == std::io::ErrorKind::NotFound {
                    format!(
                        "Node.js executable not found at {:?}. Please install Node.js and ensure it's in your PATH.",
                        node_path
                    )
                } else {
                    format!("Failed to spawn sidecar from {:?}: {}", sidecar_script, e)
                };
                log::error!("{}", msg);
                self.start_error = Some(msg.clone());
                msg
            })?;

        log::info!("Sidecar process started successfully (PID: {:?})", child.id());
        self.child = Some(child);
        Ok(())
    }

    /// Send a request to the sidecar and get a response
    pub async fn call(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        // Provide detailed error when sidecar isn't running
        if self.child.is_none() {
            let base_error = "Sidecar not started";
            if let Some(ref startup_error) = self.start_error {
                return Err(format!("{}: {}", base_error, startup_error));
            }
            return Err(base_error.to_string());
        }
        
        let child = self.child.as_mut().unwrap();

        self.request_id += 1;
        let request = JsonRpcRequest {
            jsonrpc: "2.0",
            id: self.request_id,
            method: method.to_string(),
            params,
        };

        let request_json =
            serde_json::to_string(&request).map_err(|e| format!("Failed to serialize: {}", e))?;

        // Write request to stdin
        let stdin = child.stdin.as_mut().ok_or("Sidecar stdin not available")?;
        stdin
            .write_all(format!("{}\n", request_json).as_bytes())
            .await
            .map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        stdin.flush().await.map_err(|e| format!("Failed to flush: {}", e))?;

        // Read response from stdout
        let stdout = child.stdout.as_mut().ok_or("Sidecar stdout not available")?;
        let mut reader = BufReader::new(stdout);
        let mut line = String::new();
        reader
            .read_line(&mut line)
            .await
            .map_err(|e| format!("Failed to read from sidecar: {}", e))?;

        let response: JsonRpcResponse =
            serde_json::from_str(&line).map_err(|e| format!("Failed to parse response: {}", e))?;

        if let Some(error) = response.error {
            return Err(error.message);
        }

        // Some sidecar handlers intentionally return `void`/`undefined`.
        // JSON-RPC permits a `null` result for such methods; treat a missing result field
        // as null for robustness (avoids false-negative errors on successful calls).
        Ok(response.result.unwrap_or(serde_json::Value::Null))
    }
}

// Global sidecar manager (thread-safe)
lazy_static::lazy_static! {
    static ref SIDECAR: Arc<Mutex<SidecarManager>> = Arc::new(Mutex::new(SidecarManager::new()));
}

/// Initialize and get the sidecar manager
pub async fn get_sidecar() -> Arc<Mutex<SidecarManager>> {
    let sidecar = SIDECAR.clone();
    {
        let mut manager = sidecar.lock().await;
        if let Err(e) = manager.start().await {
            log::error!("Failed to start sidecar: {}", e);
        }
    }
    sidecar
}
