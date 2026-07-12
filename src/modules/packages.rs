use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::{run_shell, sanitize_input};

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Package Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let search_row = Box::new(Orientation::Horizontal, 0);
    search_row.add_css_class("linked");
    search_row.add_css_class("search-row");
    let search_entry = Entry::builder().placeholder_text("Search packages...").build();
    search_entry.set_hexpand(true);
    let search_btn = Button::from_icon_name("system-search-symbolic");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    search_row.append(&search_entry);
    search_row.append(&search_btn);
    search_row.append(&refresh_btn);
    container.append(&search_row);

    let action_card = Box::new(Orientation::Horizontal, 8);
    action_card.add_css_class("quick-action-card");
    let pkg_entry = Entry::builder().placeholder_text("Package name").build();
    pkg_entry.set_hexpand(true);
    let install_btn = Button::with_label("Install");
    let remove_btn = Button::with_label("Remove");
    install_btn.add_css_class("suggested-action");
    remove_btn.add_css_class("destructive-action");
    action_card.append(&pkg_entry);
    action_card.append(&install_btn);
    action_card.append(&remove_btn);
    container.append(&action_card);

    let secondary_row = Box::new(Orientation::Horizontal, 8);
    secondary_row.add_css_class("secondary-action-row");
    let update_btn = Button::with_label("Update Lists");
    let upgrade_btn = Button::with_label("Upgrade All");
    secondary_row.append(&update_btn);
    secondary_row.append(&upgrade_btn);
    container.append(&secondary_row);

    let list_box = ListBox::new();
    list_box.add_css_class("boxed-list");
    let list_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&list_box)
        .build();
    list_scroll.set_vexpand(true);
    container.append(&list_scroll);

    let term_toggle_btn = Button::from_icon_name("go-down-symbolic");
    term_toggle_btn.set_tooltip_text(Some("Toggle terminal"));
    term_toggle_btn.set_halign(Align::Start);
    container.append(&term_toggle_btn);

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("terminal-panel");
    terminal.set_size_request(-1, 150);
    let term_label = Label::new(Some("$ Output will appear here..."));
    term_label.add_css_class("terminal-text");
    term_label.add_css_class("terminal-idle");
    term_label.set_halign(Align::Start);
    term_label.set_valign(Align::Start);
    term_label.set_wrap(true);
    term_label.set_xalign(0.0);
    let term_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&term_label)
        .build();
    term_scroll.set_vexpand(true);
    terminal.append(&term_scroll);
    container.append(&terminal);

    term_toggle_btn.connect_clicked(glib::clone!(#[weak] terminal, #[weak] term_toggle_btn, move |_| {
        let visible = !terminal.is_visible();
        terminal.set_visible(visible);
        term_toggle_btn.set_icon_name(if visible { "go-up-symbolic" } else { "go-down-symbolic" });
    }));

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
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
        load_packages(&list_box, &term_label, &status_label).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_search = ctx.clone();
    search_btn.connect_clicked(glib::clone!(#[weak] search_entry, #[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let query = sanitize_input(&search_entry.text());
        if query.is_empty() { return; }
        let ctx = ctx_search.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.remove_css_class("terminal-idle");
            term_label.set_text(&format!("$ Searching for '{}'...", query));
            status_label.set_text(&format!("Searching for '{}'...", query));
            let result = run_shell(&format!("apt-cache search '{}' 2>/dev/null | head -200", query)).await;
            while let Some(child) = list_box.first_child() {
                list_box.remove(&child);
            }
            let mut count = 0;
            for line in result.stdout.lines() {
                if let Some((name, desc)) = line.split_once(" - ") {
                    let row = build_search_row(name.trim(), desc.trim());
                    list_box.append(&row);
                    count += 1;
                }
            }
            term_label.set_text(&format!("$ Found {} packages matching '{}'", count, query));
            status_label.set_text(&format!("Found {} packages", count));
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            load_packages(&list_box, &term_label, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_update = ctx.clone();
    update_btn.connect_clicked(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_update.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Updating package lists...");
        ctx.spawn_local(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.remove_css_class("terminal-idle");
            term_label.set_text("$ sudo apt update");
            let result = run_shell("sudo apt update 2>&1").await;
            term_label.set_text(&format!("$ sudo apt update\n{}\n{}", result.stdout, result.stderr));
            status_label.set_text("Update complete");
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_upgrade = ctx.clone();
    upgrade_btn.connect_clicked(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_upgrade.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Upgrading packages...");
        ctx.spawn_local(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.remove_css_class("terminal-idle");
            term_label.set_text("$ sudo apt upgrade -y");
            let result = run_shell("sudo apt upgrade -y 2>&1").await;
            term_label.set_text(&format!("$ sudo apt upgrade -y\n{}\n{}", result.stdout, result.stderr));
            status_label.set_text("Upgrade complete");
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_install = ctx.clone();
    install_btn.connect_clicked(glib::clone!(#[weak] pkg_entry, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let pkg = sanitize_input(&pkg_entry.text());
        if pkg.is_empty() { return; }
        let ctx = ctx_install.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Installing {}...", pkg));
        ctx.spawn_local(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.remove_css_class("terminal-idle");
            term_label.set_text(&format!("$ sudo apt install -y {}", pkg));
            let result = run_shell(&format!("sudo apt install -y {}", pkg)).await;
            term_label.set_text(&format!("$ sudo apt install -y {}\n{}\n{}", pkg, result.stdout, result.stderr));
            status_label.set_text(&format!("Install of {} complete", pkg));
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_remove = ctx.clone();
    remove_btn.connect_clicked(glib::clone!(#[weak] pkg_entry, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let pkg = sanitize_input(&pkg_entry.text());
        if pkg.is_empty() { return; }
        let ctx = ctx_remove.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Removing {}...", pkg));
        ctx.spawn_local(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.remove_css_class("terminal-idle");
            term_label.set_text(&format!("$ sudo apt remove -y {}", pkg));
            let result = run_shell(&format!("sudo apt remove -y {}", pkg)).await;
            term_label.set_text(&format!("$ sudo apt remove -y {}\n{}\n{}", pkg, result.stdout, result.stderr));
            status_label.set_text(&format!("Removal of {} complete", pkg));
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_packages(list_box: &ListBox, term_label: &Label, status_label: &Label) {
    term_label.set_text("$ Loading installed packages...");
    status_label.set_text("Loading installed packages...");
    let result = run_shell(r#"dpkg-query -W -f='${Package}\t${Version}\t${Description}\n' 2>/dev/null | head -500"#).await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines().take(500) {
        if let Some(row) = build_installed_row(line) {
            list_box.append(&row);
            count += 1;
        }
    }
    term_label.set_text(&format!("$ Loaded {} packages", count));
    status_label.set_text(&format!("Loaded {} packages", count));
}

fn build_installed_row(line: &str) -> Option<ListBoxRow> {
    let parts: Vec<&str> = line.splitn(3, '\t').collect();
    if parts.len() < 2 {
        return None;
    }
    Some(build_row(parts[0], Some(parts[1]), parts.get(2).copied()))
}

fn build_search_row(name: &str, desc: &str) -> ListBoxRow {
    build_row(name, None, Some(desc))
}

fn build_row(name: &str, version: Option<&str>, desc: Option<&str>) -> ListBoxRow {
    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Vertical, 2);
    row_box.add_css_class("package-row");

    let name_label = Label::new(Some(name));
    name_label.add_css_class("package-name");
    name_label.set_halign(Align::Start);
    row_box.append(&name_label);

    if let Some(v) = version {
        let meta_label = Label::new(Some(v));
        meta_label.add_css_class("package-meta");
        meta_label.set_halign(Align::Start);
        row_box.append(&meta_label);
    }

    if let Some(d) = desc {
        if !d.is_empty() {
            let desc_label = Label::new(Some(d));
            desc_label.add_css_class("package-desc");
            desc_label.set_halign(Align::Start);
            desc_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
            row_box.append(&desc_label);
        }
    }

    row.set_child(Some(&row_box));
    row
}
