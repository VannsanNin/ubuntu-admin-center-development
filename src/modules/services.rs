use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Service Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let filter_row = Box::new(Orientation::Horizontal, 0);
    filter_row.add_css_class("linked");
    filter_row.add_css_class("search-row");
    let filter_entry = Entry::builder().placeholder_text("Filter services...").build();
    filter_entry.set_hexpand(true);
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    filter_row.append(&filter_entry);
    filter_row.append(&refresh_btn);
    container.append(&filter_row);

    let list_box = ListBox::new();
    list_box.add_css_class("boxed-list");
    let fe_for_filter = filter_entry.clone();
    list_box.set_filter_func(move |row| {
        let query = fe_for_filter.text().to_lowercase();
        if query.is_empty() {
            return true;
        }
        row.widget_name().to_lowercase().contains(&query)
    });

    let scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&list_box)
        .build();
    scroll.set_vexpand(true);
    container.append(&scroll);

    let logs_toggle_btn = Button::from_icon_name("go-down-symbolic");
    logs_toggle_btn.set_tooltip_text(Some("Toggle logs panel"));
    logs_toggle_btn.set_halign(Align::Start);
    container.append(&logs_toggle_btn);

    let logs_panel = Box::new(Orientation::Vertical, 4);
    logs_panel.add_css_class("terminal-panel");
    logs_panel.set_size_request(-1, 160);
    let logs_label = Label::new(Some("$ Select a service and click Logs to view recent output"));
    logs_label.add_css_class("terminal-text");
    logs_label.add_css_class("terminal-idle");
    logs_label.set_halign(Align::Start);
    logs_label.set_valign(Align::Start);
    logs_label.set_wrap(true);
    logs_label.set_xalign(0.0);
    let logs_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&logs_label)
        .build();
    logs_scroll.set_vexpand(true);
    logs_panel.append(&logs_scroll);
    container.append(&logs_panel);

    logs_toggle_btn.connect_clicked(glib::clone!(#[weak] logs_panel, #[weak] logs_toggle_btn, move |_| {
        let visible = !logs_panel.is_visible();
        logs_panel.set_visible(visible);
        logs_toggle_btn.set_icon_name(if visible { "go-up-symbolic" } else { "go-down-symbolic" });
    }));

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Loading services..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    {
        let list_box = list_box.clone();
        let status_label = status_label.clone();
        let logs_label = logs_label.clone();
        let spinner = spinner.clone();
        ctx.spawn_local(async move {
            load_services(&list_box, &status_label, &logs_label).await;
            spinner.stop();
            spinner.set_visible(false);
        });
    }

    filter_entry.connect_changed(glib::clone!(#[weak] list_box, move |_| {
        list_box.invalidate_filter();
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] logs_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] logs_label, #[weak] spinner, async move {
            load_services(&list_box, &status_label, &logs_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_services(list_box: &ListBox, status_label: &Label, logs_label: &Label) {
    status_label.set_text("Loading services...");
    let result = run_shell("systemctl list-units --type=service --no-pager --no-legend 2>/dev/null | head -300").await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 3 {
            let svc_name = parts[0].trim_end_matches(".service");
            let active = parts[1];
            let sub = parts[2];

            let row = ListBoxRow::new();
            row.set_widget_name(svc_name);

            let row_box = Box::new(Orientation::Horizontal, 10);
            row_box.add_css_class("service-row");

            let (dot_class, state_class, state_text) = match active {
                "active" => ("green", "state-active", "Active"),
                "failed" => ("red", "state-failed", "Failed"),
                _ => ("gray", "state-inactive", "Inactive"),
            };

            let status_dot = Label::new(Some("\u{25cf}"));
            status_dot.add_css_class("status-dot");
            status_dot.add_css_class(dot_class);
            row_box.append(&status_dot);

            let name_box = Box::new(Orientation::Vertical, 2);
            name_box.set_hexpand(true);

            let name_row = Box::new(Orientation::Horizontal, 8);
            let name_label = Label::new(Some(svc_name));
            name_label.add_css_class("service-name");
            name_label.set_halign(Align::Start);
            name_row.append(&name_label);

            let badge = Label::new(Some(state_text));
            badge.add_css_class("state-badge");
            badge.add_css_class(state_class);
            name_row.append(&badge);
            name_box.append(&name_row);

            let sub_label = Label::new(Some(sub));
            sub_label.add_css_class("package-meta");
            sub_label.set_halign(Align::Start);
            name_box.append(&sub_label);

            row_box.append(&name_box);

            let name = svc_name.to_string();

            let start_btn = Button::with_label("Start");
            start_btn.connect_clicked(glib::clone!(#[strong] name, move |_| {
                let ctx = glib::MainContext::default();
                let name = name.clone();
                ctx.spawn_local(async move {
                    run_shell(&format!("sudo systemctl start {}", name)).await;
                });
            }));
            row_box.append(&start_btn);

            let stop_btn = Button::with_label("Stop");
            stop_btn.connect_clicked(glib::clone!(#[strong] name, move |_| {
                let ctx = glib::MainContext::default();
                let name = name.clone();
                ctx.spawn_local(async move {
                    run_shell(&format!("sudo systemctl stop {}", name)).await;
                });
            }));
            row_box.append(&stop_btn);

            let restart_btn = Button::with_label("Restart");
            restart_btn.connect_clicked(glib::clone!(#[strong] name, move |_| {
                let ctx = glib::MainContext::default();
                let name = name.clone();
                ctx.spawn_local(async move {
                    run_shell(&format!("sudo systemctl restart {}", name)).await;
                });
            }));
            row_box.append(&restart_btn);

            let logs_btn = Button::with_label("Logs");
            logs_btn.connect_clicked(glib::clone!(#[strong] name, #[weak] logs_label, move |_| {
                let ctx = glib::MainContext::default();
                let name = name.clone();
                logs_label.remove_css_class("terminal-idle");
                logs_label.set_text(&format!("$ journalctl -u {} -n 50", name));
                ctx.spawn_local(glib::clone!(#[weak] logs_label, async move {
                    let r = run_shell(&format!("journalctl -u {} --no-pager -n 50 2>/dev/null", name)).await;
                    logs_label.set_text(&format!("$ journalctl -u {} -n 50\n{}\n{}", name, r.stdout, r.stderr));
                }));
            }));
            row_box.append(&logs_btn);

            row.set_child(Some(&row_box));
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("Loaded {} services", count));
}
