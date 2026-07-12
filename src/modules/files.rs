use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::run_shell;
use std::path::Path;
use std::cell::RefCell;
use std::rc::Rc;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("File Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let nav_row = Box::new(Orientation::Horizontal, 0);
    nav_row.add_css_class("linked");
    nav_row.add_css_class("search-row");
    let back_btn = Button::from_icon_name("go-up-symbolic");
    let path_entry = Entry::builder().placeholder_text("/").build();
    path_entry.add_css_class("path-entry");
    path_entry.set_text("/");
    path_entry.set_hexpand(true);
    let go_btn = Button::with_label("Go");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    nav_row.append(&back_btn);
    nav_row.append(&path_entry);
    nav_row.append(&go_btn);
    nav_row.append(&refresh_btn);
    container.append(&nav_row);

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
    let status_label = Label::new(Some("Ready"));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let current_path = Rc::new(RefCell::new("/".to_string()));

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
        load_directory(&list_box, &status_label, "/").await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    list_box.connect_row_activated(glib::clone!(
        #[weak] path_entry, #[weak] status_label, #[weak] spinner,
        #[strong] current_path,
        move |lb, row| {
        let name = row.widget_name();
        if name.is_empty() || !name.starts_with("dir:") {
            return;
        }
        let dir_name = &name[4..];
        let base = current_path.borrow().clone();
        let new_path = if dir_name == ".." {
            Path::new(&base).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| "/".to_string())
        } else if base == "/" {
            format!("/{}", dir_name)
        } else {
            format!("{}/{}", base, dir_name)
        };

        *current_path.borrow_mut() = new_path.clone();
        path_entry.set_text(&new_path);

        let ctx = glib::MainContext::default();
        spinner.set_visible(true);
        spinner.start();
        let list_box = lb.clone();
        ctx.spawn_local(glib::clone!(#[weak] status_label, #[weak] spinner, async move {
            load_directory(&list_box, &status_label, &new_path).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let go_ctx = ctx.clone();
    let cp_go = current_path.clone();
    go_btn.connect_clicked(glib::clone!(#[weak] path_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let path = path_entry.text().trim().to_string();
        if path.is_empty() { return; }
        *cp_go.borrow_mut() = path.clone();
        let ctx = go_ctx.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_directory(&list_box, &status_label, &path).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    path_entry.connect_activate(glib::clone!(#[weak] go_btn, move |_| {
        go_btn.activate();
    }));

    let refresh_ctx = ctx.clone();
    let cp_refresh = current_path.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let path = cp_refresh.borrow().clone();
        let ctx = refresh_ctx.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_directory(&list_box, &status_label, &path).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let back_ctx = ctx.clone();
    let cp_back = current_path.clone();
    back_btn.connect_clicked(glib::clone!(#[weak] path_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let current = cp_back.borrow().clone();
        let p = Path::new(&current);
        if let Some(parent) = p.parent() {
            let parent_str = parent.to_string_lossy().to_string();
            let path = if parent_str.is_empty() { "/".to_string() } else { parent_str };
            *cp_back.borrow_mut() = path.clone();
            path_entry.set_text(&path);
            let ctx = back_ctx.clone();
            spinner.set_visible(true);
            spinner.start();
            ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
                load_directory(&list_box, &status_label, &path).await;
                spinner.stop();
                spinner.set_visible(false);
            }));
        }
    }));

    container
}

async fn load_directory(list_box: &ListBox, status_label: &Label, path: &str) {
    status_label.set_text(&format!("Listing {}...", path));
    let escaped = path.replace('\'', "'\\''");
    let result = run_shell(&format!("ls -la --time-style=+%Y-%m-%d' '%H:%M:%S '{}' 2>&1 | tail -n +2", escaped)).await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        if let Some(row) = build_file_row(line) {
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("{} entries in {}", count, path));
}

fn build_file_row(line: &str) -> Option<ListBoxRow> {
    let fields: Vec<&str> = line.split_whitespace().collect();
    if fields.len() < 8 {
        return None;
    }

    let perms = fields[0];
    let size: u64 = fields[4].parse().unwrap_or(0);
    let date = fields[5];
    let time = fields[6];

    let name_start = line.splitn(8, char::is_whitespace).nth(7)?;
    let name_start = name_start.trim_start();
    if name_start == "." || name_start.is_empty() {
        return None;
    }

    let (name, symlink_target) = if let Some((n, t)) = name_start.split_once(" -> ") {
        (n, Some(t))
    } else {
        (name_start, None)
    };

    if name == "." {
        return None;
    }

    let is_dir = perms.starts_with('d');
    let is_link = perms.starts_with('l');
    let is_parent = name == "..";

    let icon = if is_parent {
        "\u{2b06}"
    } else if is_link {
        "\u{1f517}"
    } else if is_dir {
        "\u{1f4c1}"
    } else {
        "\u{1f4c4}"
    };

    let row = ListBoxRow::new();
    if is_dir || is_parent {
        row.set_widget_name(&format!("dir:{}", name));
        row.set_activatable(true);
    } else {
        row.set_activatable(false);
    }

    let row_box = Box::new(Orientation::Horizontal, 10);
    row_box.add_css_class("file-row");

    let icon_label = Label::new(Some(icon));
    icon_label.add_css_class("file-icon");
    row_box.append(&icon_label);

    let name_box = Box::new(Orientation::Vertical, 1);
    name_box.set_hexpand(true);

    let name_label = Label::new(Some(name));
    name_label.add_css_class("file-name");
    if is_dir {
        name_label.add_css_class("is-dir");
    }
    name_label.set_halign(Align::Start);
    name_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
    name_box.append(&name_label);

    if let Some(target) = symlink_target {
        let target_label = Label::new(Some(&format!("\u{2192} {}", target)));
        target_label.add_css_class("file-symlink-target");
        target_label.set_halign(Align::Start);
        target_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
        name_box.append(&target_label);
    }

    row_box.append(&name_box);

    let perms_label = Label::new(Some(perms));
    perms_label.add_css_class("file-perms");
    row_box.append(&perms_label);

    let size_label = Label::new(Some(&format_size(size, is_dir)));
    size_label.add_css_class("file-size");
    row_box.append(&size_label);

    let date_label = Label::new(Some(&format!("{} {}", date, time)));
    date_label.add_css_class("file-date");
    row_box.append(&date_label);

    row.set_child(Some(&row_box));
    Some(row)
}

fn format_size(bytes: u64, is_dir: bool) -> String {
    if is_dir {
        return "\u{2014}".to_string();
    }
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_idx = 0;
    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    if unit_idx == 0 {
        format!("{} {}", bytes, UNITS[0])
    } else {
        format!("{:.1} {}", size, UNITS[unit_idx])
    }
}
