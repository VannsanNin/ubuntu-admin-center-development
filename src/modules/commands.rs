use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};

const COMMAND_LIBRARY: &[(&str, &str, &str)] = &[
    ("apt", "Package Management", "apt install/remove/update/upgrade"),
    ("systemctl", "Service Management", "systemctl start/stop/restart/enable/disable"),
    ("journalctl", "Log Viewing", "journalctl -u <service> -n <lines>"),
    ("ufw", "Firewall", "ufw enable/disable/allow/deny/status"),
    ("useradd", "User Management", "useradd/usermod/userdel"),
    ("chmod", "Permissions", "chmod <mode> <file>"),
    ("chown", "Ownership", "chown <user>:<group> <file>"),
    ("tar", "Archiving", "tar -czf <archive> <files>"),
    ("rsync", "File Sync", "rsync -avz <src> <dst>"),
    ("ps", "Processes", "ps aux | grep <name>"),
    ("kill", "Process Control", "kill -<SIGNAL> <PID>"),
    ("df", "Disk Usage", "df -h"),
    ("du", "Disk Usage", "du -sh <path>"),
    ("ss", "Socket Stats", "ss -tlnp"),
    ("ip", "Networking", "ip addr/route/link"),
    ("curl", "HTTP", "curl <url>"),
    ("grep", "Search", "grep -r <pattern> <path>"),
    ("docker", "Containers", "docker ps/images/start/stop/run"),
];

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 0);

    let main_row = Box::new(Orientation::Horizontal, 0);
    main_row.set_vexpand(true);

    let sidebar_box = Box::new(Orientation::Vertical, 4);
    sidebar_box.set_size_request(260, -1);
    sidebar_box.add_css_class("sidebar-panel");

    let sidebar_header = Label::new(Some("Command Library"));
    sidebar_header.add_css_class("title-3");
    sidebar_header.set_halign(Align::Start);
    sidebar_header.set_margin_top(16);
    sidebar_header.set_margin_bottom(8);
    sidebar_box.append(&sidebar_header);

    let search_row = Box::new(Orientation::Horizontal, 0);
    search_row.add_css_class("linked");
    search_row.set_margin_start(8);
    search_row.set_margin_end(8);
    search_row.set_margin_bottom(8);
    let search_entry = Entry::builder().placeholder_text("Search commands...").build();
    search_entry.set_hexpand(true);
    let clear_btn = Button::from_icon_name("edit-clear-symbolic");
    search_row.append(&search_entry);
    search_row.append(&clear_btn);
    sidebar_box.append(&search_row);

    let list_box = ListBox::new();
    list_box.add_css_class("boxed-list");
    list_box.set_margin_start(8);
    list_box.set_margin_end(8);
    let list_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&list_box)
        .build();
    list_scroll.set_vexpand(true);
    sidebar_box.append(&list_scroll);

    let content_box = Box::new(Orientation::Vertical, 4);
    content_box.set_margin_top(24);
    content_box.set_margin_bottom(24);
    content_box.set_margin_start(28);
    content_box.set_margin_end(28);
    content_box.set_vexpand(true);

    let detail_empty = Label::new(Some("Select a command from the list to view its details"));
    detail_empty.add_css_class("detail-empty");
    detail_empty.set_halign(Align::Start);
    detail_empty.set_valign(Align::Start);
    content_box.append(&detail_empty);

    let detail_name = Label::new(None);
    detail_name.add_css_class("detail-cmd-name");
    detail_name.set_halign(Align::Start);
    detail_name.set_visible(false);
    content_box.append(&detail_name);

    let detail_category = Label::new(None);
    detail_category.add_css_class("detail-category-badge");
    detail_category.set_halign(Align::Start);
    detail_category.set_visible(false);
    content_box.append(&detail_category);

    let detail_description = Label::new(None);
    detail_description.add_css_class("detail-description");
    detail_description.set_halign(Align::Start);
    detail_description.set_wrap(true);
    detail_description.set_visible(false);
    content_box.append(&detail_description);

    let usage_title = Label::new(Some("Usage"));
    usage_title.add_css_class("usage-label");
    usage_title.set_halign(Align::Start);
    usage_title.set_visible(false);
    content_box.append(&usage_title);

    let usage_panel = Box::new(Orientation::Vertical, 4);
    usage_panel.add_css_class("terminal-panel");
    usage_panel.set_visible(false);
    let usage_text = Label::new(None);
    usage_text.add_css_class("terminal-text");
    usage_text.set_halign(Align::Start);
    usage_text.set_wrap(true);
    usage_text.set_xalign(0.0);
    usage_text.set_selectable(true);
    usage_panel.append(&usage_text);
    content_box.append(&usage_panel);

    main_row.append(&sidebar_box);
    main_row.append(&content_box);
    container.append(&main_row);

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    spinner.set_visible(false);
    let status_label = Label::new(Some(&format!("{} commands loaded", COMMAND_LIBRARY.len())));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    for (cmd, category, desc) in COMMAND_LIBRARY {
        let row = ListBoxRow::new();
        row.set_widget_name(cmd);
        let row_box = Box::new(Orientation::Vertical, 2);
        row_box.add_css_class("cmd-row");

        let cmd_label = Label::new(Some(cmd));
        cmd_label.add_css_class("cmd-name");
        cmd_label.set_halign(Align::Start);
        row_box.append(&cmd_label);

        let cat_label = Label::new(Some(category));
        cat_label.add_css_class("cmd-category");
        cat_label.set_halign(Align::Start);
        row_box.append(&cat_label);
        row.set_child(Some(&row_box));

        let _ = desc;
        list_box.append(&row);
    }

    list_box.connect_row_activated(glib::clone!(
        #[weak] detail_empty, #[weak] detail_name, #[weak] detail_category,
        #[weak] detail_description, #[weak] usage_title, #[weak] usage_panel, #[weak] usage_text,
        move |_, row| {
        let cmd_name = row.widget_name();
        if let Some((cmd, category, desc)) = COMMAND_LIBRARY.iter().find(|(c, _, _)| *c == cmd_name) {
            detail_empty.set_visible(false);
            detail_name.set_text(cmd);
            detail_name.set_visible(true);
            detail_category.set_text(category);
            detail_category.set_visible(true);
            detail_description.set_text(desc);
            detail_description.set_visible(true);
            usage_title.set_visible(true);
            usage_panel.set_visible(true);
            usage_text.set_text(&format!("$ {}", desc));
        }
    }));

    search_entry.connect_changed(glib::clone!(#[weak] list_box, #[weak] search_entry, move |_| {
        let filter = search_entry.text().to_lowercase();
        let mut child = list_box.first_child();
        while let Some(widget) = child {
            if let Some(row) = widget.downcast_ref::<ListBoxRow>() {
                let cmd_matches = row.widget_name().to_lowercase().contains(&filter);
                widget.set_visible(filter.is_empty() || cmd_matches);
            }
            child = widget.next_sibling();
        }
    }));

    clear_btn.connect_clicked(glib::clone!(#[weak] search_entry, move |_| {
        search_entry.set_text("");
    }));

    container
}
