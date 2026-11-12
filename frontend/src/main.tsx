import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/hooks";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider, useTheme } from "@/lib/theme";
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
            background: theme === "dark" ? "#16263B" : "#FFFFFF",
            border: theme === "dark" ? "1px solid #24374D" : "1px solid #DCE5ED",
            color: theme === "dark" ? "#E8F0FA" : "#102A43",
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
      <AuthProvider>
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
