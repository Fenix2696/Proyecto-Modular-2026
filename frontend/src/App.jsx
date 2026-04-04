import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

import Dashboard from "./components/Dashboard/Dashboard";
import Login from "./components/Auth/Login"; // ajusta ruta si es diferente

const INACTIVITY_TIME = 5 * 60 * 1000; // 10 minutos

function SessionHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const timeoutRef = useRef(null);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const token = localStorage.getItem("token");

      // solo cerrar si está logueado
      if (token) {
        console.log("Sesion expirada por inactividad");

        localStorage.clear();
        navigate("/login", { replace: true });
      }
    }, INACTIVITY_TIME);
  };

  useEffect(() => {
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll"
    ];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [location.pathname]);

  return null;
}

export default function App() {
  return (
    <Router>

      <SessionHandler />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}