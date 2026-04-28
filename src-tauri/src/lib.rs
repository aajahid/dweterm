use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::{
    io::{Read, Write},
    sync::Mutex,
    thread,
};
use tauri::{AppHandle, Emitter, State};

struct TerminalSession {
    child: Box<dyn Child + Send>,
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

#[derive(Default)]
struct TerminalState {
    session: Mutex<Option<TerminalSession>>,
}

#[tauri::command]
fn start_terminal(
    app_handle: AppHandle,
    state: State<'_, TerminalState>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "terminal state lock poisoned".to_string())?;

    if session.is_some() {
        return Ok(());
    }

    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("failed to open PTY: {error}"))?;

    let mut command = CommandBuilder::new("powershell.exe");
    command.args(["-NoLogo"]);

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| format!("failed to start PowerShell: {error}"))?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| format!("failed to create terminal reader: {error}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| format!("failed to create terminal writer: {error}"))?;

    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(bytes_read) => {
                    let output = String::from_utf8_lossy(&buffer[..bytes_read]).to_string();
                    let _ = app_handle.emit("terminal-output", output);
                }
                Err(error) => {
                    let _ = app_handle.emit(
                        "terminal-output",
                        format!("\r\n[DweTerm] terminal read error: {error}\r\n"),
                    );
                    break;
                }
            }
        }

        let _ = app_handle.emit("terminal-exit", ());
    });

    *session = Some(TerminalSession {
        child,
        master: pair.master,
        writer,
    });

    Ok(())
}

#[tauri::command]
fn write_terminal(state: State<'_, TerminalState>, data: String) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "terminal state lock poisoned".to_string())?;

    let Some(session) = session.as_mut() else {
        return Err("terminal is not running".to_string());
    };

    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|error| format!("failed to write to terminal: {error}"))?;
    session
        .writer
        .flush()
        .map_err(|error| format!("failed to flush terminal input: {error}"))?;

    Ok(())
}

#[tauri::command]
fn resize_terminal(state: State<'_, TerminalState>, cols: u16, rows: u16) -> Result<(), String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "terminal state lock poisoned".to_string())?;

    let Some(session) = session.as_ref() else {
        return Ok(());
    };

    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| format!("failed to resize terminal: {error}"))?;

    Ok(())
}

#[tauri::command]
fn stop_terminal(state: State<'_, TerminalState>) -> Result<(), String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "terminal state lock poisoned".to_string())?;

    if let Some(mut session) = session.take() {
        let _ = session.child.kill();
        let _ = session.child.wait();
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(TerminalState::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            start_terminal,
            write_terminal,
            resize_terminal,
            stop_terminal
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
