// The providers, outermost first: a crash is caught above everything; the
// theme is settled before a screen paints; the session is known before any
// route decides whether to let someone in; the alert layer wraps the routes
// so window.confirm works from any screen.
//
// ThemeProvider sits INSIDE ErrorBoundary on purpose. The <html> class is
// already set by the script in index.html, so the crash screen is themed
// correctly whether or not this provider ever mounted.
import { BrowserRouter } from "react-router-dom";

import AppRoutes from "./routes/AppRoutes";
import ErrorBoundary from "./shared/components/ErrorBoundary";
import AlertProvider from "./shared/components/AlertProvider";
import { AuthProvider } from "./shared/contexts/AuthContext";
import { ThemeProvider } from "./shared/contexts/ThemeContext";

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AlertProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AlertProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
