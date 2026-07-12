use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::{run_shell, sanitize_input};

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("User Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let form_card = Box::new(Orientation::Horizontal, 8);
    form_card.add_css_class("user-form-card");
    let username_entry = Entry::builder().placeholder_text("Username").build();
    username_entry.set_hexpand(true);
    let password_entry = Entry::builder().placeholder_text("Password (optional)").build();
    password_entry.set_visibility(false);
    password_entry.set_hexpand(true);
    let group_entry = Entry::builder().placeholder_text("Group (optional)").build();
    group_entry.set_hexpand(true);
    form_card.append(&username_entry);
    form_card.append(&password_entry);
    form_card.append(&group_entry);
    container.append(&form_card);

    let action_row = Box::new(Orientation::Horizontal, 0);
    action_row.add_css_class("linked");
    let create_btn = Button::with_label("Create");
    create_btn.add_css_class("suggested-action");
    let lock_btn = Button::with_label("Lock");
    let unlock_btn = Button::with_label("Unlock");
    let delete_btn = Button::with_label("Delete");
    delete_btn.add_css_class("destructive-action");
    action_row.append(&create_btn);
    action_row.append(&lock_btn);
    action_row.append(&unlock_btn);
    action_row.append(&delete_btn);
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
    let status_label = Label::new(Some("Loading users..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    list_box.connect_row_activated(glib::clone!(#[weak] username_entry, move |_, row| {
        let uname = row.widget_name();
        if !uname.is_empty() {
            username_entry.set_text(&uname);
        }
    }));

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
        load_users(&list_box, &status_label).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_create = ctx.clone();
    create_btn.connect_clicked(glib::clone!(#[weak] username_entry, #[weak] password_entry, #[weak] group_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let user = sanitize_input(&username_entry.text());
        let pass = password_entry.text();
        let group = sanitize_input(&group_entry.text());
        if user.is_empty() { return; }
        let ctx = ctx_create.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Creating user {}...", user));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            let r = run_shell(&format!("sudo useradd -m {}", user)).await;
            if !pass.is_empty() {
                run_shell(&format!("echo '{}:{}' | sudo chpasswd", user, pass)).await;
            }
            if !group.is_empty() {
                run_shell(&format!("sudo usermod -aG {} {}", group, user)).await;
            }
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_users(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_lock = ctx.clone();
    lock_btn.connect_clicked(glib::clone!(#[weak] username_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let user = sanitize_input(&username_entry.text());
        if user.is_empty() { return; }
        let ctx = ctx_lock.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Locking {}...", user));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            let r = run_shell(&format!("sudo usermod -L {}", user)).await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_users(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_unlock = ctx.clone();
    unlock_btn.connect_clicked(glib::clone!(#[weak] username_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let user = sanitize_input(&username_entry.text());
        if user.is_empty() { return; }
        let ctx = ctx_unlock.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Unlocking {}...", user));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            let r = run_shell(&format!("sudo usermod -U {}", user)).await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_users(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_delete = ctx.clone();
    delete_btn.connect_clicked(glib::clone!(#[weak] username_entry, #[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let user = sanitize_input(&username_entry.text());
        if user.is_empty() { return; }
        let ctx = ctx_delete.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Deleting {}...", user));
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            let r = run_shell(&format!("sudo userdel -r {}", user)).await;
            status_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            load_users(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_users(list_box: &ListBox, status_label: &Label) {
    status_label.set_text("Loading users...");
    let result = run_shell(r#"getent passwd | cut -d: -f1,3,5,6,7 | head -100"#).await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        if let Some(row) = build_user_row(line) {
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("Loaded {} users", count));
}

fn build_user_row(line: &str) -> Option<ListBoxRow> {
    let parts: Vec<&str> = line.split(':').collect();
    if parts.is_empty() {
        return None;
    }

    let name = parts[0];
    let uid: u32 = parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(0);
    let gecos = parts.get(2).copied().unwrap_or("");
    let home = parts.get(3).copied().unwrap_or("");
    let shell = parts.get(4).copied().unwrap_or("");
    let is_system = uid < 1000;
    let is_locked = shell.contains("nologin") || shell.contains("false");

    let row = ListBoxRow::new();
    row.set_widget_name(name);

    let row_box = Box::new(Orientation::Horizontal, 12);
    row_box.add_css_class("user-row");

    let text_box = Box::new(Orientation::Vertical, 2);
    text_box.set_hexpand(true);

    let name_row = Box::new(Orientation::Horizontal, 8);
    let name_label = Label::new(Some(name));
    name_label.add_css_class("user-name");
    name_label.set_halign(Align::Start);
    name_row.append(&name_label);

    let uid_label = Label::new(Some(&format!("UID {}", uid)));
    uid_label.add_css_class("user-uid");
    name_row.append(&uid_label);

    if is_system {
        let badge = Label::new(Some("System"));
        badge.add_css_class("badge-system");
        name_row.append(&badge);
    }
    if is_locked {
        let badge = Label::new(Some("No Login"));
        badge.add_css_class("badge-locked");
        name_row.append(&badge);
    }
    text_box.append(&name_row);

    let meta_text = if !gecos.is_empty() {
        format!("{} · {}", gecos, home)
    } else {
        home.to_string()
    };
    let meta_label = Label::new(Some(&meta_text));
    meta_label.add_css_class("user-meta");
    meta_label.set_halign(Align::Start);
    meta_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
    text_box.append(&meta_label);

    row_box.append(&text_box);
    row.set_child(Some(&row_box));
    Some(row)
}
