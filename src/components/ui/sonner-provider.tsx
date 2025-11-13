"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        style: {
          fontSize: "0.95rem",
          padding: "0.75rem 1rem",
          borderRadius: "0.75rem",
        },
      }}
    />
  );
}

export default AppToaster;

