#![allow(deprecated)]
use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Stack, StackSwitcher, ComboBoxText, Spinner};
use crate::system::commands::{run_shell, sanitize_input};

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("SSH Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let stack = Stack::new();
    let switcher = StackSwitcher::new();
    switcher.set_stack(Some(&stack));
    container.append(&switcher);

    let hosts_box = Box::new(Orientation::Vertical, 8);
    let add_row = Box::new(Orientation::Horizontal, 0);
    add_row.add_css_class("linked");
    let host_entry = Entry::builder().placeholder_text("Hostname/IP").build();
    let port_entry = Entry::builder().placeholder_text("Port").build();
    port_entry.set_text("22");
    let user_entry = Entry::builder().placeholder_text("Username").build();
    let add_btn = Button::with_label("Connect");
    add_btn.add_css_class("suggested-action");
    add_row.append(&host_entry);
    add_row.append(&port_entry);
    add_row.append(&user_entry);
    add_row.append(&add_btn);
    hosts_box.append(&add_row);

    let host_list = ListBox::new();
    host_list.add_css_class("boxed-list");
    let host_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&host_list)
        .build();
    host_scroll.set_vexpand(true);
    hosts_box.append(&host_scroll);
    stack.add_titled(&hosts_box, Some("hosts"), "Hosts");

    let keys_box = Box::new(Orientation::Vertical, 8);
    let key_gen_row = Box::new(Orientation::Horizontal, 0);
    key_gen_row.add_css_class("linked");
    let key_name_entry = Entry::builder().placeholder_text("Key name (e.g., id_ed25519)").build();
    let key_type_combo: ComboBoxText = ComboBoxText::new();
    key_type_combo.append_text("ed25519");
    key_type_combo.append_text("rsa");
    key_type_combo.append_text("ecdsa");
    key_type_combo.set_active(Some(0));
    let gen_btn = Button::with_label("Generate Key");
    gen_btn.add_css_class("suggested-action");
    key_gen_row.append(&key_name_entry);
    key_gen_row.append(&key_type_combo);
    key_gen_row.append(&gen_btn);
    keys_box.append(&key_gen_row);

    let key_list = ListBox::new();
    key_list.add_css_class("boxed-list");
    let key_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&key_list)
        .build();
    key_scroll.set_vexpand(true);
    keys_box.append(&key_scroll);
    stack.add_titled(&keys_box, Some("keys"), "Keys");

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("card");
    terminal.set_vexpand(true);
    terminal.set_size_request(-1, 200);
    let term_label = Label::new(Some("Enter host details to connect"));
    term_label.set_halign(Align::Start);
    term_label.set_valign(Align::Start);
    terminal.append(&term_label);
    container.append(&terminal);

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
    ctx.spawn_local(glib::clone!(#[weak] host_list, #[weak] key_list, #[weak] status_label, #[weak] spinner, async move {
        status_label.set_text("Loading SSH config & keys...");
        load_ssh_config(&host_list).await;
        load_ssh_keys(&key_list).await;
        spinner.stop();
        spinner.set_visible(false);
        status_label.set_text("Ready");
    }));

    let add_ctx = ctx.clone();
    add_btn.connect_clicked(glib::clone!(#[weak] host_entry, #[weak] port_entry, #[weak] user_entry, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let host = sanitize_input(&host_entry.text());
        let port = sanitize_input(&port_entry.text());
        let user = sanitize_input(&user_entry.text());
        if host.is_empty() || user.is_empty() { return; }
        let ctx = add_ctx.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Connecting to {}@{}...", user, host));
        ctx.spawn_local(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.set_text(&format!("Connecting to {}@{}:{}...", user, host, port));
            let r = run_shell(&format!("ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p {} {}@{} 'echo Connected' 2>&1", port, user, host)).await;
            term_label.set_text(&format!("{}\n{}", r.stdout, r.stderr));
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Connection attempt complete");
        }));
    }));

    let gen_ctx = ctx.clone();
    gen_btn.connect_clicked(glib::clone!(#[weak] key_name_entry, #[weak] key_type_combo, #[weak] key_list, #[weak] status_label, #[weak] spinner, move |_| {
        let name = sanitize_input(&key_name_entry.text());
        let ktype = key_type_combo.active_text().unwrap_or_else(|| glib::GString::from("ed25519"));
        if name.is_empty() { return; }
        let ctx = gen_ctx.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Generating {} key...", ktype));
        ctx.spawn_local(glib::clone!(#[weak] key_list, #[weak] status_label, #[weak] spinner, async move {
            let key_type_flag = if ktype == "rsa" { "-t rsa -b 4096" } else if ktype == "ecdsa" { "-t ecdsa -b 256" } else { "-t ed25519" };
            let cmd = format!("ssh-keygen {} -f ~/.ssh/{} -N \"\" -C \"ubuntu-admin-center\" 2>&1", key_type_flag, name);
            run_shell(&cmd).await;
            load_ssh_keys(&key_list).await;
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Key generated");
        }));
    }));

    container
}

async fn load_ssh_config(list_box: &ListBox) {
    let result = run_shell("cat ~/.ssh/config 2>/dev/null | grep -i '^Host ' | awk '{print $2}'").await;
    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }
    for line in result.stdout.lines() {
        let row = ListBoxRow::new();
        let label = Label::new(Some(line));
        label.set_halign(Align::Start);
        row.set_child(Some(&label));
        list_box.append(&row);
    }
}

async fn load_ssh_keys(list_box: &ListBox) {
    let result = run_shell("ls -1 ~/.ssh/ 2>/dev/null | grep -v '.pub$' | grep -v 'known_hosts' | grep -v 'config' | grep -v 'authorized_keys'").await;
    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }
    for line in result.stdout.lines() {
        let row = ListBoxRow::new();
        let label = Label::new(Some(line));
        label.set_halign(Align::Start);
        row.set_child(Some(&label));
        list_box.append(&row);
    }
}
