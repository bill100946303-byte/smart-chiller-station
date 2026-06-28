import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import GlobalErrorBoundary from "./components/common/GlobalErrorBoundary";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/dashboard-chain-map.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <GlobalErrorBoundary>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </GlobalErrorBoundary>
);
