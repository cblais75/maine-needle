import React from "react";

// Theme colors mirrored from MaineDashboard so the fallback matches the site.
const C = { panel: "#161E2E", line: "#28344A", text: "#E6ECF5", muted: "#8A97AD", red: "#F2585B" };
const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

// Catches render-time crashes in whatever it wraps, so one broken piece shows a
// small fallback instead of white-screening the whole site. React error
// boundaries must be class components (getDerivedStateFromError / componentDidCatch).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // Surface it in the console for debugging; never rethrow.
    if (typeof console !== "undefined") console.error("Panel error:", error, info);
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    const mini = this.props.mini;
    return (
      <div style={{
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderLeft: `3px solid ${C.red}`,
        borderRadius: mini ? 10 : 12,
        padding: mini ? "10px 12px" : "14px 16px",
        color: C.muted,
        fontFamily: mono,
        fontSize: mini ? 11.5 : 12.5,
        lineHeight: 1.5,
      }}>
        <div style={{ color: C.text, fontWeight: 700, marginBottom: 3 }}>
          {this.props.label || "This part hit an error"}
        </div>
        The rest of the site is unaffected.
      </div>
    );
  }
}
