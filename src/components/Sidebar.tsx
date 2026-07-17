import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import {
    LayoutDashboard,
    Siren,
    Users,
    Upload,
    FileText,
    FileClock,
    Settings,
    Activity,
    Brain
} from "lucide-react";

export function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    const userRole = localStorage.getItem('userRole');

    const menuItems = [
        { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
        { icon: Siren, label: "Triage & Alerts", path: "/emergency/triage" },
        { icon: Users, label: "Patients", path: "/patients" },
        { icon: Upload, label: "Scan & Upload", path: "/camera" },
        { icon: Brain, label: "AI Analytics", path: "/ai-analytics" },
        { icon: Activity, label: "Disease Surveillance", path: "/surveillance" },
        { icon: FileClock, label: "Logs", path: "/logs" },
        { icon: Settings, label: "Settings", path: "/settings" },
    ].filter(item => {
        if (userRole === 'doctor') {
            return !['Logs', 'Disease Surveillance'].includes(item.label);
        }
        if (userRole === 'admin') {
            return !['Dashboard', 'Triage & Alerts', 'Scan & Upload'].includes(item.label);
        }
        return true;
    });

    return (
        <div className="hidden md:flex w-64 h-screen bg-card/50 backdrop-blur-xl border-r border-border flex-col p-4 shrink-0 fixed left-0 top-0 z-50">
            {/* Header with Tri-color Emblem */}
            <div className="flex items-center gap-3 px-2 mb-8 mt-2">
                <div className="relative w-12 h-12 rounded-full flex items-center justify-center p-[2px] bg-gradient-to-tr from-[#FF9933] via-white to-[#138808] shadow-sm">
                    <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg"
                            alt="Emblem"
                            className="w-8 h-8 object-contain opacity-90 dark:invert"
                        />
                    </div>
                </div>
                <div className="flex flex-col">
                    <h1 className="font-bold text-sm leading-none text-foreground">Govt Hospital</h1>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5 text-center">India</p>
                </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1 flex-1">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Button
                            key={item.path}
                            variant={isActive ? "secondary" : "ghost"}
                            className={`w-full justify-start gap-3 h-10 ${isActive
                                ? "bg-primary/10 text-primary hover:bg-primary/15"
                                : "text-muted-foreground hover:text-foreground"
                                }`}
                            onClick={() => navigate(item.path)}
                        >
                            <item.icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
                            <span className="text-sm font-medium">{item.label}</span>
                        </Button>
                    );
                })}
            </nav>

            {/* Footer: Theme Toggle & User Profile */}
            <div className="mt-auto pt-4 border-t border-border flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                    <span className="text-xs text-muted-foreground font-medium">Theme</span>
                    <ModeToggle />
                </div>

                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        DR
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Dr. Varun Tyagi</p>
                        <p className="text-xs text-muted-foreground truncate">Chief Resident</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
