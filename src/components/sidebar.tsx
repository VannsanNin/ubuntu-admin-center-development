
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Settings,
  Activity,
  Users,
  Shield,
  GitBranch,
  FolderOpen,
  FileText,
  Container,
  Network,
  HardDrive,
  Database,
  BookOpen,
  Bot,
  ScrollText,
  Sun,
  Moon,
  Wrench,
  Trash2,
  AppWindow,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: AppWindow, label: "Installed Apps", href: "/dashboard/installed-apps" },
  { icon: Wrench, label: "Software Installer", href: "/dashboard/software-installer" },
  { icon: Trash2, label: "Package Cleaner", href: "/dashboard/package-cleaner" },
  { icon: Package, label: "Packages", href: "/dashboard/packages" },
  { icon: Settings, label: "Services", href: "/dashboard/services" },
  { icon: Activity, label: "Processes", href: "/dashboard/processes" },
  { icon: Users, label: "Users", href: "/dashboard/users" },
  { icon: Shield, label: "Firewall", href: "/dashboard/firewall" },
  { icon: GitBranch, label: "Repositories", href: "/dashboard/repositories" },
  { icon: FolderOpen, label: "Files", href: "/dashboard/files" },
  { icon: FileText, label: "Logs", href: "/dashboard/logs" },
  { icon: Container, label: "Docker", href: "/dashboard/docker" },
  { icon: Network, label: "Network", href: "/dashboard/network" },
  { icon: HardDrive, label: "Disk", href: "/dashboard/disk" },
  { icon: Database, label: "Backups", href: "/dashboard/backups" },
  { icon: BookOpen, label: "Commands", href: "/dashboard/commands" },
  { icon: Bot, label: "AI Assistant", href: "/dashboard/ai" },
  { icon: ScrollText, label: "Audit Logs", href: "/dashboard/audit" },
];

export default function Sidebar() {
  const { user } = useAuth();
  const { isLight, toggle } = useTheme();
  const pathname = useLocation().pathname;

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-orange-600/20 rounded-lg">
          <Settings className="w-5 h-5 text-orange-500" />
        </div>
        <span className="font-bold text-lg">Admin Center</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              pathname === item.href
                ? "bg-orange-600/20 text-orange-400"
                : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span className="text-sm">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="px-3 py-2 border-t border-slate-800">
        <button
          onClick={toggle}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
        >
          {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          <span className="text-sm">{isLight ? "Dark Mode" : "Light Mode"}</span>
        </button>
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-xs font-bold">
            {user?.username?.[0]?.toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.username}</p>
            <p className="text-xs text-slate-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
