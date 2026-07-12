use gtk4::prelude::*;
use gtk4::{glib, Label, Box as GtkBox, Orientation, ProgressBar, ScrolledWindow, FlowBox, SelectionMode, Align, CssProvider, STYLE_PROVIDER_PRIORITY_APPLICATION};
use plotters::prelude::*;
use plotters::style::{FontDesc, FontFamily, FontStyle};
use crate::system::commands::SystemInfo;
use std::cell::RefCell;
use std::collections::VecDeque;
use std::rc::Rc;

const FPS: u32 = 2;
const LENGTH: u32 = 30;
const N_DATA_POINTS: usize = (FPS * LENGTH) as usize;

const CORE_COLORS: [(u8, u8, u8); 8] = [
    (53, 132, 228),   // Blue
    (46, 194, 126),   // Green
    (246, 180, 0),    // Yellow
    (224, 27, 36),    // Red
    (145, 65, 172),   // Purple
    (255, 120, 0),    // Orange
    (0, 210, 211),    // Cyan
    (252, 121, 176),  // Pink
];

pub fn init_styles() {
    let provider = CssProvider::new();
    provider.load_from_string(include_str!("styles.css"));
    if let Some(display) = gtk4::gdk::Display::default() {
        gtk4::style_context_add_provider_for_display(
            &display,
            &provider,
            STYLE_PROVIDER_PRIORITY_APPLICATION,
        );
    }
}

pub fn create() -> GtkBox {
    let container = GtkBox::new(Orientation::Vertical, 16);
    container.add_css_class("dashboard-container");

    let header_box = GtkBox::new(Orientation::Vertical, 4);
    let header = Label::new(Some("System Dashboard"));
    header.add_css_class("dashboard-title");
    header.set_halign(Align::Start);

    let subheader = Label::new(Some("Real-time performance metrics and status"));
    subheader.add_css_class("dashboard-subtitle");
    subheader.set_halign(Align::Start);

    header_box.append(&header);
    header_box.append(&subheader);
    container.append(&header_box);

    let chart_box = GtkBox::new(Orientation::Vertical, 0);
    container.append(&chart_box);

    let grid = FlowBox::new();
    grid.set_valign(Align::Start);
    grid.set_max_children_per_line(3);
    grid.set_min_children_per_line(1);
    grid.set_selection_mode(SelectionMode::None);
    grid.set_row_spacing(16);
    grid.set_column_spacing(16);
    grid.set_vexpand(true);

    let scrolled = ScrolledWindow::builder()
        .hscrollbar_policy(gtk4::PolicyType::Never)
        .vscrollbar_policy(gtk4::PolicyType::Automatic)
        .child(&grid)
        .build();
    scrolled.add_css_class("dashboard-scroll");

    container.append(&scrolled);

    let cpu_data: Rc<RefCell<Vec<VecDeque<f64>>>> = Rc::new(RefCell::new(Vec::new()));
    let picture: Rc<RefCell<Option<gtk4::Picture>>> = Rc::new(RefCell::new(None));

    let ctx = glib::MainContext::default();
    ctx.spawn_local({
        let cpu_data = cpu_data.clone();
        let picture = picture.clone();
        glib::clone!(#[weak] grid, #[weak] chart_box, async move {
            let info = SystemInfo::collect().await;

            while let Some(child) = grid.first_child() {
                grid.remove(&child);
            }
            while let Some(child) = chart_box.first_child() {
                chart_box.remove(&child);
            }

            let mut data = cpu_data.borrow_mut();
            let n_cores = info.cpu_cores.len().max(1);
            *data = (0..n_cores).map(|_| VecDeque::from(vec![0f64; N_DATA_POINTS])).collect();

            let snapshot: Vec<VecDeque<f64>> = data.clone();
            drop(data);

            if let Ok(chart_bytes) = render_cpu_chart(&snapshot) {
                let tex = gtk4::gdk::Texture::from_bytes(&glib::Bytes::from(&chart_bytes)).unwrap();
                let p = gtk4::Picture::new();
                p.set_paintable(Some(&tex));
                p.set_can_shrink(true);

                let chart_card = GtkBox::new(Orientation::Vertical, 12);
                chart_card.add_css_class("dashboard-card");
                chart_card.add_css_class("chart-card");

                let title = Label::new(Some("Real-Time Core Distribution"));
                title.add_css_class("card-title");
                title.set_halign(Align::Start);

                chart_card.append(&title);
                chart_card.append(&p);
                chart_box.append(&chart_card);
                *picture.borrow_mut() = Some(p);
            }

            add_info_cards(&grid, &info);
        })
    });

    glib::timeout_add_seconds_local(FPS, {
        let cpu_data = cpu_data.clone();
        let picture = picture.clone();
        move || {
            let cpu_data = cpu_data.clone();
            let picture = picture.clone();
            glib::spawn_future_local(async move {
                let info = SystemInfo::collect().await;
                {
                    let mut data = cpu_data.borrow_mut();
                    while data.len() < info.cpu_cores.len() {
                        data.push(VecDeque::from(vec![0f64; N_DATA_POINTS]));
                    }
                    for (i, &val) in info.cpu_cores.iter().enumerate() {
                        if let Some(core_data) = data.get_mut(i) {
                            if core_data.len() == N_DATA_POINTS + 1 {
                                core_data.pop_front();
                            }
                            core_data.push_back(val);
                        }
                    }
                    let snapshot: Vec<VecDeque<f64>> = data.clone();
                    drop(data);

                    if let Ok(chart_bytes) = render_cpu_chart(&snapshot) {
                        let tex = gtk4::gdk::Texture::from_bytes(&glib::Bytes::from(&chart_bytes)).unwrap();
                        if let Some(ref p) = *picture.borrow() {
                            p.set_paintable(Some(&tex));
                        }
                    }
                }
            });
            glib::ControlFlow::Continue
        }
    });

    container
}

fn render_cpu_chart(data: &[VecDeque<f64>]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let width = 760u32;
    let height = 240u32;
    let mut buffer = vec![0u8; (width * height * 3) as usize];
    {
        let backend = BitMapBackend::with_buffer(&mut buffer, (width, height));
        let root = backend.into_drawing_area();
        root.fill(&RGBColor(30, 30, 41))?;

        let font_label = FontDesc::new(FontFamily::SansSerif, 10.0, FontStyle::Normal)
            .color(&RGBColor(150, 150, 160));

        let mut chart = ChartBuilder::on(&root)
            .margin_top(10)
            .margin_bottom(10)
            .margin_right(20)
            .margin_left(10)
            .x_label_area_size(25)
            .y_label_area_size(40)
            .build_cartesian_2d(0..N_DATA_POINTS as u32, 0f64..100f64)?;

        chart.configure_mesh()
            .disable_x_mesh()
            .light_line_style(RGBColor(45, 45, 60))
            .x_labels(6)
            .x_label_formatter(&|x| {
                let sec = -(LENGTH as f64) + (*x as f64 / FPS as f64);
                if sec == 0.0 { "Now".to_string() } else { format!("{:.0}s", sec) }
            })
            .y_labels(4)
            .y_label_formatter(&|y| format!("{:.0}%", y))
            .axis_style(RGBColor(60, 60, 80))
            .label_style(font_label)
            .draw()?;

        for (idx, core_data) in data.iter().enumerate() {
            let color = CORE_COLORS[idx % CORE_COLORS.len()];
            let series: Vec<(u32, f64)> = core_data.iter().enumerate().map(|(a, b)| (a as u32, *b)).collect();
            chart.draw_series(LineSeries::new(
                series,
                RGBColor(color.0, color.1, color.2).stroke_width(2),
            ))?;
        }

        root.present()?;
    }

    let mut png_data = std::io::Cursor::new(Vec::new());
    {
        let mut encoder = png::Encoder::new(&mut png_data, width, height);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header()?;
        writer.write_image_data(&buffer)?;
    }
    Ok(png_data.into_inner())
}

fn add_info_cards(grid: &FlowBox, info: &SystemInfo) {
    grid.insert(&create_info_card("Hostname", &info.hostname), -1);
    grid.insert(&create_info_card("OS", &info.os_version), -1);
    grid.insert(&create_info_card("Kernel", &info.kernel), -1);
    grid.insert(&create_info_card("Uptime", &info.uptime), -1);

    grid.insert(&create_progress_card("Overall CPU", info.cpu_usage), -1);
    grid.insert(&create_progress_card("Memory", info.memory.percent), -1);
    grid.insert(&create_progress_card("Swap", info.swap.percent), -1);
    grid.insert(&create_progress_card(&format!("Disk ({})", info.disk.mount_point), info.disk.percent), -1);

    grid.insert(&create_info_card("Load Average", &info.load_average.join(", ")), -1);
    grid.insert(&create_info_card("Processes", &info.process_count.to_string()), -1);

    if !info.logged_in_users.is_empty() {
        grid.insert(&create_info_card("Logged Users", &info.logged_in_users.join(", ")), -1);
    }

    let section_box = GtkBox::new(Orientation::Vertical, 4);
    section_box.set_hexpand(true);
    let net_header = Label::new(Some("Network Interfaces"));
    net_header.add_css_class("section-title");
    net_header.set_halign(Align::Start);
    section_box.append(&net_header);
    grid.insert(&section_box, -1);

    for iface in &info.network {
        let rx_mb = iface.rx_bytes as f64 / 1_048_576.0;
        let tx_mb = iface.tx_bytes as f64 / 1_048_576.0;
        grid.insert(&create_info_card(&iface.name, &format!("\u{2193} {:.1} MB   \u{2191} {:.1} MB", rx_mb, tx_mb)), -1);
    }
}

fn create_info_card(title: &str, value: &str) -> GtkBox {
    let card = GtkBox::new(Orientation::Vertical, 6);
    card.add_css_class("dashboard-card");

    let title_label = Label::new(Some(title));
    title_label.add_css_class("card-title");
    title_label.set_halign(Align::Start);
    card.append(&title_label);

    let value_label = Label::new(Some(value));
    value_label.add_css_class("card-value");
    value_label.set_halign(Align::Start);
    value_label.set_wrap(true);
    card.append(&value_label);

    card
}

fn create_progress_card(title: &str, percent: f64) -> GtkBox {
    let card = GtkBox::new(Orientation::Vertical, 8);
    card.add_css_class("dashboard-card");

    let header = GtkBox::new(Orientation::Horizontal, 0);

    let title_label = Label::new(Some(title));
    title_label.add_css_class("card-title");
    title_label.set_halign(Align::Start);
    title_label.set_hexpand(true);

    let value_label = Label::new(Some(&format!("{:.1}%", percent)));
    value_label.add_css_class("card-progress-value");
    value_label.set_halign(Align::End);

    header.append(&title_label);
    header.append(&value_label);
    card.append(&header);

    let bar = ProgressBar::new();
    bar.set_fraction(percent / 100.0);
    bar.set_show_text(false);

    if percent >= 90.0 {
        bar.add_css_class("critical");
    } else if percent >= 70.0 {
        bar.add_css_class("warning");
    } else {
        bar.add_css_class("normal");
    }

    card.append(&bar);
    card
}
