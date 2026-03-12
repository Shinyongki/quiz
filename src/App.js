import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./components/Home";
import Quiz from "./components/Quiz";
import Dashboard from "./components/Dashboard";
import Admin from "./components/Admin";
import "./App.css";

function Nav() {
  const linkClass = ({ isActive }) =>
    `px-5 py-2.5 rounded-lg text-base font-medium transition-colors ${
      isActive
        ? "bg-white text-blue-700 shadow-sm"
        : "text-blue-100 hover:bg-blue-500"
    }`;

  return (
    <nav className="bg-blue-600 shadow-md">
      <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        <h1 className="text-white font-bold text-xl">돌봄 퀴즈</h1>
        <div className="flex gap-2">
          <NavLink to="/" end className={linkClass}>
            홈
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            진행현황
          </NavLink>
          <NavLink to="/admin" className={linkClass}>
            관리자
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50">
        <Nav />
        <main className="max-w-6xl mx-auto px-5 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz/:memberName" element={<Quiz />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
