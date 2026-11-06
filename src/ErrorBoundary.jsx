import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('App rendering failed', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="center">
          <div className="card narrow" role="alert">
            <h1>Something went wrong</h1>
            <p className="muted">The page hit an unexpected error. Reload to try again.</p>
            <button className="btn primary" onClick={() => window.location.reload()}>Reload page</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
