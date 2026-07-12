use gtk4::prelude::*;
use gtk4::{glib, Label, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner, Separator};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 16);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header_box = Box::new(Orientation::Horizontal, 0);

    let title_box = Box::new(Orientation::Vertical, 4);
    let header = Label::new(Some("System Logs"));
    header.add_css_class("title-1");
    header.set_halign(Align::Start);

    let subtitle = Label::new(Some("Recent authentication and authorization events"));
    subtitle.add_css_class("caption");
    subtitle.add_css_class("dim-label");
    subtitle.set_halign(Align::Start);

    title_box.append(&header);
    title_box.append(&subtitle);
    header_box.append(&title_box);

    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    refresh_btn.add_css_class("flat");
    refresh_btn.add_css_class("circular");
    refresh_btn.set_halign(Align::End);
    refresh_btn.set_hexpand(true);
    header_box.append(&refresh_btn);

    container.append(&header_box);

    let list_box = ListBox::new();
    list_box.add_css_class("boxed-list");
    list_box.set_selection_mode(gtk4::SelectionMode::None);

    let scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&list_box)
        .build();
    scroll.set_vexpand(true);
    container.append(&scroll);

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.set_halign(Align::Center);

    let spinner = Spinner::new();
    let status_label = Label::new(Some("Fetching logs..."));
    status_label.add_css_class("caption");
    status_label.add_css_class("dim-label");

    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
        load_audit_logs(&list_box, &status_label).await;
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_audit_logs(&list_box, &status_label).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    container
}

async fn load_audit_logs(list_box: &ListBox, status_label: &Label) {
    status_label.set_text("Updating logs...");

    let result = run_shell("cat /var/log/auth.log 2>/dev/null | tail -150").await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        if line.trim().is_empty() { continue; }

        let row = ListBoxRow::new();

        let row_content = Box::new(Orientation::Horizontal, 12);
        row_content.set_margin_top(8);
        row_content.set_margin_bottom(8);
        row_content.set_margin_start(12);
        row_content.set_margin_end(12);

        let (time_part, message_part) = if line.len() > 15 {
            (&line[..15], &line[15..])
        } else {
            ("", line)
        };

        let time_label = Label::new(Some(time_part));
        time_label.add_css_class("caption");
        time_label.add_css_class("dim-label");
        time_label.set_width_chars(16);
        time_label.set_halign(Align::Start);
        row_content.append(&time_label);

        let sep = Separator::new(Orientation::Vertical);
        sep.add_css_class("sidebar-separator");
        row_content.append(&sep);

        let badge = Label::new(None);
        badge.set_margin_start(4);
        badge.set_margin_end(4);

        if line.contains("fail") || line.contains("invalid") || line.contains("error") {
            badge.set_text("ERROR");
            badge.add_css_class("error");
            row_content.add_css_class("error-row");
        } else if line.contains("accepted") || line.contains("session opened") {
            badge.set_text(" OK ");
            badge.add_css_class("success");
        } else {
            badge.set_text("INFO");
            badge.add_css_class("dim-label");
        }
        badge.add_css_class("bold");
        row_content.append(&badge);

        let message_label = Label::new(Some(message_part.trim()));
        message_label.set_halign(Align::Start);
        message_label.set_hexpand(true);
        message_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
        message_label.add_css_class("body");
        message_label.add_css_class("monospace");

        row_content.append(&message_label);

        row.set_child(Some(&row_content));
        list_box.append(&row);
        count += 1;
    }

    status_label.set_text(&format!("Synced {} logs", count));
}
