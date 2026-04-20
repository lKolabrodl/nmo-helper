import React from 'react';

interface IErrorBoundary {
	readonly hasError: boolean;
	readonly message: string;
}

/**
 * Ловит ошибки рендера в дочерних компонентах.
 * Показывает inline-сообщение вместо полного краша панели.
 */
class ErrorBoundary extends React.Component<React.PropsWithChildren, IErrorBoundary> {
	state: IErrorBoundary = { hasError: false, message: '' };

	static getDerivedStateFromError(error: Error): IErrorBoundary {
		return { hasError: true, message: error.message || 'неизвестная ошибка' };
	}

	public componentDidCatch(error: Error, info: React.ErrorInfo) {
		console.error('[NMO] ErrorBoundary:', error, info.componentStack);
	}

	public render() {
		if (this.state.hasError) return (<div className="nmo-error-boundary">ошибка: {this.state.message}</div>);
		return this.props.children;
	}
}

export default ErrorBoundary;
