use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::{run_shell, sanitize_input};

const CRITICAL_PACKAGES: &[&str] = &[
    "apt", "dpkg", "systemd", "linux-image", "linux-headers",
    "grub", "grub-pc", "grub-efi", "shim", "openssh-server",
    "openssh-client", "network-manager", "ubuntu-minimal", "ubuntu-standard",
];

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Installed Apps"));
    header.add_css_class("title-1");
    container.append(&header);

    let search_row = Box::new(Orientation::Horizontal, 0);
    search_row.add_css_class("linked");
    search_row.add_css_class("search-row");
    let search_entry = Entry::builder().placeholder_text("Search installed apps...").build();
    search_entry.set_hexpand(true);
    let search_btn = Button::from_icon_name("system-search-symbolic");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    search_row.append(&search_entry);
    search_row.append(&search_btn);
    container.append(&search_row);

    let refresh_row = Box::new(Orientation::Horizontal, 8);
    refresh_row.set_halign(Align::End);
    refresh_row.append(&refresh_btn);
    container.append(&refresh_row);

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
    let status_label = Label::new(Some("Loading packages..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
        load_packages(&list_box, &status_label).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_search = ctx.clone();
    search_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] search_entry, #[weak] spinner, move |_| {
        let query = sanitize_input(&search_entry.text()).to_lowercase();
        let ctx = ctx_search.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            if query.is_empty() {
                load_packages(&list_box, &status_label).await;
                spinner.stop();
                spinner.set_visible(false);
                return;
            }
            status_label.set_text(&format!("Searching for '{}'...", query));
            let result = run_shell(r#"dpkg-query -W -f='${Package}\t${Version}\t${Description}\n' 2>/dev/null"#).await;
            while let Some(child) = list_box.first_child() {
                list_box.remove(&child);
            }
            let mut count = 0;
            for line in result.stdout.lines() {
                if line.to_lowercase().contains(&query) {
                    if let Some(row) = build_package_row(line) {
                        list_box.append(&row);
                        count += 1;
                    }
                }
            }
            status_label.set_text(&format!("Found {} matching packages", count));
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
            load_packages(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_packages(list_box: &ListBox, status_label: &Label) {
    status_label.set_text("Loading installed packages...");
    let result = run_shell(r#"dpkg-query -W -f='${Package}\t${Version}\t${Description}\n' 2>/dev/null | head -500"#).await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines().take(500) {
        if let Some(row) = build_package_row(line) {
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("Loaded {} installed packages", count));
}

fn build_package_row(line: &str) -> Option<ListBoxRow> {
    let parts: Vec<&str> = line.splitn(3, '\t').collect();
    if parts.len() < 2 {
        return None;
    }

    let pkg_name = parts[0].to_string();
    let version = parts.get(1).unwrap_or(&"").to_string();
    let desc = parts.get(2).unwrap_or(&"").to_string();
    let is_critical = CRITICAL_PACKAGES.iter().any(|c| pkg_name.starts_with(c));

    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Horizontal, 12);
    row_box.add_css_class("package-row");

    let text_box = Box::new(Orientation::Vertical, 2);
    text_box.set_hexpand(true);

    let name_row = Box::new(Orientation::Horizontal, 8);
    let name_label = Label::new(Some(&pkg_name));
    name_label.add_css_class("package-name");
    name_label.set_halign(Align::Start);
    name_row.append(&name_label);

    if is_critical {
        let badge = Label::new(Some("SYSTEM"));
        badge.add_css_class("badge-critical");
        name_row.append(&badge);
    }
    text_box.append(&name_row);

    let meta_label = Label::new(Some(&version));
    meta_label.add_css_class("package-meta");
    meta_label.set_halign(Align::Start);
    text_box.append(&meta_label);

    if !desc.is_empty() {
        let desc_label = Label::new(Some(&desc));
        desc_label.add_css_class("package-desc");
        desc_label.set_halign(Align::Start);
        desc_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
        text_box.append(&desc_label);
    }

    row_box.append(&text_box);

    if !is_critical {
        let uninstall_btn = Button::with_label("Uninstall");
        uninstall_btn.add_css_class("destructive-action");
        uninstall_btn.set_valign(Align::Center);
        let ctx = glib::MainContext::default();
        let pkg = pkg_name.clone();
        uninstall_btn.connect_clicked(move |btn| {
            let ctx = ctx.clone();
            let pkg = pkg.clone();
            btn.set_sensitive(false);
            ctx.spawn_local(async move {
                let _ = run_shell(&format!("sudo apt remove -y {}", pkg)).await;
            });
        });
        row_box.append(&uninstall_btn);
    }

    row.set_child(Some(&row_box));
    Some(row)
}
