import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import cn from 'classnames';
import {
	constrainModalWindowLayout,
	getModalWindowViewport,
	loadModalWindowLayout,
	moveModalWindowLayout,
	resizeModalWindowFromBottomLeft,
	saveModalWindowLayout,
	type IModalWindowLayout,
	type IModalWindowSettings,
	type IModalWindowViewport,
} from './layout';
import './styles.scss';

export type {IModalWindowLayout, IModalWindowSettings} from './layout';

export const MODAL_WINDOW_DRAG_HANDLE_PROPS = {
	'data-nmo-modal-window-drag-handle': '',
} as const;

export const MODAL_WINDOW_DRAG_IGNORE_PROPS = {
	'data-nmo-modal-window-drag-ignore': '',
} as const;

export interface IModalWindowProps {
	readonly storageKey: string;
	readonly settings: IModalWindowSettings;
	readonly onClose: () => void;
	readonly children: React.ReactNode;
	readonly ariaLabel?: string;
	readonly ariaLabelledBy?: string;
	readonly className?: string;
	readonly portalTarget?: Element | DocumentFragment;
}

interface IModalWindowInteraction {
	readonly kind: 'drag' | 'resize';
	readonly pointerId: number;
	readonly pointerX: number;
	readonly pointerY: number;
	readonly layout: IModalWindowLayout;
	readonly viewport: IModalWindowViewport;
}

const DRAG_HANDLE_SELECTOR = '[data-nmo-modal-window-drag-handle]';
const DRAG_IGNORE_SELECTOR = '[data-nmo-modal-window-drag-ignore]';
const RESIZE_HANDLE_HIT_SIZE = 18;
const SAVE_LAYOUT_DELAY_MS = 150;

const ModalWindow: React.FC<IModalWindowProps> = ({
	storageKey,
	settings,
	onClose,
	children,
	ariaLabel,
	ariaLabelledBy,
	className,
	portalTarget,
}) => {

	const [layout, setLayout] = useState<IModalWindowLayout>(() => loadModalWindowLayout(storageKey, settings));

	const [interactionKind, setInteractionKind] = useState<IModalWindowInteraction['kind'] | null>(null);
	const modalRef = useRef<HTMLElement>(null);
	const layoutRef = useRef(layout);
	const settingsRef = useRef(settings);
	const interactionRef = useRef<IModalWindowInteraction | null>(null);
	layoutRef.current = layout;
	settingsRef.current = settings;

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') onClose();
		};

		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeyDown);
		modalRef.current?.focus();

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeyDown);
			previousFocus?.focus();
		};
	}, [onClose]);

	useEffect(() => {
		const handleResize = (): void => {
			interactionRef.current = null;
			setInteractionKind(null);
			setLayout(current => {
				const next = constrainModalWindowLayout(current, settingsRef.current);
				layoutRef.current = next;
				return next;
			});
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		const timeoutId = window.setTimeout(
			() => saveModalWindowLayout(storageKey, layout),
			SAVE_LAYOUT_DELAY_MS,
		);
		return () => window.clearTimeout(timeoutId);
	}, [layout, storageKey]);

	useEffect(() => () => saveModalWindowLayout(storageKey, layoutRef.current), [storageKey]);

	const handlePointerDown = (event: React.PointerEvent<HTMLElement>): void => {
		if (event.button !== 0) return;

		const modal = modalRef.current;
		if (!modal) return;

		const rect = modal.getBoundingClientRect();
		const layoutAtStart: IModalWindowLayout = {
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height,
		};
		const isResizeHandle = event.clientX >= rect.left
			&& event.clientX <= rect.left + RESIZE_HANDLE_HIT_SIZE
			&& event.clientY >= rect.bottom - RESIZE_HANDLE_HIT_SIZE
			&& event.clientY <= rect.bottom;

		let kind: IModalWindowInteraction['kind'];
		if (isResizeHandle) {
			kind = 'resize';
		} else {
			const target = event.target instanceof Element ? event.target : null;
			const dragHandle = target?.closest(DRAG_HANDLE_SELECTOR);
			const ignoredTarget = target?.closest(DRAG_IGNORE_SELECTOR);
			if (!dragHandle || dragHandle.closest('.nmo-modal-window') !== modal) return;
			if (ignoredTarget && ignoredTarget.closest('.nmo-modal-window') === modal) return;
			kind = 'drag';
		}

		interactionRef.current = {
			kind,
			pointerId: event.pointerId,
			pointerX: event.clientX,
			pointerY: event.clientY,
			layout: layoutAtStart,
			viewport: getModalWindowViewport(),
		};

		event.preventDefault();
		event.stopPropagation();
		if (typeof event.currentTarget.setPointerCapture === 'function') {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		setInteractionKind(kind);
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLElement>): void => {
		const interaction = interactionRef.current;
		if (!interaction || interaction.pointerId !== event.pointerId) return;

		event.preventDefault();
		event.stopPropagation();
		const deltaX = event.clientX - interaction.pointerX;
		const deltaY = event.clientY - interaction.pointerY;
		const next = interaction.kind === 'drag'
			? moveModalWindowLayout(
				interaction.layout,
				deltaX,
				deltaY,
				settingsRef.current,
				interaction.viewport,
			)
			: resizeModalWindowFromBottomLeft(
				interaction.layout,
				deltaX,
				deltaY,
				settingsRef.current,
				interaction.viewport,
			);
		layoutRef.current = next;
		setLayout(next);
	};

	const finishInteraction = (event: React.PointerEvent<HTMLElement>): void => {
		if (interactionRef.current?.pointerId !== event.pointerId) return;
		interactionRef.current = null;
		setInteractionKind(null);
		saveModalWindowLayout(storageKey, layoutRef.current);
	};

	const modalClassName = cn('nmo-modal-window', className, {
		'nmo-modal-window--dragging': interactionKind === 'drag',
		'nmo-modal-window--resizing': interactionKind === 'resize',
	});

	return createPortal(
		<div
			className="nmo-modal-window-backdrop"
			onMouseDown={event => {
				if (event.target === event.currentTarget) onClose();
			}}>
			<section
				ref={modalRef}
				className={modalClassName}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
				style={{
					left: layout.x,
					top: layout.y,
					width: layout.width,
					height: layout.height,
				}}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={finishInteraction}
				onPointerCancel={finishInteraction}
				onLostPointerCapture={finishInteraction}
				tabIndex={-1}>
				{children}
			</section>
		</div>,
		portalTarget ?? document.body,
	);
};

export default ModalWindow;
