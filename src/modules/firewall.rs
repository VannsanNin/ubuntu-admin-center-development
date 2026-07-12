#![allow(deprecated)]
use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, ComboBoxText, Spinner};
use crate::system::commands::{run_shell, sanitize_input};

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header_row = Box::new(Orientation::Horizontal, 12);
    let header = Label::new(Some("Firewall Manager (UFW)"));
    header.add_css_class("title-1");
    header.set_hexpand(true);
    header.set_halign(Align::Start);
    let status_pill = Label::new(Some("Checking..."));
    status_pill.add_css_class("fw-status-pill");
    status_pill.add_css_class("fw-inactive");
    header_row.append(&header);
    header_row.append(&status_pill);
    container.append(&header_row);

    let toggle_row = Box::new(Orientation::Horizontal, 0);
    toggle_row.add_css_class("linked");
    toggle_row.add_css_class("search-row");
    let enable_btn = Button::with_label("Enable");
    enable_btn.add_css_class("suggested-action");
    let disable_btn = Button::with_label("Disable");
    let reset_btn = Button::with_label("Reset");
    reset_btn.add_css_class("destructive-action");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    toggle_row.append(&enable_btn);
    toggle_row.append(&disable_btn);
    toggle_row.append(&reset_btn);
    toggle_row.append(&refresh_btn);
    container.append(&toggle_row);

    let rule_row = Box::new(Orientation::Horizontal, 8);
    rule_row.add_css_class("rule-form-card");
    let port_entry = Entry::builder().placeholder_text("Port number").build();
    port_entry.set_hexpand(true);
    let protocol_combo: ComboBoxText = ComboBoxText::new();
    protocol_combo.append_text("tcp");
    protocol_combo.append_text("udp");
    protocol_combo.set_active(Some(0));
    let addr_entry = Entry::builder().placeholder_text("From address (optional)").build();
    addr_entry.set_hexpand(true);
    let allow_btn = Button::with_label("Allow");
    allow_btn.add_css_class("suggested-action");
    let deny_btn = Button::with_label("Deny");
    deny_btn.add_css_class("destructive-action");
    rule_row.append(&port_entry);
    rule_row.append(&protocol_combo);
    rule_row.append(&addr_entry);
    rule_row.append(&allow_btn);
    rule_row.append(&deny_btn);
    container.append(&rule_row);

    let list_box = ListBox::new();
    list_box.add_css_class("boxed-list");
    let scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&list_box)
        .build();
    scroll.set_vexpand(true);
    container.append(&scroll);

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Loading firewall status..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
        load_firewall(&list_box, &status_label, &status_pill).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_enable = ctx.clone();
    enable_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, move |_| {
        let ctx = ctx_enable.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
            let r = run_shell("sudo ufw --force enable 2>&1").await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_firewall(&list_box, &status_label, &status_pill).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_disable = ctx.clone();
    disable_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, move |_| {
        let ctx = ctx_disable.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
            let r = run_shell("sudo ufw disable 2>&1").await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_firewall(&list_box, &status_label, &status_pill).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_reset = ctx.clone();
    reset_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, move |_| {
        let ctx = ctx_reset.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
            let r = run_shell("sudo ufw --force reset 2>&1").await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_firewall(&list_box, &status_label, &status_pill).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
            load_firewall(&list_box, &status_label, &status_pill).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_allow = ctx.clone();
    allow_btn.connect_clicked(glib::clone!(#[weak] port_entry, #[weak] protocol_combo, #[weak] addr_entry, #[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, move |_| {
        let port = sanitize_input(&port_entry.text());
        let proto = protocol_combo.active_text().unwrap_or_else(|| glib::GString::from("tcp"));
        let addr = sanitize_input(&addr_entry.text());
        if port.is_empty() { return; }
        let ctx = ctx_allow.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Allowing {}/{}...", port, proto));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
            let cmd = if addr.is_empty() {
                format!("sudo ufw allow {}/{}", port, proto)
            } else {
                format!("sudo ufw allow from {} to any port {} proto {}", addr, port, proto)
            };
            let r = run_shell(&cmd).await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_firewall(&list_box, &status_label, &status_pill).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_deny = ctx.clone();
    deny_btn.connect_clicked(glib::clone!(#[weak] port_entry, #[weak] protocol_combo, #[weak] addr_entry, #[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, move |_| {
        let port = sanitize_input(&port_entry.text());
        let proto = protocol_combo.active_text().unwrap_or_else(|| glib::GString::from("tcp"));
        let addr = sanitize_input(&addr_entry.text());
        if port.is_empty() { return; }
        let ctx = ctx_deny.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Denying {}/{}...", port, proto));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] status_pill, #[weak] spinner, async move {
            let cmd = if addr.is_empty() {
                format!("sudo ufw deny {}/{}", port, proto)
            } else {
                format!("sudo ufw deny from {} to any port {} proto {}", addr, port, proto)
            };
            let r = run_shell(&cmd).await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_firewall(&list_box, &status_label, &status_pill).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_firewall(list_box: &ListBox, status_label: &Label, status_pill: &Label) {
    status_label.set_text("Loading firewall status...");
    let result = run_shell("sudo ufw status numbered 2>&1").await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let is_active = result.stdout.contains("Status: active");
    status_pill.set_text(if is_active { "Active" } else { "Inactive" });
    status_pill.remove_css_class(if is_active { "fw-inactive" } else { "fw-active" });
    status_pill.add_css_class(if is_active { "fw-active" } else { "fw-inactive" });

    let mut count = 0;
    for line in result.stdout.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('[') {
            continue;
        }
        if let Some(row) = build_rule_row(trimmed) {
            list_box.append(&row);
            count += 1;
        }
    }

    status_label.set_text(&format!("{} rule(s) loaded", count));
}

fn build_rule_row(line: &str) -> Option<ListBoxRow> {
    let close_bracket = line.find(']')?;
    let rule_num: u32 = line[1..close_bracket].trim().parse().ok()?;
    let rest = line[close_bracket + 1..].trim();

    let fields: Vec<&str> = rest.split("  ").map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if fields.len() < 2 {
        return None;
    }

    let to_field = fields[0];
    let action_field = fields[1];
    let from_field = fields.get(2).copied().unwrap_or("Anywhere");

    let action_lower = action_field.to_lowercase();
    let (action_class, action_text) = if action_lower.contains("allow") {
        ("action-allow", "Allow")
    } else if action_lower.contains("reject") {
        ("action-reject", "Reject")
    } else if action_lower.contains("limit") {
        ("action-limit", "Limit")
    } else {
        ("action-deny", "Deny")
    };

    let row = ListBoxRow::new();
    row.set_widget_name(&rule_num.to_string());

    let row_box = Box::new(Orientation::Horizontal, 12);
    row_box.add_css_class("rule-row");

    let num_label = Label::new(Some(&format!("#{}", rule_num)));
    num_label.add_css_class("rule-from");
    row_box.append(&num_label);

    let text_box = Box::new(Orientation::Vertical, 2);
    text_box.set_hexpand(true);

    let port_row = Box::new(Orientation::Horizontal, 8);
    let port_label = Label::new(Some(to_field));
    port_label.add_css_class("rule-port");
    port_label.set_halign(Align::Start);
    port_row.append(&port_label);

    let badge = Label::new(Some(action_text));
    badge.add_css_class("rule-action-badge");
    badge.add_css_class(action_class);
    port_row.append(&badge);
    text_box.append(&port_row);

    let from_label = Label::new(Some(&format!("From: {}", from_field)));
    from_label.add_css_class("rule-from");
    from_label.set_halign(Align::Start);
    text_box.append(&from_label);

    row_box.append(&text_box);

    let delete_btn = Button::from_icon_name("user-trash-symbolic");
    delete_btn.add_css_class("destructive-action");
    delete_btn.set_valign(Align::Center);
    delete_btn.connect_clicked(move |btn| {
        let ctx = glib::MainContext::default();
        btn.set_sensitive(false);
        ctx.spawn_local(async move {
            run_shell(&format!("echo y | sudo ufw delete {}", rule_num)).await;
        });
    });
    row_box.append(&delete_btn);

    row.set_child(Some(&row_box));
    Some(row)
}
