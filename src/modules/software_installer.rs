use std::cell::Cell;
use std::rc::Rc;
use gtk4::prelude::*;
use gtk4::{glib, Label, Button, CheckButton, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::run_shell;

const CATEGORIES: &[(&str, &[&str])] = &[
    ("Development", &["build-essential", "git", "python3", "python3-pip", "nodejs", "npm", "docker.io"]),
    ("Multimedia", &["vlc", "gimp", "inkscape", "audacity", "blender"]),
    ("Office", &["libreoffice", "onlyoffice-desktopeditors", "gimp", "thunderbird"]),
    ("Networking", &["curl", "wget", "net-tools", "openssh-server", "ufw", "nmap"]),
    ("Security", &["ufw", "clamav", "rkhunter", "chkrootkit", "fail2ban", "auditd"]),
];

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Software Installer"));
    header.add_css_class("title-1");
    container.append(&header);

    let mode_row = Box::new(Orientation::Horizontal, 0);
    mode_row.add_css_class("linked");
    let install_mode = Button::with_label("Install Mode");
    install_mode.add_css_class("mode-toggle");
    install_mode.add_css_class("active-install");
    let remove_mode = Button::with_label("Remove Mode");
    remove_mode.add_css_class("mode-toggle");
    mode_row.append(&install_mode);
    mode_row.append(&remove_mode);
    container.append(&mode_row);

    let action_row = Box::new(Orientation::Horizontal, 0);
    action_row.add_css_class("linked");
    let select_all_btn = Button::with_label("Select All");
    let clear_btn = Button::with_label("Clear");
    let execute_btn = Button::with_label("Execute");
    execute_btn.add_css_class("suggested-action");
    action_row.append(&select_all_btn);
    action_row.append(&clear_btn);
    action_row.append(&execute_btn);
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

    let term_toggle_btn = Button::from_icon_name("go-down-symbolic");
    term_toggle_btn.set_tooltip_text(Some("Toggle terminal"));
    term_toggle_btn.set_halign(Align::Start);
    container.append(&term_toggle_btn);

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("terminal-panel");
    terminal.set_size_request(-1, 150);
    let term_label = Label::new(Some("$ Ready — select packages and press Execute"));
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
    let status_label = Label::new(Some(""));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let is_install_mode = Rc::new(Cell::new(true));

    let ctx = glib::MainContext::default();
    spinner.start();
    {
        let list_box = list_box.clone();
        let spinner = spinner.clone();
        ctx.spawn_local(async move {
            for (cat_name, pkgs) in CATEGORIES {
                let cat_label = Label::new(Some(&format!("<b>{}</b>", cat_name)));
                cat_label.set_use_markup(true);
                cat_label.set_halign(Align::Start);
                cat_label.set_margin_top(6);
                cat_label.set_margin_bottom(6);
                cat_label.set_margin_start(12);
                let header_row = ListBoxRow::new();
                header_row.set_child(Some(&cat_label));
                header_row.add_css_class("category-header");
                header_row.set_selectable(false);
                header_row.set_activatable(false);
                list_box.append(&header_row);

                for pkg in *pkgs {
                    let row = ListBoxRow::new();
                    row.add_css_class("package-check-row");
                    let check = CheckButton::with_label(pkg);
                    check.set_halign(Align::Start);
                    row.set_child(Some(&check));
                    list_box.append(&row);
                }
            }
            spinner.stop();
            spinner.set_visible(false);
        });
    }

    let ctx2 = ctx.clone();

    let im_install = is_install_mode.clone();
    install_mode.connect_clicked(glib::clone!(#[weak] remove_mode, move |btn| {
        im_install.set(true);
        btn.add_css_class("active-install");
        remove_mode.remove_css_class("active-remove");
    }));

    let im_remove = is_install_mode.clone();
    remove_mode.connect_clicked(glib::clone!(#[weak] install_mode, move |btn| {
        im_remove.set(false);
        btn.add_css_class("active-remove");
        install_mode.remove_css_class("active-install");
    }));

    execute_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx2.clone();
        let is_install_mode = is_install_mode.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            let mut selected = Vec::new();
            let mut child = list_box.first_child();
            while let Some(widget) = child {
                if let Some(row) = widget.downcast_ref::<ListBoxRow>() {
                    if let Some(check) = row.child().and_downcast::<CheckButton>() {
                        if check.is_active() {
                            selected.push(check.label().unwrap_or_default());
                        }
                    }
                }
                child = widget.next_sibling();
            }

            if selected.is_empty() {
                term_label.set_text("$ No packages selected.");
                spinner.stop();
                spinner.set_visible(false);
                return;
            }

            term_label.remove_css_class("terminal-idle");
            let action = if is_install_mode.get() { "install" } else { "remove" };
            status_label.set_text(&format!("Running {} on {} packages...", action, selected.len()));
            let cmd = format!("sudo apt-get {} -y {}", action, selected.join(" "));
            term_label.set_text(&format!("$ {}", cmd));
            let result = run_shell(&cmd).await;
            term_label.set_text(&format!("$ {}\n{}\n{}", cmd, result.stdout, result.stderr));
            status_label.set_text(&format!("{} complete", action));
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    select_all_btn.connect_clicked(glib::clone!(#[weak] list_box, move |_| {
        let mut child = list_box.first_child();
        while let Some(widget) = child {
            if let Some(row) = widget.downcast_ref::<ListBoxRow>() {
                if let Some(check) = row.child().and_downcast::<CheckButton>() {
                    check.set_active(true);
                }
            }
            child = widget.next_sibling();
        }
    }));

    clear_btn.connect_clicked(glib::clone!(#[weak] list_box, move |_| {
        let mut child = list_box.first_child();
        while let Some(widget) = child {
            if let Some(row) = widget.downcast_ref::<ListBoxRow>() {
                if let Some(check) = row.child().and_downcast::<CheckButton>() {
                    check.set_active(false);
                }
            }
            child = widget.next_sibling();
        }
    }));

    container
}
