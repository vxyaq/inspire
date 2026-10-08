import ReactDOM from "react-dom/client"
import App from "./App"
import ErrorBoundary from "./components/ErrorBoundary"
import { HashRouter } from "react-router-dom"

const rootElement = document.getElementById("root")
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <HashRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </HashRouter>,
  )
}
