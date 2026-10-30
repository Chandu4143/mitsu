//! Owns the local Python API process that the webview talks to.
//!
//! The packaged app ships a PyInstaller sidecar (`mitsu-backend.exe`). During
//! development the sidecar is usually missing, so we fall back to running
//! `uvicorn` from the repository's `backend/` directory.

use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Manager};

const READY_TIMEOUT: Duration = Duration::from_secs(45);
const POLL_INTERVAL: Duration = Duration::from_millis(250);

pub struct BackendState {
    base_url: String,
    child: Mutex<Option<Child>>,
    #[cfg(windows)]
    job: process_tree::Job,
}

impl BackendState {
    pub fn api_base(&self) -> String {
        format!("{}/api/v1", self.base_url)
    }

    pub fn shutdown(&self) {
        // PyInstaller's onefile bootloader runs the real server in a child
        // process, so terminating the job object is what actually stops it.
        #[cfg(windows)]
        self.job.terminate();

        if let Ok(mut guard) = self.child.lock() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

impl Drop for BackendState {
    fn drop(&mut self) {
        self.shutdown();
    }
}

/// Start the API on a free loopback port and wait until it answers `/health`.
pub fn start(app: &AppHandle) -> Result<BackendState, String> {
    let port = free_port();
    let mut child = spawn(app, port)?;

    #[cfg(windows)]
    let job = process_tree::Job::attach(&child);

    if let Err(err) = wait_ready(port, &mut child) {
        #[cfg(windows)]
        job.terminate();
        let _ = child.kill();
        let _ = child.wait();
        return Err(err);
    }

    Ok(BackendState {
        base_url: format!("http://127.0.0.1:{port}"),
        child: Mutex::new(Some(child)),
        #[cfg(windows)]
        job,
    })
}

fn free_port() -> u16 {
    TcpListener::bind(("127.0.0.1", 0))
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(8757)
}

fn data_dir(app: &AppHandle) -> PathBuf {
    // Let an explicit override win: useful for portable installs, tests, and
    // running two libraries side by side.
    if let Some(path) = std::env::var_os("MITSU_DATA_DIR") {
        if !path.is_empty() {
            return PathBuf::from(path);
        }
    }

    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("mitsu-desktop"))
}

fn spawn(app: &AppHandle, port: u16) -> Result<Child, String> {
    let data_dir = data_dir(app);
    let log_path = data_dir.join("logs");
    let _ = std::fs::create_dir_all(&log_path);

    if let Some(child) = spawn_sidecar(&data_dir, port, &log_path)? {
        return Ok(child);
    }

    spawn_python(&data_dir, port, &log_path)
}

fn backend_env(command: &mut Command, data_dir: &Path, port: u16) {
    command
        .env("MITSU_HOST", "127.0.0.1")
        .env("MITSU_PORT", port.to_string())
        .env("MITSU_DATA_DIR", data_dir)
        .env("MITSU_FRONTEND_ORIGIN", "http://tauri.localhost")
        .env("MITSU_DESKTOP", "1")
        .env("PYTHONUNBUFFERED", "1");
}

fn log_stdio(command: &mut Command, log_dir: &Path) {
    let log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("backend.log"));

    match log {
        Ok(file) => {
            let copy = file.try_clone();
            command.stdout(Stdio::from(file));
            command.stderr(match copy {
                Ok(handle) => Stdio::from(handle),
                Err(_) => Stdio::null(),
            });
        }
        Err(_) => {
            command.stdout(Stdio::null()).stderr(Stdio::null());
        }
    }
}

fn hide_console(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = command;
    }
}

fn sidecar_path() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("MITSU_BACKEND_BIN") {
        let path = PathBuf::from(explicit);
        if path.is_file() {
            return Some(path);
        }
    }

    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let name = if cfg!(windows) {
        "mitsu-backend.exe"
    } else {
        "mitsu-backend"
    };
    let candidate = dir.join(name);
    candidate.is_file().then_some(candidate)
}

fn spawn_sidecar(
    data_dir: &Path,
    port: u16,
    log_dir: &Path,
) -> Result<Option<Child>, String> {
    let Some(path) = sidecar_path() else {
        return Ok(None);
    };

    let mut command = Command::new(&path);
    backend_env(&mut command, data_dir, port);
    log_stdio(&mut command, log_dir);
    hide_console(&mut command);

    command
        .spawn()
        .map(Some)
        .map_err(|err| format!("could not start backend sidecar at {}: {err}", path.display()))
}

fn repo_root() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd);
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.to_path_buf());
        }
    }

    for start in candidates {
        let mut dir: Option<&Path> = Some(start.as_path());
        for _ in 0..6 {
            let Some(current) = dir else { break };
            if current.join("backend").join("app").join("main.py").is_file() {
                return Some(current.to_path_buf());
            }
            dir = current.parent();
        }
    }

    None
}

fn spawn_python(data_dir: &Path, port: u16, log_dir: &Path) -> Result<Child, String> {
    let root = repo_root().ok_or_else(|| {
        "No packaged backend was found and the source tree could not be located for a development backend."
            .to_string()
    })?;
    let backend_dir = root.join("backend");

    let explicit = std::env::var("MITSU_PYTHON").ok();
    let interpreters: Vec<&str> = match explicit.as_deref() {
        Some(value) => vec![value],
        None => vec!["python", "py", "python3"],
    };

    let mut last_error = String::from("no Python interpreter found");

    for interpreter in interpreters {
        let mut command = Command::new(interpreter);
        command
            .current_dir(&backend_dir)
            .args([
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
            ])
            .stdin(Stdio::null());

        backend_env(&mut command, data_dir, port);
        log_stdio(&mut command, log_dir);
        hide_console(&mut command);

        match command.spawn() {
            Ok(child) => return Ok(child),
            Err(err) => last_error = format!("{interpreter}: {err}"),
        }
    }

    Err(format!(
        "Could not start the Python backend ({last_error}). Install the backend dependencies or run the packaged build."
    ))
}

fn wait_ready(port: u16, child: &mut Child) -> Result<(), String> {
    let deadline = Instant::now() + READY_TIMEOUT;

    while Instant::now() < deadline {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(format!(
                "The backend exited before it was ready (status: {status})."
            ));
        }

        if http_status(port, "/health") == Some(200) {
            return Ok(());
        }

        std::thread::sleep(POLL_INTERVAL);
    }

    Err("The backend did not become ready in time.".to_string())
}

fn http_status(port: u16, path: &str) -> Option<u16> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_millis(500)).ok()?;
    stream
        .set_read_timeout(Some(Duration::from_millis(1500)))
        .ok()?;
    let request = format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes()).ok()?;

    let mut buffer = [0u8; 64];
    let read = stream.read(&mut buffer).ok()?;
    let head = String::from_utf8_lossy(&buffer[..read]);
    head.split_whitespace().nth(1)?.parse().ok()
}

/// Kills the backend process tree when the app exits.
///
/// The PyInstaller onefile bootloader starts the real server as a child, so
/// killing only the bootloader would leave a stray process holding the port and
/// the SQLite database. A job object with `KILL_ON_JOB_CLOSE` covers children.
#[cfg(windows)]
mod process_tree {
    use std::os::windows::io::AsRawHandle;

    type Handle = isize;

    #[repr(C)]
    #[derive(Default)]
    struct BasicLimitInformation {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct IoCounters {
        read_operations: u64,
        write_operations: u64,
        other_operations: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    #[derive(Default)]
    struct ExtendedLimitInformation {
        basic: BasicLimitInformation,
        io: IoCounters,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x2000;
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION: i32 = 9;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateJobObjectW(
            attributes: *mut core::ffi::c_void,
            name: *const u16,
        ) -> Handle;
        fn SetInformationJobObject(
            job: Handle,
            class: i32,
            information: *const core::ffi::c_void,
            length: u32,
        ) -> i32;
        fn AssignProcessToJobObject(job: Handle, process: Handle) -> i32;
        fn TerminateJobObject(job: Handle, exit_code: u32) -> i32;
        fn CloseHandle(handle: Handle) -> i32;
    }

    pub struct Job(Handle);

    impl Job {
        pub fn attach(child: &std::process::Child) -> Self {
            unsafe {
                let job = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
                if job == 0 {
                    return Job(0);
                }

                let mut information = ExtendedLimitInformation::default();
                information.basic.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                let configured = SetInformationJobObject(
                    job,
                    JOB_OBJECT_EXTENDED_LIMIT_INFORMATION,
                    &information as *const _ as *const core::ffi::c_void,
                    std::mem::size_of::<ExtendedLimitInformation>() as u32,
                );
                if configured == 0 {
                    CloseHandle(job);
                    return Job(0);
                }

                let process = child.as_raw_handle() as Handle;
                if AssignProcessToJobObject(job, process) == 0 {
                    CloseHandle(job);
                    return Job(0);
                }

                Job(job)
            }
        }

        pub fn terminate(&self) {
            if self.0 != 0 {
                unsafe {
                    TerminateJobObject(self.0, 1);
                }
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            if self.0 != 0 {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }
}
