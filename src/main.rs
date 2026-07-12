use gtk4::prelude::*;
use gtk4::{Box as GtkBox, Orientation, Label, Paned, ScrolledWindow, Stack, ListBox, ListBoxRow, CssProvider, gdk::Display};
use libadwaita::prelude::*;
use libadwaita::{Application as AdwApplication, ApplicationWindow as AdwWindow, HeaderBar, ToolbarView};

mod system;
mod modules;

fn main() {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    let _guard = rt.enter();
    rt.spawn(async {
        futures::future::pending::<()>().await;
    });

    let app = AdwApplication::builder()
        .application_id("com.ubuntu.admin.center")
        .build();

    app.connect_startup(|_| {
        gtk4::Window::set_default_icon_name("system-admin");
    });

    app.connect_activate(|app| {
        load_css();
        modules::dashboard::init_styles();
        let window = build_ui(app);
        window.present();
    });

    app.run();
}

fn load_css() {
    let provider = CssProvider::new();
    provider.load_from_string(include_str!("style.css"));

    gtk4::style_context_add_provider_for_display(
        &Display::default().expect("Could not connect to a display"),
        &provider,
        gtk4::STYLE_PROVIDER_PRIORITY_APPLICATION,
    );
}

fn build_ui(app: &AdwApplication) -> AdwWindow {
    let window = AdwWindow::builder()
        .application(app)
        .default_width(1200)
        .default_height(800)
        .title("Ubuntu Admin Center")
        .build();

    let toolbar = ToolbarView::new();
    let header = HeaderBar::builder()
        .title_widget(&Label::new(Some("Ubuntu Admin Center")))
        .build();
    toolbar.add_top_bar(&header);

    let paned = Paned::new(Orientation::Horizontal);
    paned.set_wide_handle(true);

    let sidebar_box = GtkBox::new(Orientation::Vertical, 0);
    sidebar_box.set_size_request(200, -1);

    let sidebar_list = ListBox::new();
    sidebar_list.add_css_class("navigation-sidebar");

    let sidebar_items = vec![
        "Dashboard", "Installed Apps", "Software Installer", "Package Cleaner",
        "Packages", "Services", "Processes", "Users", "Firewall",
        "Repositories", "Files", "Logs", "Docker", "Network", "Disk",
        "Backups", "SSH", "Commands", "AI Assistant", "Audit Logs",
    ];

    for name in &sidebar_items {
        let row = ListBoxRow::new();
        let label = Label::new(Some(name));
        label.set_margin_top(8);
        label.set_margin_bottom(8);
        label.set_margin_start(12);
        label.set_margin_end(12);
        label.set_halign(gtk4::Align::Start);
        row.set_child(Some(&label));
        sidebar_list.append(&row);
    }

    let sidebar_scroll = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&sidebar_list)
        .build();
    sidebar_scroll.set_vexpand(true);
    sidebar_box.append(&sidebar_scroll);

    let stack = Stack::new();
    stack.set_vexpand(true);
    stack.set_hexpand(true);

    let module_creators: Vec<fn() -> GtkBox> = vec![
        modules::dashboard::create,
        modules::installed_apps::create,
        modules::software_installer::create,
        modules::package_cleaner::create,
        modules::packages::create,
        modules::services::create,
        modules::processes::create,
        modules::users::create,
        modules::firewall::create,
        modules::repositories::create,
        modules::files::create,
        modules::logs::create,
        modules::docker::create,
        modules::network::create,
        modules::disk::create,
        modules::backups::create,
        modules::ssh::create,
        modules::commands::create,
        modules::ai_assistant::create,
        modules::audit_logs::create,
    ];

    for (name, creator) in sidebar_items.iter().zip(module_creators.iter()) {
        let widget = creator();
        stack.add_titled(&widget, Some(name), name);
    }

    paned.set_start_child(Some(&sidebar_box));
    paned.set_end_child(Some(&stack));
    paned.set_position(220);

    toolbar.set_content(Some(&paned));
    window.set_content(Some(&toolbar));

    sidebar_list.connect_row_activated(move |_, row| {
        if let Some(label) = row.child().and_downcast::<Label>() {
            let name = label.text();
            stack.set_visible_child_name(&name.as_str());
        }
    });

    window
}
