use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Stack, StackSwitcher, Spinner};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Docker Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let action_row = Box::new(Orientation::Horizontal, 8);
    action_row.add_css_class("pull-form-card");
    let pull_entry = Entry::builder().placeholder_text("Image name (e.g., nginx:latest)").build();
    pull_entry.set_hexpand(true);
    let pull_btn = Button::with_label("Pull");
    pull_btn.add_css_class("suggested-action");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    action_row.append(&pull_entry);
    action_row.append(&pull_btn);
    action_row.append(&refresh_btn);
    container.append(&action_row);

    let stack = Stack::new();
    let switcher = StackSwitcher::new();
    switcher.set_stack(Some(&stack));
    switcher.set_halign(Align::Start);
    container.append(&switcher);

    let con_list = ListBox::new();
    con_list.add_css_class("boxed-list");
    let con_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&con_list)
        .build();
    con_scroll.set_vexpand(true);
    stack.add_titled(&con_scroll, Some("containers"), "Containers");

    let img_list = ListBox::new();
    img_list.add_css_class("boxed-list");
    let img_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&img_list)
        .build();
    img_scroll.set_vexpand(true);
    stack.add_titled(&img_scroll, Some("images"), "Images");

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("terminal-panel");
    terminal.set_size_request(-1, 160);
    let term_label = Label::new(Some("$ Output will appear here..."));
    term_label.add_css_class("terminal-text");
    term_label.add_css_class("terminal-idle");
    term_label.set_halign(Align::Start);
    term_label.set_valign(Align::Start);
    term_label.set_wrap(true);
    term_label.set_xalign(0.0);
    term_label.set_selectable(true);
    let term_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&term_label)
        .build();
    term_scroll.set_vexpand(true);
    terminal.append(&term_scroll);
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
    ctx.spawn_local(glib::clone!(#[weak] con_list, #[weak] img_list, #[weak] status_label, #[weak] term_label, #[weak] spinner, async move {
        status_label.set_text("Loading containers & images...");
        load_containers(&con_list, &status_label, &term_label).await;
        load_images(&img_list, &status_label, &term_label).await;
        spinner.stop();
        spinner.set_visible(false);
        status_label.set_text("Ready");
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] con_list, #[weak] img_list, #[weak] status_label, #[weak] term_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Refreshing...");
        ctx.spawn_local(glib::clone!(#[weak] con_list, #[weak] img_list, #[weak] status_label, #[weak] term_label, #[weak] spinner, async move {
            load_containers(&con_list, &status_label, &term_label).await;
            load_images(&img_list, &status_label, &term_label).await;
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Ready");
        }));
    }));

    let ctx_pull = ctx.clone();
    pull_btn.connect_clicked(glib::clone!(#[weak] pull_entry, #[weak] img_list, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let image = pull_entry.text().trim().to_string();
        if image.is_empty() { return; }
        let ctx = ctx_pull.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Pulling {}...", image));
        term_label.remove_css_class("terminal-idle");
        ctx.spawn_local(glib::clone!(#[weak] img_list, #[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.set_text(&format!("$ docker pull {}", image));
            let r = run_shell(&format!("docker pull {} 2>&1", image)).await;
            term_label.set_text(&format!("$ docker pull {}\n{}\n{}", image, r.stdout, r.stderr));
            load_images(&img_list, &status_label, &term_label).await;
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Ready");
        }));
    }));

    container
}

async fn load_containers(list_box: &ListBox, status_label: &Label, term_label: &Label) {
    let result = run_shell("docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.ID}}' 2>&1").await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 4 {
            let row = build_container_row(parts[0], parts[1], parts[2], status_label.clone(), term_label.clone());
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("{} container(s)", count));
}

fn build_container_row(name: &str, image: &str, status: &str, status_label: Label, term_label: Label) -> ListBoxRow {
    let name = name.to_string();
    let (dot_class, badge_text) = if status.starts_with("Up") {
        ("status-running", "Running")
    } else if status.to_lowercase().contains("restarting") {
        ("status-restarting", "Restarting")
    } else {
        ("status-exited", "Exited")
    };

    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Horizontal, 10);
    row_box.add_css_class("docker-row");

    let dot = Label::new(Some("\u{25cf}"));
    dot.add_css_class("container-status-dot");
    dot.add_css_class(dot_class);
    row_box.append(&dot);

    let text_box = Box::new(Orientation::Vertical, 2);
    text_box.set_hexpand(true);

    let name_row = Box::new(Orientation::Horizontal, 8);
    let name_label = Label::new(Some(&name));
    name_label.add_css_class("docker-name");
    name_label.set_halign(Align::Start);
    name_row.append(&name_label);

    let badge = Label::new(Some(badge_text));
    badge.add_css_class("container-status-badge");
    badge.add_css_class(dot_class);
    name_row.append(&badge);
    text_box.append(&name_row);

    let image_label = Label::new(Some(image));
    image_label.add_css_class("docker-image");
    image_label.set_halign(Align::Start);
    image_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
    text_box.append(&image_label);

    let status_meta = Label::new(Some(status));
    status_meta.add_css_class("docker-meta");
    status_meta.set_halign(Align::Start);
    text_box.append(&status_meta);

    row_box.append(&text_box);

    let start_btn = Button::with_label("Start");
    start_btn.connect_clicked(glib::clone!(#[strong] name, #[weak] status_label, move |_| {
        run_docker_action(name.clone(), "start", status_label);
    }));
    row_box.append(&start_btn);

    let stop_btn = Button::with_label("Stop");
    stop_btn.connect_clicked(glib::clone!(#[strong] name, #[weak] status_label, move |_| {
        run_docker_action(name.clone(), "stop", status_label);
    }));
    row_box.append(&stop_btn);

    let rm_btn = Button::with_label("Remove");
    rm_btn.add_css_class("destructive-action");
    rm_btn.connect_clicked(glib::clone!(#[strong] name, #[weak] status_label, move |btn| {
        btn.set_sensitive(false);
        run_docker_action(name.clone(), "rm -f", status_label);
    }));
    row_box.append(&rm_btn);

    let logs_btn = Button::with_label("Logs");
    logs_btn.connect_clicked(glib::clone!(#[strong] name, #[weak] term_label, move |_| {
        let ctx = glib::MainContext::default();
        let n = name.clone();
        term_label.remove_css_class("terminal-idle");
        term_label.set_text(&format!("$ docker logs --tail 50 {}", n));
        ctx.spawn_local(glib::clone!(#[weak] term_label, async move {
            let r = run_shell(&format!("docker logs --tail 50 {} 2>&1", n)).await;
            term_label.set_text(&format!("$ docker logs --tail 50 {}\n{}\n{}", n, r.stdout, r.stderr));
        }));
    }));
    row_box.append(&logs_btn);

    row.set_child(Some(&row_box));
    row
}

fn run_docker_action(name: String, action: &'static str, status_label: Label) {
    let ctx = glib::MainContext::default();
    status_label.set_text(&format!("Running docker {} {}...", action, name));
    ctx.spawn_local(async move {
        let r = run_shell(&format!("docker {} {} 2>&1", action, name)).await;
        if r.stderr.trim().is_empty() {
            status_label.set_text(&format!("docker {} {} succeeded", action, name));
        } else {
            status_label.set_text(&format!("docker {} {} failed: {}", action, name, r.stderr.trim()));
        }
    });
}

async fn load_images(list_box: &ListBox, status_label: &Label, _term_label: &Label) {
    let result = run_shell("docker images --format '{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.ID}}' 2>&1").await;

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            let row = build_image_row(parts[0], parts[1], parts.get(2).copied().unwrap_or(""));
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("{} image(s)", count));
}

fn build_image_row(repo: &str, tag: &str, size: &str) -> ListBoxRow {
    let full_name = format!("{}:{}", repo, tag);

    let row = ListBoxRow::new();
    let row_box = Box::new(Orientation::Horizontal, 10);
    row_box.add_css_class("docker-row");

    let text_box = Box::new(Orientation::Vertical, 2);
    text_box.set_hexpand(true);

    let name_label = Label::new(Some(&full_name));
    name_label.add_css_class("docker-name");
    name_label.set_halign(Align::Start);
    text_box.append(&name_label);

    let size_label = Label::new(Some(size));
    size_label.add_css_class("docker-meta");
    size_label.set_halign(Align::Start);
    text_box.append(&size_label);

    row_box.append(&text_box);

    let rmi_btn = Button::with_label("Remove");
    rmi_btn.add_css_class("destructive-action");
    let name_owned = full_name.clone();
    rmi_btn.connect_clicked(move |btn| {
        let ctx = glib::MainContext::default();
        let name = name_owned.clone();
        btn.set_sensitive(false);
        ctx.spawn_local(async move {
            run_shell(&format!("docker rmi -f {} 2>&1", name)).await;
        });
    });
    row_box.append(&rmi_btn);

    row.set_child(Some(&row_box));
    row
}
