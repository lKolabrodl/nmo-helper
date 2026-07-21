import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {PredictionSources} from 'med-pdf-nmo/browser';
import {IconClose} from '../../../icons';
import {
	constrainPdfSourceDialogLayout,
	getPdfSourceDialogViewport,
	loadPdfSourceDialogLayout,
	PDF_SOURCE_DIALOG_MARGIN,
	savePdfSourceDialogLayout,
	type IPdfSourceDialogLayout,
} from './dialog-layout';
import {
	getPageSourceMarks,
	getRelevantSourcePages,
	splitPdfSourceTextIntoLines,
	type IPdfSourceTextMark,
	type PdfSourceMarkRole,
} from './source-text';

interface IPdfSourceDialogProps {
	readonly sources: PredictionSources;
	readonly onClose: () => void;
}

interface IDialogDragState {
	readonly pointerId: number;
	readonly pointerX: number;
	readonly pointerY: number;
	readonly left: number;
	readonly top: number;
	readonly minLeft: number;
	readonly maxLeft: number;
	readonly minTop: number;
	readonly maxTop: number;
}

const HEADER_ACTIONS_SELECTOR = '.nmo-pdf-source-header-actions';
const SAVE_LAYOUT_DELAY_MS = 150;

const PdfSourceDialog: React.FC<IPdfSourceDialogProps> = ({sources, onClose}) => {
	const pages = useMemo(() => getRelevantSourcePages(sources), [sources]);
	const [pageNumber, setPageNumber] = useState(pages[0]?.page ?? 0);
	const [dialogLayout, setDialogLayout] = useState<IPdfSourceDialogLayout>(loadPdfSourceDialogLayout);
	const [isDragging, setIsDragging] = useState(false);
	const dialogRef = useRef<HTMLElement>(null);
	const pageTextRef = useRef<HTMLDivElement>(null);
	const dragStateRef = useRef<IDialogDragState | null>(null);
	const dialogLayoutRef = useRef(dialogLayout);
	dialogLayoutRef.current = dialogLayout;
	const page = pages.find(item => item.page === pageNumber) ?? pages[0];
	const pageMarks = page ? getPageSourceMarks(sources, page) : [];

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') onClose();
		};

		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeyDown);
		dialogRef.current?.focus();

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeyDown);
			previousFocus?.focus();
		};
	}, [onClose]);

	useEffect(() => {
		const handleResize = (): void => {
			dragStateRef.current = null;
			setIsDragging(false);
			setDialogLayout(current => constrainPdfSourceDialogLayout(current));
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	useEffect(() => {
		const timeoutId = window.setTimeout(
			() => savePdfSourceDialogLayout(dialogLayout),
			SAVE_LAYOUT_DELAY_MS,
		);
		return () => window.clearTimeout(timeoutId);
	}, [dialogLayout]);

	useEffect(() => () => savePdfSourceDialogLayout(dialogLayoutRef.current), []);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog || typeof ResizeObserver !== 'function') return;

		const observer = new ResizeObserver(() => {
			const rect = dialog.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return;

			setDialogLayout(current => {
				const next = constrainPdfSourceDialogLayout({
					...current,
					width: rect.width,
					height: rect.height,
				});
				return hasSameDialogLayout(current, next) ? current : next;
			});
		});

		observer.observe(dialog);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const firstMark = pageTextRef.current?.querySelector<HTMLElement>('mark');
		if (firstMark && typeof firstMark.scrollIntoView === 'function') {
			firstMark.scrollIntoView({block: 'center'});
		}
	}, [pageNumber]);

	if (!page) return null;

	const handleHeaderPointerDown = (event: React.PointerEvent<HTMLElement>): void => {
		if (event.button !== 0) return;
		if (event.target instanceof Element && event.target.closest(HEADER_ACTIONS_SELECTOR)) return;

		const dialog = dialogRef.current;
		if (!dialog) return;

		const rect = dialog.getBoundingClientRect();
		const viewport = getPdfSourceDialogViewport();
		dragStateRef.current = {
			pointerId: event.pointerId,
			pointerX: event.clientX,
			pointerY: event.clientY,
			left: dialogLayout.left,
			top: dialogLayout.top,
			minLeft: PDF_SOURCE_DIALOG_MARGIN,
			maxLeft: Math.max(PDF_SOURCE_DIALOG_MARGIN, viewport.width - PDF_SOURCE_DIALOG_MARGIN - rect.width),
			minTop: PDF_SOURCE_DIALOG_MARGIN,
			maxTop: Math.max(PDF_SOURCE_DIALOG_MARGIN, viewport.height - PDF_SOURCE_DIALOG_MARGIN - rect.height),
		};

		event.preventDefault();
		if (typeof event.currentTarget.setPointerCapture === 'function') {
			event.currentTarget.setPointerCapture(event.pointerId);
		}
		setIsDragging(true);
	};

	const handleHeaderPointerMove = (event: React.PointerEvent<HTMLElement>): void => {
		const dragState = dragStateRef.current;
		if (!dragState || dragState.pointerId !== event.pointerId) return;

		event.preventDefault();
		setDialogLayout(current => ({
			...current,
			left: clamp(
				dragState.left + event.clientX - dragState.pointerX,
				dragState.minLeft,
				dragState.maxLeft,
			),
			top: clamp(
				dragState.top + event.clientY - dragState.pointerY,
				dragState.minTop,
				dragState.maxTop,
			),
		}));
	};

	const finishDragging = (event: React.PointerEvent<HTMLElement>): void => {
		if (dragStateRef.current?.pointerId !== event.pointerId) return;
		dragStateRef.current = null;
		setIsDragging(false);
		savePdfSourceDialogLayout(dialogLayoutRef.current);
	};

	return (
		<div
			className="nmo-pdf-source-backdrop"
			onMouseDown={event => {
				if (event.target === event.currentTarget) onClose();
			}}>
			<section
				ref={dialogRef}
				className={`nmo-pdf-source-dialog${isDragging ? ' nmo-pdf-source-dialog--dragging' : ''}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="nmo-pdf-source-title"
				style={{
					left: dialogLayout.left,
					top: dialogLayout.top,
					width: dialogLayout.width,
					height: dialogLayout.height,
				}}
				tabIndex={-1}>
				<header
					className="nmo-pdf-source-header"
					onPointerDown={handleHeaderPointerDown}
					onPointerMove={handleHeaderPointerMove}
					onPointerUp={finishDragging}
					onPointerCancel={finishDragging}
					onLostPointerCapture={finishDragging}>
					<div className="nmo-pdf-source-heading">
						<h2 id="nmo-pdf-source-title">Источник в PDF</h2>
						<span>Страница {page.page}</span>
					</div>

					<div className="nmo-pdf-source-header-actions">
						{pages.length > 1 && (
							<label className="nmo-pdf-source-page-picker">
								<span>Страница</span>
								<select
									aria-label="Страница PDF"
									value={page.page}
									onChange={event => setPageNumber(Number(event.target.value))}>
									{pages.map(item => <option key={item.page} value={item.page}>{item.page}</option>)}
								</select>
							</label>
						)}
						<button
							type="button"
							className="nmo-pdf-source-close"
							title="Закрыть"
							aria-label="Закрыть источник"
							onClick={onClose}>
							<IconClose size={16}/>
						</button>
					</div>
				</header>

				<div className="nmo-pdf-source-legend" aria-label="Обозначения подсветки">
					<span><i className="question"/>Вопрос</span>
					<span><i className="answer"/>Ответ</span>
				</div>

				<div className="nmo-pdf-source-body">
					<section className="nmo-pdf-source-page" aria-label={`Полный текст страницы ${page.page}`}>
						<div className="nmo-pdf-source-page-title">
							<strong>Полный текст страницы {page.page}</strong>
						</div>
						<div ref={pageTextRef} className="nmo-pdf-source-page-text">
							<HighlightedText text={page.text} marks={pageMarks}/>
						</div>
					</section>
				</div>
			</section>
		</div>
	);
};

export default PdfSourceDialog;

const HighlightedText: React.FC<{readonly text: string; readonly marks: readonly IPdfSourceTextMark[]}> = ({text, marks}) => (
	<>
		{splitPdfSourceTextIntoLines(text, marks).map((line, lineIndex) => (
			<span key={lineIndex} className="nmo-pdf-source-sentence">
				{line.map((segment, segmentIndex) => segment.role
					? <mark key={segmentIndex} className={getMarkClassName(segment.role)}>{segment.text}</mark>
					: <React.Fragment key={segmentIndex}>{segment.text}</React.Fragment>
				)}
			</span>
		))}
	</>
);

function getMarkClassName(role: PdfSourceMarkRole): string {
	return `nmo-pdf-source-mark nmo-pdf-source-mark--${role}`;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function hasSameDialogLayout(left: IPdfSourceDialogLayout, right: IPdfSourceDialogLayout): boolean {
	return left.left === right.left
		&& left.top === right.top
		&& left.width === right.width
		&& left.height === right.height;
}
