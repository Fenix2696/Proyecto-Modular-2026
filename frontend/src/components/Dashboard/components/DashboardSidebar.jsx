import React from "react";
import { Map, SlidersHorizontal, BarChart3, Layers, Power, Route } from "lucide-react";

export default function DashboardSidebar({
  sidebarCollapsed,
  activePanel,
  setActivePanel,
  onLogout,
}) {
  const items = [
    { key: "none", label: "Mapa", Icon: Map, title: "Mapa" },
    { key: "directions", label: "Direcciones", Icon: Route, title: "Direcciones" },
    { key: "filters", label: "Filtros", Icon: SlidersHorizontal, title: "Filtros" },
    { key: "stats", label: "Estadisticas", Icon: BarChart3, title: "Estadisticas" },
    { key: "layers", label: "Capas", Icon: Layers, title: "Capas" },
  ];

  const handleClick = (key) => {
    if (key === "none") {
      setActivePanel("none");
      return;
    }
    setActivePanel((p) => (p === key ? "none" : key));
  };

  return (
    <aside className={`rc-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
      <div className="rc-sidebar-header">
        <div className="rc-sidebar-title">{sidebarCollapsed ? "RC" : "Menu"}</div>
      </div>

      <nav className="rc-sidebar-nav" aria-label="Navegacion">
        {items.map(({ key, label, Icon, title }) => {
          const active = key === "none" ? activePanel === "none" : activePanel === key;

          return (
            <button
              key={key}
              className={`rc-side-item ${active ? "active" : ""}`}
              onClick={() => handleClick(key)}
              title={title}
              type="button"
            >
              <span className="rc-side-ico" aria-hidden="true">
                <Icon size={18} />
              </span>

              <span className="rc-side-label">{label}</span>

              {sidebarCollapsed && <span className="rc-side-tooltip">{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="rc-sidebar-spacer" />

      <div className="rc-sidebar-footer">
        <button className="rc-side-item danger" onClick={onLogout} title="Cerrar sesion" type="button">
          <span className="rc-side-ico" aria-hidden="true">
            <Power size={18} />
          </span>
          <span className="rc-side-label">Salir</span>
          {sidebarCollapsed && <span className="rc-side-tooltip">Salir</span>}
        </button>
      </div>
    </aside>
  );
}
