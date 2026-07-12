use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};

fn get_response(question: &str) -> (String, Vec<String>, bool) {
    let q = question.to_lowercase();
    let knowledge: Vec<(&str, &str, &[&str], bool)> = vec![
        ("cpu.usage", "To check CPU usage, use 'top' or 'htop'. For a quick view: 'mpstat -P ALL 1'", &["top", "htop", "mpstat -P ALL 1"], false),
        ("memory", "To check memory usage, use 'free -h'. For detailed info: 'cat /proc/meminfo'", &["free -h", "cat /proc/meminfo", "vmstat -s"], false),
        ("disk", "To check disk usage, use 'df -h'. For largest directories: 'du -sh /* | sort -rh | head -20'", &["df -h", "du -sh /* | sort -rh | head -20"], false),
        ("network", "To check network: 'ip addr', 'ip route', 'ss -tlnp', or 'ping -c 4 google.com'", &["ip addr", "ip route", "ss -tlnp", "ping -c 4 google.com"], false),
        ("package", "Package management: 'sudo apt update', 'sudo apt install <pkg>', 'sudo apt remove <pkg>', 'sudo apt upgrade'", &["sudo apt update", "sudo apt install <package>", "sudo apt upgrade -y"], false),
        ("service", "Service management: 'sudo systemctl status <svc>', 'sudo systemctl start/stop/restart <svc>', 'sudo systemctl enable/disable <svc>'", &["sudo systemctl status <service>", "sudo systemctl restart <service>"], false),
        ("user", "User management: 'sudo useradd -m <user>', 'sudo passwd <user>', 'sudo usermod -aG <group> <user>', 'sudo userdel -r <user>'", &["sudo useradd -m <username>", "sudo passwd <username>", "sudo usermod -aG sudo <username>"], true),
        ("firewall", "UFW firewall: 'sudo ufw status', 'sudo ufw enable/disable', 'sudo ufw allow/deny <port>/<proto>'", &["sudo ufw status", "sudo ufw allow 22/tcp", "sudo ufw enable"], true),
        ("docker", "Docker: 'docker ps -a', 'docker images', 'docker start/stop <container>', 'docker pull <image>'", &["docker ps -a", "docker images", "docker pull nginx"], false),
        ("backup", "Backup: 'tar -czf backup.tar.gz /path/to/source', 'rsync -avz /src /dst'", &["tar -czf backup.tar.gz /path/to/source", "rsync -avz /src /dst"], true),
        ("log", "Log viewing: 'journalctl -u <svc> -n 100', 'tail -f /var/log/syslog', 'less /var/log/auth.log'", &["journalctl -n 100", "tail -f /var/log/syslog"], false),
        ("process", "Process management: 'ps aux | grep <name>', 'top', 'kill -9 <PID>'", &["ps aux | grep <name>", "kill -15 <PID>", "kill -9 <PID>"], true),
        ("update", "To update your system: 'sudo apt update && sudo apt upgrade -y'", &["sudo apt update", "sudo apt upgrade -y"], true),
        ("reboot", "To reboot: 'sudo reboot'", &["sudo reboot"], true),
        ("shutdown", "To shutdown: 'sudo shutdown -h now'", &["sudo shutdown -h now"], true),
        ("ssh", "SSH: 'ssh user@host', 'ssh-keygen -t ed25519', 'ssh-copy-id user@host'", &["ssh user@hostname", "ssh-keygen -t ed25519", "ssh-copy-id user@hostname"], false),
        ("hello", "Hello! I'm your Ubuntu Admin Center AI assistant. How can I help you with system administration?", &[], false),
        ("help", "I can help with: system info, packages, services, users, firewall, network, disk, Docker, backups, SSH, logs, processes, and more!", &[], false),
    ];

    for (keyword, answer, commands, caution) in &knowledge {
        if q.contains(keyword) {
            return (answer.to_string(), commands.iter().map(|s| s.to_string()).collect(), *caution);
        }
    }

    (
        "I'm not sure about that. Try asking about: CPU, memory, disk, network, packages, services, users, firewall, Docker, backups, logs, processes, SSH, or type 'help'.".to_string(),
        vec![],
        false,
    )
}

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("AI Assistant"));
    header.add_css_class("title-1");
    container.append(&header);

    let chat_box = Box::new(Orientation::Vertical, 8);
    chat_box.set_vexpand(true);

    let chat_list = ListBox::new();
    chat_list.add_css_class("boxed-list");
    let chat_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&chat_list)
        .build();
    chat_scroll.set_vexpand(true);
    chat_box.append(&chat_scroll);
    container.append(&chat_box);

    let input_row = Box::new(Orientation::Horizontal, 0);
    input_row.add_css_class("linked");
    input_row.add_css_class("search-row");
    let question_entry = Entry::builder().placeholder_text("Ask about system administration...").build();
    question_entry.set_hexpand(true);
    let ask_btn = Button::with_label("Ask");
    ask_btn.add_css_class("suggested-action");
    input_row.append(&question_entry);
    input_row.append(&ask_btn);
    container.append(&input_row);

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Ready"));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();

    let add_message = |chat_list: &ListBox, sender: &str, text: &str, is_caution: bool| {
        let row = ListBoxRow::new();
        let msg_box = Box::new(Orientation::Vertical, 4);
        msg_box.set_margin_top(6);
        msg_box.set_margin_bottom(6);
        msg_box.set_margin_start(12);
        msg_box.set_margin_end(12);

        let sender_label = Label::new(Some(&format!("<b>{}</b>", sender)));
        sender_label.set_use_markup(true);
        sender_label.set_halign(Align::Start);
        msg_box.append(&sender_label);

        let text_label = Label::new(Some(text));
        text_label.set_halign(Align::Start);
        text_label.set_wrap(true);
        msg_box.append(&text_label);

        if is_caution {
            let caution_label = Label::new(Some("⚠ Caution: This command modifies the system"));
            caution_label.add_css_class("warning");
            caution_label.set_halign(Align::Start);
            msg_box.append(&caution_label);
        }

        row.set_child(Some(&msg_box));
        chat_list.append(&row);
    };

    let ctx2 = ctx.clone();

    ask_btn.connect_clicked(glib::clone!(#[weak] question_entry, #[weak] chat_list, #[weak] status_label, #[weak] spinner, move |_| {
        let question = question_entry.text().trim().to_string();
        if question.is_empty() { return; }
        question_entry.set_text("");

        add_message(&chat_list, "You", &question, false);

        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Thinking...");

        let ctx = ctx2.clone();
        let chat_list = chat_list.clone();
        let status_label = status_label.clone();
        let spinner = spinner.clone();
        ctx.spawn_local(async move {
            let (answer, commands, caution) = get_response(&question);
            add_message(&chat_list, "AI Assistant", &answer, false);
            for cmd in &commands {
                add_message(&chat_list, "Suggested Command", cmd, caution);
            }
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Ready");
        });
    }));

    question_entry.connect_activate(glib::clone!(#[weak] ask_btn, move |_| {
        ask_btn.activate();
    }));

    container
}
