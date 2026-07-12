use gtk4::prelude::*;
use gtk4::{glib, Label, Button, CheckButton, Box, Orientation, Align, Spinner};
use crate::system::commands::run_shell;

pub fn create() -> Box {
    let container = Box::new(Orientation::Vertical, 12);
    container.set_margin_top(24);
    container.set_margin_bottom(24);
    container.set_margin_start(24);
    container.set_margin_end(24);

    let header = Label::new(Some("Package Cleaner"));
    header.add_css_class("title-1");
    container.append(&header);

    let action_row = Box::new(Orientation::Horizontal, 0);
    action_row.add_css_class("linked");
    let analyze_btn = Button::with_label("Analyze");
    analyze_btn.add_css_class("suggested-action");
    let clean_btn = Button::with_label("Run Cleanup");
    clean_btn.add_css_class("destructive-action");
    action_row.append(&analyze_btn);
    action_row.append(&clean_btn);
    container.append(&action_row);

    let stats_row = Box::new(Orientation::Horizontal, 12);
    stats_row.add_css_class("stats-row");
    stats_row.set_homogeneous(true);

    let (cache_card, cache_value) = build_stat_card("APT Cache", "—", "stat-good");
    let (orphan_card, orphan_value) = build_stat_card("Orphan Packages", "—", "stat-warning");
    let (kernel_card, kernel_value) = build_stat_card("Old Kernels", "—", "stat-warning");

    stats_row.append(&cache_card);
    stats_row.append(&orphan_card);
    stats_row.append(&kernel_card);
    container.append(&stats_row);

    let current_kernel_label = Label::new(Some("Run analysis to see current kernel"));
    current_kernel_label.add_css_class("body");
    current_kernel_label.set_halign(Align::Start);
    current_kernel_label.set_opacity(0.6);
    container.append(&current_kernel_label);

    let options_box = Box::new(Orientation::Vertical, 8);
    options_box.set_margin_top(8);

    let (autoremove_row, clean_autoremove) = build_option_row(
        "Remove orphan packages (autoremove)",
        "Frees space from packages no longer required by anything installed",
    );
    let (cache_row, clean_cache) = build_option_row(
        "Clean package cache",
        "Deletes downloaded .deb files from /var/cache/apt/archives",
    );
    let (autoclean_row, clean_autoclean) = build_option_row(
        "Clean outdated packages (autoclean)",
        "Removes cached packages that can no longer be downloaded",
    );
    let (kernels_row, clean_kernels) = build_option_row(
        "Remove old kernels",
        "⚠ Keeps the currently running kernel, removes other -generic kernels",
    );

    options_box.append(&autoremove_row);
    options_box.append(&cache_row);
    options_box.append(&autoclean_row);
    options_box.append(&kernels_row);
    container.append(&options_box);

    let term_toggle_btn = Button::from_icon_name("go-down-symbolic");
    term_toggle_btn.set_tooltip_text(Some("Toggle terminal"));
    term_toggle_btn.set_halign(Align::Start);
    container.append(&term_toggle_btn);

    let terminal = Box::new(Orientation::Vertical, 4);
    terminal.add_css_class("terminal-panel");
    terminal.set_size_request(-1, 200);
    terminal.set_vexpand(true);
    let term_label = Label::new(Some("$ Ready"));
    term_label.add_css_class("terminal-text");
    term_label.add_css_class("terminal-idle");
    term_label.set_halign(Align::Start);
    term_label.set_valign(Align::Start);
    term_label.set_wrap(true);
    term_label.set_xalign(0.0);
    terminal.append(&term_label);
    container.append(&terminal);

    term_toggle_btn.connect_clicked(glib::clone!(#[weak] terminal, #[weak] term_toggle_btn, move |_| {
        let visible = !terminal.is_visible();
        terminal.set_visible(visible);
        term_toggle_btn.set_icon_name(if visible { "go-up-symbolic" } else { "go-down-symbolic" });
    }));

    let status_box = Box::new(Orientation::Horizontal, 8);
    status_box.add_css_class("status-footer");
    let spinner = Spinner::new();
    let status_label = Label::new(Some("Ready"));
    status_label.set_halign(Align::Start);
    status_box.append(&spinner);
    status_box.append(&status_label);
    container.append(&status_box);

    let ctx = glib::MainContext::default();

    let ctx_analyze = ctx.clone();
    analyze_btn.connect_clicked(glib::clone!(
        #[weak] cache_value, #[weak] orphan_value, #[weak] kernel_value,
        #[weak] current_kernel_label, #[weak] term_label, #[weak] status_label, #[weak] spinner,
        move |_| {
        let ctx = ctx_analyze.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Analyzing...");
        term_label.remove_css_class("terminal-idle");
        term_label.set_text("$ Running analysis...");
        ctx.spawn_local(glib::clone!(
            #[weak] cache_value, #[weak] orphan_value, #[weak] kernel_value,
            #[weak] current_kernel_label, #[weak] term_label, #[weak] status_label, #[weak] spinner,
            async move {
            let cache = run_shell("du -sh /var/cache/apt/archives/ 2>/dev/null | cut -f1").await;
            let orphans_count = run_shell("apt-get -s autoremove 2>/dev/null | grep '^Remv' | wc -l").await;
            let kernel_count = run_shell("dpkg -l 'linux-image-*' 2>/dev/null | grep '^ii' | wc -l").await;
            let current_kernel = run_shell("uname -r").await;

            cache_value.set_text(cache.stdout.trim());
            orphan_value.set_text(orphans_count.stdout.trim());
            kernel_value.set_text(kernel_count.stdout.trim());
            current_kernel_label.set_text(&format!("Current kernel: {}", current_kernel.stdout.trim()));
            current_kernel_label.set_opacity(1.0);

            let summary = format!(
                "$ Analysis complete\nAPT cache: {}\nOrphan packages: {}\nInstalled kernels: {}\nCurrent kernel: {}",
                cache.stdout.trim(),
                orphans_count.stdout.trim(),
                kernel_count.stdout.trim(),
                current_kernel.stdout.trim(),
            );
            term_label.set_text(&summary);
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Analysis complete");
        }));
    }));

    let ctx_clean = ctx.clone();
    clean_btn.connect_clicked(glib::clone!(#[weak] clean_autoremove, #[weak] clean_cache, #[weak] clean_autoclean, #[weak] clean_kernels, #[weak] term_label, #[weak] status_label, #[weak] spinner, move |_| {
        let ctx = ctx_clean.clone();
        spinner.set_visible(true);
        spinner.start();
        status_label.set_text("Running cleanup...");
        term_label.remove_css_class("terminal-idle");
        ctx.spawn_local(glib::clone!(#[weak] term_label, #[weak] status_label, #[weak] spinner, async move {
            term_label.set_text("$ Running cleanup...");
            let mut output = String::from("$ Running cleanup...\n");

            if clean_autoremove.is_active() {
                output.push_str("→ Running autoremove...\n");
                let r = run_shell("sudo apt-get autoremove -y 2>&1").await;
                output.push_str(&r.stdout);
                output.push_str(&r.stderr);
                output.push('\n');
            }
            if clean_cache.is_active() {
                output.push_str("→ Cleaning cache...\n");
                let r = run_shell("sudo apt-get clean 2>&1").await;
                output.push_str(&r.stdout);
                output.push('\n');
            }
            if clean_autoclean.is_active() {
                output.push_str("→ Running autoclean...\n");
                let r = run_shell("sudo apt-get autoclean 2>&1").await;
                output.push_str(&r.stdout);
                output.push('\n');
            }
            if clean_kernels.is_active() {
                output.push_str("→ Removing old kernels...\n");
                let r = run_shell("sudo apt-get purge -y 'linux-image-.*-generic' 2>&1").await;
                output.push_str(&r.stdout);
                output.push('\n');
            }

            output.push_str("\n✓ Cleanup complete!");
            term_label.set_text(&output);
            spinner.stop();
            spinner.set_visible(false);
            status_label.set_text("Cleanup complete");
        }));
    }));

    container
}

fn build_stat_card(label_text: &str, initial_value: &str, tone_class: &str) -> (Box, Label) {
    let card = Box::new(Orientation::Vertical, 4);
    card.add_css_class("stat-card");
    card.add_css_class(tone_class);

    let value = Label::new(Some(initial_value));
    value.add_css_class("stat-value");
    value.set_halign(Align::Start);
    card.append(&value);

    let label = Label::new(Some(label_text));
    label.add_css_class("stat-label");
    label.set_halign(Align::Start);
    card.append(&label);

    (card, value)
}

fn build_option_row(title: &str, description: &str) -> (Box, CheckButton) {
    let row = Box::new(Orientation::Vertical, 4);
    row.add_css_class("option-row");

    let check = CheckButton::with_label(title);
    check.set_halign(Align::Start);
    row.append(&check);

    let desc = Label::new(Some(description));
    desc.add_css_class("option-desc");
    desc.set_halign(Align::Start);
    desc.set_wrap(true);
    row.append(&desc);

    (row, check)
}
