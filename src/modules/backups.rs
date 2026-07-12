#![allow(deprecated)]
use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, Align, CheckButton, ComboBoxText, Spinner};
use crate::system::commands::{run_shell, sanitize_path};

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Backup Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let create_row = Box::new(Orientation::Horizontal, 0);
    create_row.add_css_class("linked");
    let name_entry = Entry::builder().placeholder_text("Backup name").build();
    let source_entry = Entry::builder().placeholder_text("Source path").build();
    source_entry.set_hexpand(true);
    let dest_entry = Entry::builder().placeholder_text("Destination path").build();
    dest_entry.set_hexpand(true);
    let type_combo: ComboBoxText = ComboBoxText::new();
    type_combo.append_text("folder");
    type_combo.append_text("postgres");
    type_combo.append_text("sqlite");
    type_combo.set_active(Some(0));
    create_row.append(&name_entry);
    create_row.append(&source_entry);
    create_row.append(&dest_entry);
    create_row.append(&type_combo);
    container.append(&create_row);

    let opt_row = Box::new(Orientation::Horizontal, 12);
    let compression_check = CheckButton::with_label("Compress (gzip)");
    compression_check.set_active(true);
    let encrypt_check = CheckButton::with_label("Encrypt (AES-256)");
    let pass_entry = Entry::builder().placeholder_text("Encryption passphrase").build();
    let create_btn = Button::with_label("Create Backup");
    create_btn.add_css_class("suggested-action");
    opt_row.append(&compression_check);
    opt_row.append(&encrypt_check);
    opt_row.append(&pass_entry);
    opt_row.append(&create_btn);
    container.append(&opt_row);

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

    let ctx = glib::MainContext::default();

    create_btn.connect_clicked(glib::clone!(#[weak] name_entry, #[weak] source_entry, #[weak] dest_entry, #[weak] type_combo, #[weak] compression_check, #[weak] encrypt_check, #[weak] pass_entry, #[weak] status_label, #[weak] spinner, move |_| {
        let name = sanitize_path(&name_entry.text());
        let source = sanitize_path(&source_entry.text());
        let dest = sanitize_path(&dest_entry.text());
        let btype = type_combo.active_text().unwrap_or_else(|| glib::GString::from("folder"));
        let compress = compression_check.is_active();
        let encrypt = encrypt_check.is_active();
        let pass = pass_entry.text();

        if name.is_empty() || source.is_empty() || dest.is_empty() { return; }

        let ctx = ctx.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] status_label, #[weak] spinner, async move {
            status_label.set_text(&format!("Creating backup '{}'...", name));
            let cmd = if btype == "folder" {
                if compress {
                    format!("sudo tar -czf {}/{}.tar.gz {} 2>&1", dest, name, source)
                } else {
                    format!("sudo tar -cf {}/{}.tar {} 2>&1", dest, name, source)
                }
            } else if btype == "sqlite" {
                format!("sqlite3 '{}' '.dump' | gzip > {}/{}.sql.gz 2>&1", source, dest, name)
            } else {
                format!("PGPASSWORD='' pg_dump -h 127.0.0.1 -U postgres {} | gzip > {}/{}.sql.gz 2>&1", source, dest, name)
            };

            let result = run_shell(&cmd).await;
            let mut output = format!("{}\n{}", result.stdout, result.stderr);

            if encrypt && !pass.is_empty() && result.exit_code == 0 {
                let ext = if compress || btype != "folder" { ".tar.gz" } else { ".tar" };
                let enc_cmd = format!("gpg --batch --passphrase '{}' -c {}/{}{}", pass, dest, name, ext);
                let result = run_shell(&enc_cmd).await;
                output.push_str(&format!("\nEncryption: {} {}", result.stdout, result.stderr));
            }

            status_label.set_text(&output);
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}
