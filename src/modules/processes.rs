use std::cell::RefCell;
use std::rc::Rc;
use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, ListBox, ListBoxRow, Align, Spinner};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Process Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let controls = Box::new(Orientation::Horizontal, 0);
    controls.add_css_class("linked");
    controls.add_css_class("search-row");
    let search_entry = Entry::builder().placeholder_text("Search PID or name...").build();
    search_entry.set_hexpand(true);
    let sort_cpu = Button::with_label("CPU");
    sort_cpu.add_css_class("sort-toggle");
    sort_cpu.add_css_class("active");
    let sort_mem = Button::with_label("MEM");
    sort_mem.add_css_class("sort-toggle");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    controls.append(&search_entry);
    controls.append(&sort_cpu);
    controls.append(&sort_mem);
    controls.append(&refresh_btn);
    container.append(&controls);

    let sort_by = Rc::new(RefCell::new("cpu".to_string()));

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
    let status_label = Label::new(Some("Loading processes..."));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    {
        let list_box = list_box.clone();
        let status_label = status_label.clone();
        let spinner = spinner.clone();
        ctx.spawn_local(async move {
            load_processes(&list_box, &status_label, "cpu").await;
            spinner.stop();
            spinner.set_visible(false);
        });
    }

    let ctx_cpu = ctx.clone();
    let sb_cpu = sort_by.clone();
    sort_cpu.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, #[weak] sort_mem, move |btn| {
        *sb_cpu.borrow_mut() = "cpu".to_string();
        btn.add_css_class("active");
        sort_mem.remove_css_class("active");
        let ctx = ctx_cpu.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_processes(&list_box, &status_label, "cpu").await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_mem = ctx.clone();
    let sb_mem = sort_by.clone();
    sort_mem.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, #[weak] sort_cpu, move |btn| {
        *sb_mem.borrow_mut() = "mem".to_string();
        btn.add_css_class("active");
        sort_cpu.remove_css_class("active");
        let ctx = ctx_mem.clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_processes(&list_box, &status_label, "mem").await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    let ctx_refresh = ctx.clone();
    let sb_refresh = sort_by.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        let s = sb_refresh.borrow().clone();
        spinner.set_visible(true);
        spinner.start();
        ctx.spawn_local(glib::clone!(#[weak] list_box, #[weak] status_label, #[weak] spinner, async move {
            load_processes(&list_box, &status_label, &s).await;
            spinner.stop();
            spinner.set_visible(false);
        }));
    }));

    search_entry.connect_changed(glib::clone!(#[weak] list_box, #[weak] search_entry, move |_| {
        let filter = search_entry.text().to_lowercase();
        let mut child = list_box.first_child();
        while let Some(widget) = child {
            if let Some(row) = widget.downcast_ref::<ListBoxRow>() {
                let haystack = row.widget_name().to_lowercase();
                widget.set_visible(filter.is_empty() || haystack.contains(&filter));
            }
            child = widget.next_sibling();
        }
    }));

    container
}

async fn load_processes(list_box: &ListBox, status_label: &Label, sort: &str) {
    status_label.set_text("Loading processes...");

    let result = if sort == "mem" {
        run_shell("ps aux --no-headers --sort=-%mem 2>/dev/null | head -200").await
    } else {
        run_shell("ps aux --no-headers --sort=-%cpu 2>/dev/null | head -200").await
    };

    while let Some(child) = list_box.first_child() {
        list_box.remove(&child);
    }

    let mut count = 0;
    for line in result.stdout.lines() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 11 {
            let user = parts[0];
            let pid = parts[1];
            let cpu = parts[2];
            let mem = parts[3];
            let cmd = parts[10..].join(" ");

            let row = build_process_row(user, pid, cpu, mem, &cmd);
            list_box.append(&row);
            count += 1;
        }
    }
    status_label.set_text(&format!("Loaded {} processes (sorted by {})", count, sort));
}

fn build_process_row(user: &str, pid: &str, cpu: &str, mem: &str, cmd: &str) -> ListBoxRow {
    let row = ListBoxRow::new();
    row.set_widget_name(&format!("{}|{}|{}", pid, user, cmd));

    let row_box = Box::new(Orientation::Horizontal, 10);
    row_box.add_css_class("process-row");

    let pid_label = Label::new(Some(pid));
    pid_label.add_css_class("proc-pid");
    pid_label.set_halign(Align::Start);
    row_box.append(&pid_label);

    let user_label = Label::new(Some(user));
    user_label.add_css_class("proc-user");
    user_label.set_halign(Align::Start);
    row_box.append(&user_label);

    let cmd_label = Label::new(Some(cmd));
    cmd_label.add_css_class("proc-cmd");
    cmd_label.set_halign(Align::Start);
    cmd_label.set_hexpand(true);
    cmd_label.set_ellipsize(gtk4::pango::EllipsizeMode::End);
    row_box.append(&cmd_label);

    let cpu_val: f64 = cpu.parse().unwrap_or(0.0);
    let cpu_label = Label::new(Some(&format!("{}%", cpu)));
    cpu_label.add_css_class("proc-metric");
    cpu_label.add_css_class(severity_class(cpu_val));
    row_box.append(&cpu_label);

    let mem_val: f64 = mem.parse().unwrap_or(0.0);
    let mem_label = Label::new(Some(&format!("{}%", mem)));
    mem_label.add_css_class("proc-metric");
    mem_label.add_css_class(severity_class(mem_val));
    row_box.append(&mem_label);

    let kill_btn = Button::with_label("Kill");
    kill_btn.add_css_class("destructive-action");
    let pid_owned = pid.to_string();
    kill_btn.connect_clicked(move |btn| {
        let ctx = glib::MainContext::default();
        let pid = pid_owned.clone();
        btn.set_sensitive(false);
        ctx.spawn_local(async move {
            run_shell(&format!("kill -9 {}", pid)).await;
        });
    });
    row_box.append(&kill_btn);

    row.set_child(Some(&row_box));
    row
}

fn severity_class(value: f64) -> &'static str {
    if value >= 50.0 {
        "metric-high"
    } else if value >= 15.0 {
        "metric-medium"
    } else {
        "metric-low"
    }
}
