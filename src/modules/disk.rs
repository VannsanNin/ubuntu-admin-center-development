use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Stack, StackSwitcher, Spinner, ProgressBar};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Disk Analyzer"));
    header.add_css_class("title-1");
    container.append(&header);

    let action_row = Box::new(Orientation::Horizontal, 0);
    action_row.add_css_class("linked");
    action_row.add_css_class("search-row");
    let path_entry = Entry::builder().placeholder_text("Path to scan (default: /)").build();
    path_entry.set_hexpand(true);
    let scan_btn = Button::with_label("Scan");
    scan_btn.add_css_class("suggested-action");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    action_row.append(&path_entry);
    action_row.append(&scan_btn);
    action_row.append(&refresh_btn);
    container.append(&action_row);

    let stack = Stack::new();
    let switcher = StackSwitcher::new();
    switcher.set_stack(Some(&stack));
    switcher.set_halign(Align::Start);
    container.append(&switcher);

    let mount_list = ListBox::new();
    mount_list.add_css_class("boxed-list");
    let mount_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&mount_list)
        .build();
    mount_scroll.set_vexpand(true);
    stack.add_titled(&mount_scroll, Some("mounts"), "Mount Points");

    let folder_list = ListBox::new();
    folder_list.add_css_class("boxed-list");
    let folder_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&folder_list)
        .build();
    folder_scroll.set_vexpand(true);
    stack.add_titled(&folder_scroll, Some("folders"), "Largest Folders");

    let file_list = ListBox::new();
    file_list.add_css_class("boxed-list");
    let file_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&file_list)
        .build();
    file_scroll.set_vexpand(true);
    stack.add_titled(&file_scroll, Some("files"), "Largest Files");

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Loading..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] mount_list, #[weak] status_label, #[weak] spinner, async move {
        load_mounts(&mount_list, &status_label).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_scan = ctx.clone();
    scan_btn.connect_clicked(glib::clone!(#[weak] path_entry, #[weak] folder_list, #[weak] file_list, #[weak] status_label, #[weak] spinner, move |_| {
        let path = if path_entry.text().trim().is_empty() { "/".to_string() } else { path_entry.text().trim().to_string() };
        let ctx = ctx_scan.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Scanning {}...", path));
        ctx.spawn_local(glib::clone!(#[weak] folder_list, #[weak] file_list, #[weak] status_label, #[weak] spinner, async move {
            let folders = run_shell(&format!("du -sh '{}'/*/ 2>/dev/null | sort -rh | head -30", path)).await;
            while let Some(child) = folder_list.first_child() {
                folder_list.remove(&child);
            }
            let mut folder_count = 0;
            for line in folders.stdout.lines() {
                if let Some(row) = build_size_row(line) {
                    folder_list.append(&row);
                    folder_count += 1;
                }
            }

            let files = run_shell(&format!("find '{}' -type f -exec du -sh {{}} \\; 2>/dev/null | sort -rh | head -30", path)).await;
            while let Some(child) = file_list.first_child() {
                file_list.remove(&child);
            }
            let mut file_count = 0;
            for line in files.stdout.lines() {
                if let Some(row) = build_size_row(line) {
                    file_list.append(&row);
                    file_count += 1;
                }
            }
            status_label.set_text(&format!("Found {} folders and {} files in {}", folder_count, file_count, path));
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] mount_list, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] mount_list, #[weak] status_label, #[weak] spinner, async move {
            load_mounts(&mount_list, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_mounts(list_box: &ListBox, status_label: &Label) {
    status_label.set_text("Loading mount points...");
    let result = run_shell("df -h 2>/dev/null").await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        if line.trim_start().starts_with("Filesystem") {
            continue;
        }
        if let Some(row) = build_mount_row(line) {
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("Loaded {} mount point(s)", count));
}

fn build_mount_row(line: &str) -> Option<ListBoxRow> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 6 {
        return None;
    }

    let filesystem = fields[0];
    let size = fields[1];
    let used = fields[2];
    let avail = fields[3];
    let use_pct_str = fields[4].trim_end_matches('%');
    let mount_point = fields[5..].join(" ");
    let use_pct: f64 = use_pct_str.parse().unwrap_or(0.0);

    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Horizontal, 12);
    row_box.add_css_class("mount-row");

    let text_box = Box::new(Orientation::Vertical, 4);
    text_box.set_hexpand(true);

    let name_row = Box::new(Orientation::Horizontal, 8);
    let mount_label = Label::new(Some(&mount_point));
    mount_label.add_css_class("mount-name");
    mount_label.set_halign(Align::Start);
    name_row.append(&mount_label);

    let fs_label = Label::new(Some(filesystem));
    fs_label.add_css_class("mount-path");
    name_row.append(&fs_label);
    text_box.append(&name_row);

    let bar = ProgressBar::new();
    bar.add_css_class("compact");
    bar.set_fraction((use_pct / 100.0).clamp(0.0, 1.0));
    text_box.append(&bar);

    row_box.append(&text_box);

    let usage_label = Label::new(Some(&format!("{} / {} ({}%)", used, size, use_pct_str)));
    usage_label.add_css_class("mount-usage-text");
    usage_label.set_halign(Align::End);
    usage_label.set_tooltip_text(Some(&format!("{} available", avail)));
    row_box.append(&usage_label);

    row.set_child(Some(&row_box));
    Some(row)
}

fn build_size_row(line: &str) -> Option<ListBoxRow> {
    let mut parts = line.splitn(2, char::is_whitespace);
    let size = parts.next()?.trim();
    let path = parts.next()?.trim();
    if size.is_empty() || path.is_empty() {
        return None;
    }

    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Horizontal, 12);
    row_box.add_css_class("size-row");

    let size_label = Label::new(Some(size));
    size_label.add_css_class("size-value");
    size_label.set_halign(Align::Start);
    row_box.append(&size_label);

    let path_label = Label::new(Some(path));
    path_label.add_css_class("size-path");
    path_label.set_halign(Align::Start);
    path_label.set_hexpand(true);
    path_label.set_ellipsize(gtk4::pango::EllipsizeMode::Middle);
    row_box.append(&path_label);

    row.set_child(Some(&row_box));
    Some(row)
}
