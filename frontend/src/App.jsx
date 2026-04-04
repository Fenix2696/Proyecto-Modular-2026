import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

import Dashboard from "./components/Dashboard/Dashboard";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";

const INACTIVITY_TIME = 10 * 60 * 1000;

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

      // No cerrar si está en login o register
      if (
        token &&
        location.pathname !== "/login" &&
        location.pathname !== "/register"
      ) {
        localStorage.clear();
        navigate("/login", { replace: true });
      }
    }, INACTIVITY_TIME);
  };

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

    events.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true });
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
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}