import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@wellfit-emr/ui/lib/utils";
import {
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileOutput,
  FileText,
  FlaskConical,
  Home,
  Mail,
  Paperclip,
  Pill,
  ScrollText,
  Settings,
  Share2,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  icon: React.ElementType;
  label: string;
  to: string;
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Principal",
    items: [{ icon: Home, label: "Dashboard", to: "/" }],
  },
  {
    label: "Clínico",
    items: [
      { icon: Users, label: "Pacientes", to: "/patients" },
      { icon: Calendar, label: "Agenda", to: "/appointments" },
      { icon: Stethoscope, label: "Atenciones", to: "/encounters" },
      {
        icon: ScrollText,
        label: "Documentos clínicos",
        to: "/clinical-documents",
      },
      { icon: ShieldCheck, label: "Consentimientos", to: "/consents" },
      { icon: Pill, label: "Prescripciones", to: "/medication-orders" },
      {
        icon: FlaskConical,
        label: "Órdenes y resultados",
        to: "/service-requests",
      },
      { icon: Mail, label: "Interconsultas", to: "/interconsultations" },
      {
        icon: ClipboardList,
        label: "Incapacidades",
        to: "/incapacity-certificates",
      },
    ],
  },
  {
    label: "Documental",
    items: [
      { icon: Paperclip, label: "Anexos", to: "/attachments" },
      { icon: Eye, label: "Auditoría", to: "/audit-events" },
    ],
  },
  {
    label: "Regulatorio",
    items: [
      { icon: FileOutput, label: "RIPS", to: "/rips-exports" },
      { icon: Share2, label: "IHCE", to: "/ihce-bundles" },
      { icon: FileText, label: "Catálogos RIPS", to: "/catalogs" },
    ],
  },
  {
    label: "Configuración",
    items: [
      {
        icon: Building2,
        label: "Institución",
        to: "/facilities/organizations",
      },
    ],
  },
  {
    label: "Sistema",
    items: [{ icon: Settings, label: "Administración", to: "/admin/users" }],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar transition-all duration-200 ease-out",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div className="flex h-12 items-center justify-between border-b px-3">
        {!collapsed && (
          <span className="font-semibold text-sidebar-foreground text-sm tracking-tight">
            WellFit EMR
          </span>
        )}
        <button
          className="ml-auto inline-flex size-7 items-center justify-center text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={() => setCollapsed((c) => !c)}
          type="button"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-auto py-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <div className="mb-1 px-3 font-medium text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.to || pathname.startsWith(`${item.to}/`);
                return (
                  <li key={item.to}>
                    <Link
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors",
                        collapsed && "justify-center px-2",
                        isActive
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                      to={item.to}
                    >
                      <item.icon size={16} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        {!collapsed && (
          <div className="text-[10px] text-sidebar-foreground/50">
            WellFit EMR v0.1
          </div>
        )}
      </div>
    </aside>
  );
}
