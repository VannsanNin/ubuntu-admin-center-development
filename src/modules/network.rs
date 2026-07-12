use gtk4::prelude::*;
use gtk4::{glib, Label, Entry, Button, Box, Orientation, ScrolledWindow, Align, Spinner};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Network Manager"));
    header.add_css_class("title-1");
    container.append(&header);

    let stats_row = Box::new(Orientation::Horizontal, 12);
    stats_row.add_css_class("net-stats-row");
    stats_row.set_homogeneous(true);

    let (ip_card, ip_value) = build_stat_card("Local IP", "\u{2014}");
    let (gw_card, gw_value) = build_stat_card("Gateway", "\u{2014}");
    let (dns_card, dns_value) = build_stat_card("DNS Servers", "\u{2014}");

    stats_row.append(&ip_card);
    stats_row.append(&gw_card);
    stats_row.append(&dns_card);
    container.append(&stats_row);

    let action_row = Box::new(Orientation::Horizontal, 0);
    action_row.add_css_class("linked");
    action_row.add_css_class("search-row");
    let target_entry = Entry::builder().placeholder_text("Hostname or IP").build();
    target_entry.set_hexpand(true);
    let ping_btn = Button::with_label("Ping");
    ping_btn.add_css_class("suggested-action");
    let traceroute_btn = Button::with_label("Traceroute");
    let refresh_btn = Button::from_icon_name("view-refresh-symbolic");
    action_row.append(&target_entry);
    action_row.append(&ping_btn);
    action_row.append(&traceroute_btn);
    action_row.append(&refresh_btn);
    container.append(&action_row);

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("terminal-panel");
    terminal.set_vexpand(true);
    let output_label = Label::new(Some("$ Enter a hostname or IP and choose Ping or Traceroute"));
    output_label.add_css_class("terminal-text");
    output_label.add_css_class("terminal-idle");
    output_label.set_halign(Align::Start);
    output_label.set_valign(Align::Start);
    output_label.set_wrap(true);
    output_label.set_xalign(0.0);
    output_label.set_selectable(true);
    let output_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Automatic)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&output_label)
        .build();
    output_scroll.set_vexpand(true);
    terminal.append(&output_scroll);
    container.append(&terminal);

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Ready"));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();
    spinner.start();
    ctx.spawn_local(glib::clone!(#[weak] ip_value, #[weak] gw_value, #[weak] dns_value, #[weak] status_label, #[weak] spinner, async move {
        load_network_info(&ip_value, &gw_value, &dns_value).await;
        status_label.set_text("Network info loaded");
        spinner.stop();
        spinner.set_visible(false);
    }));

    let ctx_ping = ctx.clone();
    ping_btn.connect_clicked(glib::clone!(#[weak] target_entry, #[weak] output_label, #[weak] status_label, #[weak] spinner, move |_| {
        let target = target_entry.text().trim().to_string();
        if target.is_empty() { return; }
        let ctx = ctx_ping.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Pinging {}...", target));
        output_label.remove_css_class("terminal-idle");
        ctx.spawn_local(glib::clone!(#[weak] output_label, #[weak] status_label, #[weak] spinner, async move {
            output_label.set_text(&format!("$ ping -c 4 {}", target));
            let r = run_shell(&format!("ping -c 4 {} 2>&1", target)).await;
            output_label.set_text(&format!("$ ping -c 4 {}\n{}\n{}", target, r.stdout, r.stderr));
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Ping complete");
        }));
    }));

    let ctx_tr = ctx.clone();
    traceroute_btn.connect_clicked(glib::clone!(#[weak] target_entry, #[weak] output_label, #[weak] status_label, #[weak] spinner, move |_| {
        let target = target_entry.text().trim().to_string();
        if target.is_empty() { return; }
        let ctx = ctx_tr.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text(&format!("Traceroute to {}...", target));
        output_label.remove_css_class("terminal-idle");
        ctx.spawn_local(glib::clone!(#[weak] output_label, #[weak] status_label, #[weak] spinner, async move {
            output_label.set_text(&format!("$ traceroute -m 15 {}", target));
            let r = run_shell(&format!("traceroute -m 15 {} 2>&1", target)).await;
            output_label.set_text(&format!("$ traceroute -m 15 {}\n{}\n{}", target, r.stdout, r.stderr));
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Traceroute complete");
        }));
    }));

    let ctx_refresh = ctx.clone();
    refresh_btn.connect_clicked(glib::clone!(#[weak] ip_value, #[weak] gw_value, #[weak] dns_value, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_refresh.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Refreshing network info...");
        ctx.spawn_local(glib::clone!(#[weak] ip_value, #[weak] gw_value, #[weak] dns_value, #[weak] status_label, #[weak] spinner, async move {
            load_network_info(&ip_value, &gw_value, &dns_value).await;
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Network info refreshed");
        }));
    }));

    container
}

fn build_stat_card(label_text: &str, initial_value: &str) -> (Box, Label) {
    let card = Box::new(Orientation::Vertical, 4);
    card.add_css_class("net-stat-card");

    let value = Label::new(Some(initial_value));
    value.add_css_class("net-stat-value");
    value.set_halign(Align::Start);
    value.set_ellipsize(gtk4::pango::EllipsizeMode::End);
    card.append(&value);

    let label = Label::new(Some(label_text));
    label.add_css_class("net-stat-label");
    label.set_halign(Align::Start);
    card.append(&label);

    (card, value)
}

async fn load_network_info(ip_value: &Label, gw_value: &Label, dns_value: &Label) {
    let ip = run_shell("hostname -I 2>/dev/null | awk '{print $1}'").await;
    let gateway = run_shell("ip route | grep default | awk '{print $3}'").await;
    let dns = run_shell("cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print $2}' | head -3").await;

    let ip_text = ip.stdout.trim();
    let gw_text = gateway.stdout.trim();
    let dns_text = dns.stdout.lines().collect::<Vec<_>>().join(", ");

    ip_value.set_text(if ip_text.is_empty() { "Unavailable" } else { ip_text });
    gw_value.set_text(if gw_text.is_empty() { "Unavailable" } else { gw_text });
    dns_value.set_text(if dns_text.is_empty() { "Unavailable" } else { &dns_text });
}
