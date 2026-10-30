mod backend;

use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

pub fn run() {
    tauri::Builder::default()
        // Registered first: a second launch focuses the existing window instead
        // of starting another backend against the same SQLite database.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            desktop_info,
            check_for_update,
            install_update,
            open_external
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            let started = backend::start(&handle);
            let (api_base, backend_error) = match &started {
                Ok(state) => (state.api_base(), String::new()),
                Err(err) => {
                    eprintln!("[mitsu] backend failed to start: {err}");
                    (String::new(), err.clone())
                }
            };

            if let Ok(state) = started {
                app.manage(state);
            }

            let init_script = format!(
                "window.__MITSU_API_BASE__ = {}; window.__MITSU_BACKEND_ERROR__ = {};",
                serde_json::to_string(&api_base).unwrap_or_else(|_| "\"\"".to_string()),
                serde_json::to_string(&backend_error).unwrap_or_else(|_| "\"\"".to_string())
            );

            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Mitsu")
                .inner_size(1280.0, 860.0)
                .min_inner_size(960.0, 640.0)
                .center()
                .initialization_script(&init_script)
                // Anything outside the bundled UI (the reader's remote gallery
                // links, for example) belongs in the user's browser, never in
                // the app window.
                .on_navigation(|url| {
                    if is_app_origin(url) {
                        return true;
                    }
                    if is_openable(url.as_str()) {
                        if let Err(err) = open_in_browser(url.as_str()) {
                            eprintln!("[mitsu] could not open {url}: {err}");
                        }
                    }
                    false
                });

            // A fresh profile per app version keeps WebView caches and service
            // workers from serving a bundle that no longer exists.
            #[cfg(target_os = "windows")]
            let builder = match webview_profile(&handle) {
                Some(profile) => builder.data_directory(profile),
                None => builder,
            };

            builder.build()?;

            check_for_updates(handle);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Mitsu desktop app")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(state) = app.try_state::<backend::BackendState>() {
                    state.shutdown();
                }
            }
        });
}

/// WebView2 keeps a persistent profile (HTTP cache, service workers, storage).
/// Reset it when the app version changes so an upgrade never boots a stale UI.
#[cfg(target_os = "windows")]
fn webview_profile(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    let base = app.path().app_data_dir().ok()?;
    let profile = base.join("webview");
    let version = app.package_info().version.to_string();
    let stamp = profile.join("version");

    let current = std::fs::read_to_string(&stamp).ok();
    if current.as_deref().map(str::trim) != Some(version.as_str()) {
        let _ = std::fs::remove_dir_all(&profile);
    }

    std::fs::create_dir_all(&profile).ok()?;
    let _ = std::fs::write(&stamp, &version);
    Some(profile)
}

/// The bundled UI and the local API are the only places the window may go.
fn is_app_origin(url: &tauri::Url) -> bool {
    match url.scheme() {
        "tauri" | "ipc" | "data" | "blob" | "about" => true,
        "http" | "https" => matches!(
            url.host_str(),
            Some("tauri.localhost") | Some("localhost") | Some("127.0.0.1")
        ),
        _ => false,
    }
}

/// Only ordinary web and mail links may leave the app.
fn is_openable(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    let has_scheme = lower.starts_with("https://")
        || lower.starts_with("http://")
        || lower.starts_with("mailto:");
    has_scheme
        && !url
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
}

/// Opens a link with the operating system's default handler.
///
/// `rundll32` is used on Windows because it receives the URL as a plain
/// argument instead of handing it to `cmd`, so a link that contains shell
/// metacharacters cannot turn into a command.
#[cfg(target_os = "windows")]
fn open_in_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("could not open the browser: {err}"))
}

#[cfg(target_os = "macos")]
fn open_in_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("could not open the browser: {err}"))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_in_browser(url: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("could not open the browser: {err}"))
}

/// Command used by the UI for links that must leave the webview.
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !is_openable(&url) {
        return Err("Only http(s) and mailto links can be opened.".to_string());
    }
    open_in_browser(&url)
}

/// Checks GitHub Releases at most once every six hours. When a newer version
/// exists the user is asked once; accepting downloads, verifies, and installs
/// the signed artifact and then restarts the app.
fn check_for_updates(app: tauri::AppHandle) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
    use tauri_plugin_updater::UpdaterExt;

    if !update_check_due(&app) {
        return;
    }

    tauri::async_runtime::spawn(async move {
        let updater = match app.updater() {
            Ok(updater) => updater,
            Err(err) => {
                eprintln!("[mitsu] updater unavailable: {err}");
                return;
            }
        };

        match updater.check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                let _ = app.emit("mitsu://update-available", version.clone());

                let handle = app.clone();
                app.dialog()
                    .message(format!(
                        "Mitsu {version} is available. Install it now?\n\nThe app restarts when the update is ready."
                    ))
                    .title("Mitsu update")
                    .buttons(MessageDialogButtons::OkCancelCustom(
                        "Install".to_string(),
                        "Later".to_string(),
                    ))
                    .show(move |accepted| {
                        if !accepted {
                            return;
                        }
                        let handle = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            match update.download_and_install(|_, _| {}, || {}).await {
                                Ok(()) => handle.restart(),
                                Err(err) => eprintln!("[mitsu] update failed: {err}"),
                            }
                        });
                    });
            }
            Ok(None) => {}
            Err(err) => eprintln!("[mitsu] update check failed: {err}"),
        }
    });
}

fn update_check_due(app: &tauri::AppHandle) -> bool {
    use std::time::Duration;

    let Ok(dir) = app.path().app_data_dir() else {
        return true;
    };

    let stamp = dir.join("update-check");
    let recent = std::fs::metadata(&stamp)
        .and_then(|metadata| metadata.modified())
        .ok()
        .and_then(|modified| modified.elapsed().ok())
        .map(|elapsed| elapsed < Duration::from_secs(6 * 60 * 60))
        .unwrap_or(false);

    if !recent {
        let _ = std::fs::create_dir_all(&dir);
        let _ = std::fs::write(&stamp, b"");
    }

    !recent
}

/// Version string shown in the desktop settings panel.
#[tauri::command]
fn desktop_info(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Manual update check used by the settings panel.
#[tauri::command]
async fn check_for_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|err| err.to_string())?;
    let update = updater.check().await.map_err(|err| err.to_string())?;
    Ok(update.map(|update| update.version))
}

/// Downloads, verifies, and installs the pending update, then restarts.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|err| err.to_string())?;
    let Some(update) = updater.check().await.map_err(|err| err.to_string())? else {
        return Ok(());
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| err.to_string())?;

    app.restart()
}
