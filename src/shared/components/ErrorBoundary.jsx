// A thrown render error takes out one screen, not the whole console. Without
// this, a bad response or a stale chunk after a deploy blanks the browser tab
// and the person has no way back but the address bar.
import { Component } from "react";
import { HiExclamationCircle } from "react-icons/hi";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Nothing to send it to yet; the console is where a developer will look.
    console.error("Console crashed:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F8F7FB] flex items-center justify-center p-6 font-sans dark:bg-night-950">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-8 max-w-md text-center dark:bg-night-850 dark:border-night-700 dark:shadow-none">
          <span className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 dark:bg-rose-500/15 dark:text-rose-300">
            <HiExclamationCircle className="w-6 h-6" />
          </span>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">This page stopped working</h1>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed dark:text-slate-400">
            Nothing you did caused it, and nothing was changed. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
