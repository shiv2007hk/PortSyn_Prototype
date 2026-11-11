import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/hooks";
import { AuthProvider } from "@/lib/auth";
import { App } from "./App";
import "./index.css";

function Shell() {
  return (
    <>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
      <Toaster
        theme="light"
        position="top-right"
        closeButton
        toastOptions={{
          style: {
            background: "#FFFFFF",
            border: "1px solid #DCE5ED",
            color: "#102A43",
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
        <Shell />
      </AuthProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
