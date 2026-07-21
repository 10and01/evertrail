import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Evertrail UI failed:', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="min-h-screen grid place-items-center bg-et-bg p-6 text-et-text">
          <section className="storybook-panel max-w-lg text-center">
            <p className="eyebrow">旅程暂时停下了</p>
            <h1 className="font-display text-2xl text-et-gold">这段记忆没有顺利展开</h1>
            <p className="mt-3 text-sm text-et-muted">
              数据仍保存在本机。重新载入页面即可再次进入；若问题持续，请先从设置中导出备份。
            </p>
            <button type="button" className="story-button mt-5" onClick={() => window.location.reload()}>
              重新进入
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
