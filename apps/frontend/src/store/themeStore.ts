import { create } from "zustand";

export type Theme =
  | "light" | "dark" | "sepia" | "purple"
  | "rose" | "orange" | "green" | "zinc"
  | "dracula" | "tokyo" | "nord" | "mocha" | "gruvbox";

export const themes: { key: Theme; label: string; bg: string; accent: string }[] = [
  { key: "light",   label: "Light",           bg: "#ffffff", accent: "#2563eb" },
  { key: "dark",    label: "Dark",             bg: "#0f172a", accent: "#3b82f6" },
  { key: "sepia",   label: "Sepia",            bg: "#fffbf5", accent: "#b45309" },
  { key: "purple",  label: "Purple",           bg: "#faf5ff", accent: "#7c3aed" },
  { key: "rose",    label: "Rose",             bg: "#fff1f2", accent: "#e11d48" },
  { key: "orange",  label: "Orange",           bg: "#fff7ed", accent: "#ea580c" },
  { key: "green",   label: "Green",            bg: "#f0fdf4", accent: "#16a34a" },
  { key: "zinc",    label: "Zinc",             bg: "#fafafa", accent: "#18181b" },
  { key: "dracula", label: "Dracula",          bg: "#282a36", accent: "#bd93f9" },
  { key: "tokyo",   label: "Tokyo Night",      bg: "#1a1b26", accent: "#7aa2f7" },
  { key: "nord",    label: "Nord",             bg: "#2e3440", accent: "#88c0d0" },
  { key: "mocha",   label: "Catppuccin Mocha", bg: "#1e1e2e", accent: "#cba6f7" },
  { key: "gruvbox", label: "Gruvbox",          bg: "#282828", accent: "#b8bb26" },
];

const saved = (localStorage.getItem("theme") as Theme) || "light";
document.documentElement.setAttribute("data-theme", saved);

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: saved,
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    set({ theme });
  },
}));
