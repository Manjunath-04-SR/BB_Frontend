import { useState, useEffect } from "react";
import { Menu, X, Zap, LayoutDashboard } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const isLoggedIn = !!localStorage.getItem("token");
  const isAdmin = JSON.parse(localStorage.getItem("user") || "{}").role === "admin";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const navLinks = [
    { label: "Courses", to: "/courses" },
    { label: "Practice", to: "/practice" },
    { label: "Problem of the Day", to: "/problem-of-the-day" },
    { label: "Company Prep", to: "/company-prep" },
    { label: "Contests", to: "/contests" },
    { label: "How It Works", to: "/how-it-works", hideOnMd: true },
    { label: "Mock Tests", to: "/mock-assessments", hideOnMd: true },
    { label: "Resume AI", to: "/resume-analyzer", hideOnMd: true },
    { label: "Resources", to: "/resources", hideOnMd: true },
  ];

  return (
    <nav className={`sticky top-0 z-50 w-full h-16 flex items-center justify-between px-4 sm:px-6 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"}`}>
      {/* Logo */}
      <div className="flex items-center gap-6 lg:gap-10 min-w-0">
        <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
            <Zap size={16} className="text-white fill-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-slate-900">
            beyond<span className="text-primary">basic</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-semibold text-slate-600">
          {navLinks.map(({ label, to, hideOnMd }) => (
            <Link key={label} to={to} className={`hover:text-primary transition-colors whitespace-nowrap ${hideOnMd ? "hidden lg:block" : ""}`}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {isLoggedIn ? (
          <>
            {isAdmin && (
              <Link to="/admin" className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-all">
                <LayoutDashboard className="w-4 h-4" /> Admin
              </Link>
            )}
            <Link to="/courses" className="hidden md:flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all">
              Browse Courses
            </Link>
            <button onClick={handleLogout} className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-px active:translate-y-0 transition-all whitespace-nowrap">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hidden md:flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all">
              Log in
            </Link>
            <Link to="/signup" className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 hover:-translate-y-px active:translate-y-0 transition-all whitespace-nowrap">
              Join the Batch
            </Link>
          </>
        )}
        <button className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white shadow-lg px-6 py-4 flex flex-col gap-4 md:hidden" style={{ borderBottom: "1px solid #f1f5f9" }}>
          {[...navLinks.map(({ label, to }) => ({ label, to })), ...(isAdmin ? [{ label: "Admin Panel", to: "/admin" }] : [])].map(({ label, to }) => (
            <Link key={label} to={to} className="font-semibold text-slate-700 hover:text-primary py-1" onClick={() => setMenuOpen(false)}>
              {label}
            </Link>
          ))}
          <div className="flex gap-3 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
            {isLoggedIn ? (
              <>
                <Link to="/courses" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center text-slate-700 hover:bg-slate-50 transition-all" style={{ border: "1px solid #e2e8f0" }} onClick={() => setMenuOpen(false)}>
                  Courses
                </Link>
                <button onClick={handleLogout} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-center text-slate-700 hover:bg-slate-50 transition-all" style={{ border: "1px solid #e2e8f0" }} onClick={() => setMenuOpen(false)}>
                  Log in
                </Link>
                <Link to="/signup" className="flex-1 py-2.5 rounded-xl bg-primary text-center text-white text-sm font-semibold shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all" onClick={() => setMenuOpen(false)}>
                  Join Batch
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
