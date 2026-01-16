use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

mod sidecar;

use sidecar::get_sidecar;

/// Key Vault configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyVaultConfig {
    pub uri: String,
    pub credential_type: String,
    pub cert_name: Option<String>,
    pub secret_name: Option<String>,
}

/// Token app configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenAppConfig {
    pub client_id: String,
    pub tenant_id: String,
    pub key_vault: KeyVaultConfig,
}

/// Token response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenResponse {
    pub access_token: String,
    pub expires_on: String,
    pub token_type: String,
    pub scopes: Option<Vec<String>>,
}

/// Validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub credential_type: String,
    pub message: Option<String>,
}

/// Credential status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialStatus {
    pub available: bool,
    pub message: String,
}

/// Azure app list filters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AzureAppFilters {
    pub search: Option<String>,
    pub app_id: Option<String>,
    pub display_name: Option<String>,
    pub identifier_uri: Option<String>,
    pub filter: Option<String>,
    pub show_mine: Option<bool>,
    pub all: Option<bool>,
}

/// Acquire an app token via sidecar
#[tauri::command]
async fn acquire_app_token(
    config: TokenAppConfig,
    scopes: Vec<String>,
) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "acquire_app_token",
            serde_json::json!({ "config": config, "scopes": scopes }),
        )
        .await
}

/// Validate Key Vault connectivity
#[tauri::command]
async fn validate_keyvault(config: KeyVaultConfig) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager.call("validate_keyvault", serde_json::to_value(config).unwrap()).await
}

/// Get credential status
#[tauri::command]
async fn get_credential_status() -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager.call("get_credential_status", serde_json::json!({})).await
}

/// Check sidecar health - returns status and any startup errors
#[tauri::command]
async fn check_sidecar_health() -> serde_json::Value {
    let sidecar = get_sidecar().await;
    let manager = sidecar.lock().await;

    let running = manager.child.is_some();
    let error = manager.start_error.clone();
    
    // Extract error code from error message if present
    let error_code = error.as_ref().and_then(|e| {
        if e.contains("[NODE_NOT_FOUND]") {
            Some("NODE_NOT_FOUND")
        } else if e.contains("Could not find sidecar") {
            Some("SIDECAR_SCRIPT_NOT_FOUND")
        } else {
            None
        }
    });

    serde_json::json!({
        "running": running,
        "error": error,
        "errorCode": error_code
    })
}


/// List Azure subscriptions via Azure CLI
#[tauri::command]
async fn list_azure_subscriptions() -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call("list_azure_subscriptions", serde_json::json!({}))
        .await
}

/// List Azure app registrations via Azure CLI
#[tauri::command]
async fn list_azure_apps(filters: Option<AzureAppFilters>) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call("list_azure_apps", match filters {
            Some(filters) => serde_json::to_value(filters).unwrap_or_else(|_| serde_json::json!({})),
            None => serde_json::json!({}),
        })
        .await
}

/// List Key Vaults via Azure CLI
#[tauri::command]
async fn list_keyvaults(subscription_id: Option<String>) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "list_keyvaults",
            serde_json::json!({ "subscriptionId": subscription_id }),
        )
        .await
}

/// List Key Vault secrets via Azure CLI
#[tauri::command]
async fn list_keyvault_secrets(
    vault_name: String,
    subscription_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "list_keyvault_secrets",
            serde_json::json!({ "vaultName": vault_name, "subscriptionId": subscription_id }),
        )
        .await
}

/// List Key Vault certificates via Azure CLI
#[tauri::command]
async fn list_keyvault_certificates(
    vault_name: String,
    subscription_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "list_keyvault_certificates",
            serde_json::json!({ "vaultName": vault_name, "subscriptionId": subscription_id }),
        )
        .await
}

/// Acquire a user token via sidecar (opens system browser)
#[tauri::command(rename_all = "camelCase")]
async fn acquire_user_token(
    client_id: String,
    tenant_id: String,
    scopes: Vec<String>,
    prompt: Option<String>,
    account_home_account_id: Option<String>,
    silent_only: Option<bool>,
) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "acquire_user_token",
            serde_json::json!({
                "clientId": client_id,
                "tenantId": tenant_id,
                "scopes": scopes,
                "prompt": prompt,
                "accountHomeAccountId": account_home_account_id,
                "silentOnly": silent_only
            }),
        )
        .await
}

/// Get cached user accounts for a client (desktop auth restoration)
#[tauri::command(rename_all = "camelCase")]
async fn get_user_accounts(client_id: String, tenant_id: String) -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "get_user_accounts",
            serde_json::json!({
                "clientId": client_id,
                "tenantId": tenant_id,
            }),
        )
        .await
}

/// Clear cached user tokens/accounts for a client (logout)
#[tauri::command(rename_all = "camelCase")]
async fn clear_user_cache(client_id: String, tenant_id: String) -> Result<(), String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager
        .call(
            "clear_user_cache",
            serde_json::json!({
                "clientId": client_id,
                "tenantId": tenant_id,
            }),
        )
        .await?;

    Ok(())
}

/// Get desktop auth storage status (encrypted token cache availability)
#[tauri::command]
async fn get_auth_storage_status() -> Result<serde_json::Value, String> {
    let sidecar = get_sidecar().await;
    let mut manager = sidecar.lock().await;

    manager.call("get_auth_storage_status", serde_json::json!({})).await
}

/// Exit the desktop application.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance plugin MUST be registered first to work correctly.
    // This ensures only one app instance runs and deep-links are forwarded to it.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Focus the main window when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            // Note: Deep-link events are automatically emitted by the deep-link plugin
            // when the single-instance plugin has the "deep-link" feature enabled
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            acquire_app_token,
            acquire_user_token,
            get_user_accounts,
            clear_user_cache,
            get_auth_storage_status,
            check_sidecar_health,
            exit_app,
            validate_keyvault,
            get_credential_status,
            list_azure_subscriptions,
            list_azure_apps,
            list_keyvaults,
            list_keyvault_secrets,
            list_keyvault_certificates
        ])
        .setup(|app| {
            // Enable logging in debug builds
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Register deep link handler for auth callbacks
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    let urls = event.urls();
                    for url in urls {
                        let mut sanitized = url.clone();
                        sanitized.set_query(None);
                        sanitized.set_fragment(None);
                        log::info!("Deep link received: {}", sanitized);
                        // Emit event to frontend to handle auth callback
                        if url.scheme() == "entra-token-studio" {
                            let _ = handle.emit("auth-callback", url.as_str());
                        }
                    }
                });
            }

            // Initialize sidecar on startup
            sidecar::init_sidecar_env(&app.handle());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Initialize sidecar
                let sidecar = get_sidecar().await;
                let _manager = sidecar.lock().await;
                log::info!("Sidecar initialized");
                let _ = handle;
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
