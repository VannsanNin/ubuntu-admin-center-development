use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Repository Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let add_row = Box::new(Orientation::Horizontal, 8);
    add_row.add_css_class("repo-form-card");
    let repo_entry = Entry::builder().placeholder_text("deb mirror line...").build();
    repo_entry.set_hexpand(true);
    let file_entry = Entry::builder().placeholder_text("filename.list").build();
    let add_btn = Button::with_label("Add Repository");
    add_btn.add_css_class("suggested-action");
    add_row.append(&repo_entry);
    add_row.append(&file_entry);
    add_row.append(&add_btn);
    container.append(&add_row);

    let action_row = Box::new(Orientation::Horizontal, 0);
    action_row.add_css_class("linked");
    let backup_btn = Button::with_label("Backup Sources");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    action_row.append(&backup_btn);
    action_row.append(&refresh_btn);
    container.append(&action_row);

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
    let status_label = Label::new(Some("Loading repositories..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
        load_repos(&list_box, &status_label).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_add = ctx.clone();
    add_btn.connect_clicked(glib::clone!(#[weak] repo_entry, #[weak] file_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let repo = repo_entry.text();
        let file = file_entry.text();
        if repo.is_empty() || file.is_empty() { return; }
        let ctx = ctx_add.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Adding repository to {}...", file));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            let cmd = format!("echo '{}' | sudo tee /etc/apt/sources.list.d/{} > /dev/null", repo, file);
            let r = run_shell(&cmd).await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_repos(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_backup = ctx.clone();
    backup_btn.connect_clicked(glib::clone!(#[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_backup.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Backing up /etc/apt...");
        ctx.spawn_local(glib::clone!(#[weak] status_label, #[weak] spinner, async move {
            let r = run_shell("sudo cp -r /etc/apt /etc/apt.backup.$(date +%Y%m%d_%H%M%S) 2>&1").await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_repos(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_repos(list_box: &ListBox, status_label: &Label) {
    status_label.set_text("Loading repositories...");
    let main_result = run_shell("cat /etc/apt/sources.list 2>/dev/null").await;
    let dir_result = run_shell(
        "for f in /etc/apt/sources.list.d/*.list; do echo \"###FILE:$f\"; cat \"$f\" 2>/dev/null; done"
    ).await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;

    for line in main_result.stdout.lines() {
        if let Some(row) = build_repo_row(line, "sources.list") {
            list_box.append(&row);
            count += 1;
        }
    }

    let mut current_file = "sources.list.d";
    for line in dir_result.stdout.lines() {
        if let Some(fname) = line.strip_prefix("###FILE:") {
            current_file = fname.rsplit('/').next().unwrap_or(fname);
            continue;
        }
        if let Some(row) = build_repo_row(line, current_file) {
            list_box.append(&row);
            count += 1;
        }
    }

    status_label.set_text(&format!("Loaded {} repository entries", count));
}

fn build_repo_row(raw_line: &str, source_file: &str) -> Option<ListBoxRow> {
    let line = raw_line.trim();
    if line.is_empty() {
        return None;
    }

    let (is_disabled, content) = if let Some(rest) = line.strip_prefix('#') {
        (true, rest.trim())
    } else {
        (false, line)
    };

    if content.is_empty() {
        return None;
    }

    let parts: Vec<&str> = content.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    let repo_type = parts[0];
    if repo_type != "deb" && repo_type != "deb-src" {
        return None;
    }

    let uri = parts.get(1).copied().unwrap_or("");
    let distro = parts.get(2).copied().unwrap_or("");
    let components = if parts.len() > 3 { parts[3..].join(" ") } else { String::new() };

    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Horizontal, 12);
    row_box.add_css_class("repo-row");
    if is_disabled {
        row_box.add_css_class("repo-is-disabled");
    }

    let type_badge = Label::new(Some(if repo_type == "deb-src" { "SRC" } else { "DEB" }));
    type_badge.add_css_class("repo-type-badge");
    type_badge.add_css_class(if repo_type == "deb-src" { "type-deb-src" } else { "type-deb" });
    row_box.append(&type_badge);

    let text_box = Box::new(Orientation::Vertical, 2);
    text_box.set_hexpand(true);

    let uri_row = Box::new(Orientation::Horizontal, 8);
    let uri_label = Label::new(Some(uri));
    uri_label.add_css_class("repo-uri");
    uri_label.set_halign(Align::Start);
    uri_label.set_ellipsize(gtk4::pango::EllipsizeMode::Middle);
    uri_row.append(&uri_label);

    if is_disabled {
        let badge = Label::new(Some("Disabled"));
        badge.add_css_class("repo-disabled-badge");
        uri_row.append(&badge);
    }
    text_box.append(&uri_row);

    let detail_text = if components.is_empty() {
        distro.to_string()
    } else {
        format!("{} · {}", distro, components)
    };
    let detail_label = Label::new(Some(&detail_text));
    detail_label.add_css_class("repo-detail");
    detail_label.set_halign(Align::Start);
    detail_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
    text_box.append(&detail_label);

    let file_label = Label::new(Some(source_file));
    file_label.add_css_class("repo-source-file");
    file_label.set_halign(Align::Start);
    text_box.append(&file_label);

    row_box.append(&text_box);
    row.set_child(Some(&row_box));
    Some(row)
}
