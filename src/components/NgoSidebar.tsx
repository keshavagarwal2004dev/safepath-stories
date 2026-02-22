import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Library, BarChart3, Settings, LogOut } from "lucide-react";

const sidebarItems = [
  { to: "/ngo/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ngo/create-story", icon: PlusCircle, label: "Create Story" },
  { to: "/ngo/my-stories", icon: Library, label: "My Stories" },
  { to: "/ngo/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/ngo/settings", icon: Settings, label: "Settings" },
];

const NgoSidebar = () => {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-hero shadow-glow">
          <img src="/safe%20story%20logo.png" alt="Safe Story logo" className="h-6 w-6 object-contain" />
        </div>
        <span className="font-display text-xl font-extrabold text-sidebar-foreground">Safe Story</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {sidebarItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-4">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-sidebar-foreground/60 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Link>
      </div>
    </aside>
  );
};

export default NgoSidebar;
