import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// 註冊 Service Worker（PWA App Shell 快取）
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 開發環境或瀏覽器不支援時靜默略過
    });
  });
}
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import ScrollToTop from "./components/ScrollToTop";
import { MissavLocaleProvider } from "./context/MissavLocaleContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <MissavLocaleProvider>
        <App />
      </MissavLocaleProvider>
    </BrowserRouter>
  </StrictMode>
);
