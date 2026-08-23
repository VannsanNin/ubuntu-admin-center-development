use std::process::Stdio;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[derive(Debug, Clone, serde::Serialize)]
pub struct CmdResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i64,
}

/// Port of backend `sanitize_command`: strips shell metacharacters.
pub fn sanitize(input: &str) -> String {
    input
        .chars()
        .filter(|c| !matches!(
            c,
            ';' | '&' | '|' | '<' | '>' | '$' | '`' | '\'' | '"' | '(' | ')' | '[' | ']' | '{' | '}' | '\\'
        ))
        .filter(|c| *c != '\n' && *c != '\r')
        .collect::<String>()
        .trim()
        .to_string()
}

/// Port of `run_command`: spawn via shell, capture output with timeout.
pub async fn run(command: &str, timeout_secs: u64) -> CmdResult {
    let mut child = match Command::new("sh")
        .arg("-c")
        .arg(command)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            return CmdResult {
                stdout: String::new(),
                stderr: e.to_string(),
                exit_code: 1,
            }
        }
    };

    let out = child.stdout.take();
    let err = child.stderr.take();

    let read_all = async move {
        let o_fut = async {
            let mut buf = String::new();
            if let Some(mut o) = out {
                let _ = o.read_to_string(&mut buf).await;
            }
            buf
        };
        let e_fut = async {
            let mut ebuf = String::new();
            if let Some(mut e) = err {
                let _ = e.read_to_string(&mut ebuf).await;
            }
            ebuf
        };
        let (stdout, stderr) = tokio::join!(o_fut, e_fut);
        let status = child.wait().await;
        (status, stdout, stderr)
    };

    match tokio::time::timeout(Duration::from_secs(timeout_secs.max(1)), read_all).await {
        Ok((Ok(status), stdout, stderr)) => CmdResult {
            stdout,
            stderr,
            exit_code: status.code().unwrap_or(0) as i64,
        },
        Ok((Err(e), _, _)) => CmdResult {
            stdout: String::new(),
            stderr: e.to_string(),
            exit_code: 1,
        },
        Err(_) => CmdResult {
            stdout: String::new(),
            stderr: format!("Command timed out after {}s", timeout_secs),
            exit_code: 1,
        },
    }
}

pub async fn run30(command: &str) -> CmdResult {
    run(command, 30).await
}

/// Extract a user id from a locally-issued token ("{userId}.{random}").
pub fn user_id_from_token(token: &str) -> Option<i64> {
    token.split('.').next()?.parse().ok()
}
#[cfg(test)]
mod spawn_tests {
    #[tokio::test]
    async fn test_run_hostname() {
        let r = crate::shell::run("hostname", 5).await;
        println!("stdout={:?} stderr={:?} code={}", r.stdout, r.stderr, r.exit_code);
        let r2 = crate::shell::run("echo hello", 5).await;
        println!("echo stdout={:?} stderr={:?} code={}", r2.stdout, r2.stderr, r2.exit_code);
    }
}
