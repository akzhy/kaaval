use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tracing::warn;
use uuid::Uuid;

use crate::network::{normalize_path_key, NetworkRequestDto};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct RecordedNetworkEvent {
    captured_at_ms: u64,
    #[serde(flatten)]
    request: NetworkRequestDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct RecordingFile {
    schema_version: u32,
    id: String,
    name: String,
    started_at_ms: u64,
    stopped_at_ms: u64,
    events: Vec<RecordedNetworkEvent>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct RecordingSummary {
    id: String,
    name: String,
    started_at_ms: u64,
    stopped_at_ms: u64,
    event_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct RecordingStatus {
    is_recording: bool,
    started_at_ms: Option<u64>,
    event_count: usize,
}

#[derive(Debug)]
struct ActiveRecording {
    id: String,
    started_at_ms: u64,
    events: Vec<RecordedNetworkEvent>,
    seen_paths: HashSet<String>,
}

#[derive(Debug)]
pub(crate) struct RecordingsState {
    dir: PathBuf,
    active: Option<ActiveRecording>,
}

impl RecordingsState {
    pub(crate) fn init(app_data_dir: PathBuf) -> Self {
        let dir = app_data_dir.join("recordings");
        if let Err(err) = std::fs::create_dir_all(&dir) {
            warn!(error = %err, path = %dir.display(), "failed to create recordings directory");
        }
        Self { dir, active: None }
    }

    pub(crate) fn append_snapshot(&mut self, requests: &[NetworkRequestDto]) {
        let Some(active) = self.active.as_mut() else {
            return;
        };

        let captured_at_ms = now_unix_ms();
        for request in requests {
            let key = normalize_path_key(&request.app_path);
            if active.seen_paths.contains(&key) {
                continue;
            }

            active.seen_paths.insert(key);
            active.events.push(RecordedNetworkEvent {
                captured_at_ms,
                request: request.clone(),
            });
        }
    }

    fn start(&mut self) -> Result<RecordingStatus, String> {
        if self.active.is_some() {
            return Err("recording is already in progress".to_string());
        }

        self.active = Some(ActiveRecording {
            id: Uuid::new_v4().simple().to_string(),
            started_at_ms: now_unix_ms(),
            events: Vec::new(),
            seen_paths: HashSet::new(),
        });

        Ok(self.status())
    }

    fn stop(&mut self, name: Option<String>) -> Result<RecordingSummary, String> {
        let active = self
            .active
            .take()
            .ok_or_else(|| "no active recording to stop".to_string())?;

        let stopped_at_ms = now_unix_ms();
        let chosen = name.unwrap_or_default();
        let trimmed = chosen.trim();
        let recording_name = match trimmed {
            "" => format!("recording-{}", active.started_at_ms),
            _ => trimmed.to_string(),
        };

        let file = RecordingFile {
            schema_version: 1,
            id: active.id,
            name: recording_name,
            started_at_ms: active.started_at_ms,
            stopped_at_ms,
            events: active.events,
        };

        let path = self.dir.join(format!("{}.json", file.id));
        let text = serde_json::to_string_pretty(&file)
            .map_err(|err| format!("failed to serialize recording file: {err}"))?;
        std::fs::write(&path, text)
            .map_err(|err| format!("failed to save recording file {}: {err}", path.display()))?;

        Ok(RecordingSummary {
            id: file.id,
            name: file.name,
            started_at_ms: file.started_at_ms,
            stopped_at_ms: file.stopped_at_ms,
            event_count: file.events.len(),
        })
    }

    fn status(&self) -> RecordingStatus {
        match &self.active {
            Some(active) => RecordingStatus {
                is_recording: true,
                started_at_ms: Some(active.started_at_ms),
                event_count: active.events.len(),
            },
            None => RecordingStatus {
                is_recording: false,
                started_at_ms: None,
                event_count: 0,
            },
        }
    }

    fn list_files(&self) -> Result<Vec<RecordingSummary>, String> {
        let mut out = Vec::new();
        let entries = std::fs::read_dir(&self.dir).map_err(|err| {
            format!(
                "failed to read recordings directory {}: {err}",
                self.dir.display()
            )
        })?;

        for entry in entries {
            let entry = match entry {
                Ok(item) => item,
                Err(err) => {
                    warn!(error = %err, "failed to iterate recordings directory entry");
                    continue;
                }
            };

            let path = entry.path();
            let is_json = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("json"))
                .unwrap_or(false);
            if !is_json {
                continue;
            }

            let text = match std::fs::read_to_string(&path) {
                Ok(text) => text,
                Err(err) => {
                    warn!(error = %err, path = %path.display(), "failed to read recording file");
                    continue;
                }
            };

            let file = match serde_json::from_str::<RecordingFile>(&text) {
                Ok(file) => file,
                Err(err) => {
                    warn!(error = %err, path = %path.display(), "failed to parse recording file");
                    continue;
                }
            };

            out.push(RecordingSummary {
                id: file.id,
                name: file.name,
                started_at_ms: file.started_at_ms,
                stopped_at_ms: file.stopped_at_ms,
                event_count: file.events.len(),
            });
        }

        out.sort_by(|a, b| b.stopped_at_ms.cmp(&a.stopped_at_ms));
        Ok(out)
    }

    fn get_file(&self, id: &str) -> Result<RecordingFile, String> {
        if !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        {
            return Err("invalid recording id".to_string());
        }

        let path = self.dir.join(format!("{id}.json"));
        let text = std::fs::read_to_string(&path)
            .map_err(|err| format!("failed to read recording file {}: {err}", path.display()))?;
        serde_json::from_str::<RecordingFile>(&text)
            .map_err(|err| format!("failed to parse recording file {}: {err}", path.display()))
    }
}

fn now_unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub(crate) fn get_recording_status(
    recordings_state: tauri::State<'_, Mutex<RecordingsState>>,
) -> Result<RecordingStatus, String> {
    let recordings = recordings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock recordings state".to_string())?;
    Ok(recordings.status())
}

#[tauri::command]
pub(crate) fn start_recording(
    recordings_state: tauri::State<'_, Mutex<RecordingsState>>,
) -> Result<RecordingStatus, String> {
    let mut recordings = recordings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock recordings state".to_string())?;
    recordings.start()
}

#[tauri::command]
pub(crate) fn stop_recording(
    name: Option<String>,
    recordings_state: tauri::State<'_, Mutex<RecordingsState>>,
) -> Result<RecordingSummary, String> {
    let mut recordings = recordings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock recordings state".to_string())?;
    recordings.stop(name)
}

#[tauri::command]
pub(crate) fn list_recordings(
    recordings_state: tauri::State<'_, Mutex<RecordingsState>>,
) -> Result<Vec<RecordingSummary>, String> {
    let recordings = recordings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock recordings state".to_string())?;
    recordings.list_files()
}

#[tauri::command]
pub(crate) fn get_recording(
    id: String,
    recordings_state: tauri::State<'_, Mutex<RecordingsState>>,
) -> Result<RecordingFile, String> {
    let recordings = recordings_state
        .inner()
        .lock()
        .map_err(|_| "failed to lock recordings state".to_string())?;
    recordings.get_file(&id)
}
