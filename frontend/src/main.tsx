import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/hooks";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { App } from "./App";
import "./index.css";

function Shell() {
  const { theme } = useTheme();
  return (
    <>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
      <Toaster
        theme={theme}
        position="top-right"
        closeButton
        toastOptions={{
          style: {
            background: theme === "dark" ? "#0F2032" : "#FFFFFF",
            border: `1px solid ${theme === "dark" ? "rgba(148,163,184,0.22)" : "#DCE5ED"}`,
            color: theme === "dark" ? "#F8FAFC" : "#102A43",
            fontSize: "12.5px",
          },
        }}
      />
    </>
  );
}

export function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
