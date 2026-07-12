#![allow(deprecated)]
use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ComboBoxText, SpinButton, Align, Spinner};
use crate::system::commands::run_shell;

const LOG_TYPES: &[(&str, &str)] = &[
    ("syslog", "/var/log/syslog"),
    ("auth.log", "/var/log/auth.log"),
    ("kern.log", "/var/log/kern.log"),
    ("dmesg", "/var/log/dmesg"),
    ("docker", "/var/log/docker.log"),
    ("nginx access", "/var/log/nginx/access.log"),
    ("nginx error", "/var/log/nginx/error.log"),
    ("apache access", "/var/log/apache2/access.log"),
    ("apache error", "/var/log/apache2/error.log"),
];

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header_row = Box::new(Orientation::Horizontal, 12);
    let header = Label::new(Some("Log Viewer"));
    header.add_css_class("title-1");
    header.set_hexpand(true);
    header.set_halign(Align::Start);
    let meta_pill = Label::new(Some("\u{2014}"));
    meta_pill.add_css_class("log-meta-pill");
    header_row.append(&header);
    header_row.append(&meta_pill);
    container.append(&header_row);

    let log_combo = ComboBoxText::new();
    for (name, _) in LOG_TYPES {
        log_combo.append_text(name);
    }
    log_combo.set_active(Some(0));

    let line_spin = SpinButton::with_range(10.0, 500.0, 10.0);
    line_spin.set_value(100.0);

    let search_row = Box::new(Orientation::Horizontal, 0);
    search_row.add_css_class("linked");
    search_row.add_css_class("search-row");
    let filter_entry = Entry::builder().placeholder_text("Filter (text)... press Enter").build();
    filter_entry.set_hexpand(true);
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    search_row.append(&filter_entry);
    search_row.append(&refresh_btn);
    container.append(&search_row);

    let options_row = Box::new(Orientation::Horizontal, 8);
    let log_label_text = Label::new(Some("Log:"));
    log_label_text.add_css_class("option-label");
    let lines_label_text = Label::new(Some("Lines:"));
    lines_label_text.add_css_class("option-label");
    options_row.append(&log_label_text);
    options_row.append(&log_combo);
    options_row.append(&lines_label_text);
    options_row.append(&line_spin);
    container.append(&options_row);

    let term_toggle_btn = Button::from_icon_name("go-down-symbolic");
    term_toggle_btn.add_css_class("log-toggle-btn");
    term_toggle_btn.set_tooltip_text(Some("Toggle log panel"));
    term_toggle_btn.set_halign(Align::Start);
    container.append(&term_toggle_btn);

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("terminal-panel");
    terminal.set_size_request(-1, 250);
    let log_label = Label::new(Some("$ Select a log type and press Refresh"));
    log_label.add_css_class("terminal-text");
    log_label.add_css_class("terminal-idle");
    log_label.set_halign(Align::Start);
    log_label.set_valign(Align::Start);
    log_label.set_wrap(true);
    log_label.set_xalign(0.0);
    log_label.set_selectable(true);
    let log_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Automatic)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&log_label)
        .build();
    log_scroll.set_vexpand(true);
    terminal.append(&log_scroll);
    container.append(&terminal);

    term_toggle_btn.connect_clicked(glib::clone!(#[weak] terminal, #[weak] term_toggle_btn, move |_| {
        let visible = !terminal.is_visible();
        terminal.set_visible(visible);
        term_toggle_btn.set_icon_name(if visible { "go-up-symbolic" } else { "go-down-symbolic" });
    }));

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Ready"));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();

    refresh_btn.connect_clicked(glib::clone!(#[weak] log_combo, #[weak] line_spin, #[weak] filter_entry, #[weak] log_label, #[weak] status_label, #[weak] spinner, #[weak] meta_pill, move |_| {
        let idx = log_combo.active().unwrap_or(0) as usize;
        let (name, log_path) = LOG_TYPES[idx];
        let lines = line_spin.value() as i32;
        let filter = filter_entry.text();

        let ctx = ctx.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Loading {}...", name));
        log_label.remove_css_class("terminal-idle");

        ctx.spawn_local(glib::clone!(#[weak] log_label, #[weak] status_label, #[weak] spinner, #[weak] meta_pill, async move {
            let result = run_shell(&format!("tail -n {} '{}' 2>&1", lines, log_path)).await;
            let filter_str = filter.as_str();
            let matched_lines: Vec<&str> = if filter_str.is_empty() {
                result.stdout.lines().collect()
            } else {
                result.stdout.lines().filter(|l| l.contains(filter_str)).collect()
            };

            let markup = build_log_markup(&matched_lines);
            log_label.set_markup(&markup);

            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text(&format!("{} lines from {}", matched_lines.len(), name));
            meta_pill.set_text(&format!("{} \u{b7} {} lines", name, matched_lines.len()));
        }));
    }));

    filter_entry.connect_activate(glib::clone!(#[weak] refresh_btn, move |_| {
        refresh_btn.activate();
    }));

    container
}

fn build_log_markup(lines: &[&str]) -> String {
    if lines.is_empty() {
        return "$ (no matching lines)".to_string();
    }

    let mut out = String::new();
    for (i, line) in lines.iter().enumerate() {
        if i > 0 {
            out.push('\n');
        }
        let escaped = glib::markup_escape_text(line);
        let lower = line.to_lowercase();

        if lower.contains("error") || lower.contains("fail") || lower.contains("critical") || lower.contains("panic") {
            out.push_str(&format!("<span foreground=\"#ff6b6b\">{}</span>", escaped));
        } else if lower.contains("warn") || lower.contains("denied") || lower.contains("timeout") {
            out.push_str(&format!("<span foreground=\"#e5c07b\">{}</span>", escaped));
        } else {
            out.push_str(&escaped);
        }
    }
    out
}
