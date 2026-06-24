import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ maxWidth: 720, margin: '80px auto', padding: 24, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          <h1 style={{ marginBottom: 12 }}>页面加载失败</h1>
          <p style={{ lineHeight: 1.8 }}>
            页面渲染时遇到一条异常数据或运行错误，数据没有被清空。请先刷新页面；如果仍然失败，把下面这段错误发给我。
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', border: '1px solid #eadfd2', borderRadius: 8, padding: 16, color: '#9f2d20' }}>
            {this.state.error.message}
          </pre>
          <button
            style={{ marginTop: 16, padding: '10px 16px', borderRadius: 8, border: 'none', background: '#1f6f5b', color: '#fff', cursor: 'pointer' }}
            onClick={() => window.location.reload()}
            type="button"
          >
            刷新页面
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
