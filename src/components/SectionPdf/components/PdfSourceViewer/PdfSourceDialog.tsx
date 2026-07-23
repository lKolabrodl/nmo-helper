import React, {useEffect, useMemo, useRef, useState} from 'react';
import type {PredictionSources} from 'med-pdf-nmo/browser';
import cn from 'classnames';
import {IconClose} from '../../../icons';
import {MODAL_WINDOW_DRAG_HANDLE_PROPS,	MODAL_WINDOW_DRAG_IGNORE_PROPS} from '../../../ModalWindow';
import HighlightedText from './HighlightedText';
import {
	getPageSourceMarks,
	getRelevantSourcePages,
	type PdfSourceMarkRole,
} from './source-text';

interface IPdfSourceDialogProps {
	readonly sources: PredictionSources;
	readonly onClose: () => void;
}

const PdfSourceDialog: React.FC<IPdfSourceDialogProps> = ({sources, onClose}) => {
	const pages = useMemo(() => getRelevantSourcePages(sources), [sources]);
	const [pageNumber, setPageNumber] = useState(pages[0]?.page ?? 0);
	const pageTextRef = useRef<HTMLDivElement>(null);
	const page = pages.find(item => item.page === pageNumber) ?? pages[0];
	const pageMarks = page ? getPageSourceMarks(sources, page) : [];

	useEffect(() => {
		const firstMark = pageTextRef.current?.querySelector<HTMLElement>('mark');
		if (firstMark && typeof firstMark.scrollIntoView === 'function') {
			firstMark.scrollIntoView({block: 'center'});
		}
	}, [pageNumber]);

	if (!page) return null;

	const highlightedLines = new HighlightedText(page.text, pageMarks).init();

	return (
		<>
			<header	className="nmo-pdf-source-header" {...MODAL_WINDOW_DRAG_HANDLE_PROPS}>

				<div className="nmo-pdf-source-heading">
					<h2 id="nmo-pdf-source-title">Источник в PDF</h2>
					<span>Страница {page.page}</span>
				</div>

				<div className="nmo-pdf-source-header-actions" {...MODAL_WINDOW_DRAG_IGNORE_PROPS}>
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
						{highlightedLines.map((line, lineIndex) => (
							<span key={lineIndex} className={getLineClassName(line.isHeading)}>
								{line.segments.map((segment, segmentIndex) => {
									const content = segment.isNumber
										? <span className="nmo-pdf-source-number">{segment.text}</span>
										: segment.text;

									return segment.role
										? (
											<mark key={segmentIndex} className={getMarkClassName(segment.role)}>
												{content}
											</mark>
										)
										: <React.Fragment key={segmentIndex}>{content}</React.Fragment>;
								})}
							</span>
						))}
					</div>
				</section>
			</div>
		</>
	);
};

export default PdfSourceDialog;

function getLineClassName(isHeading: boolean): string {
	return cn('nmo-pdf-source-sentence', {
		'nmo-pdf-source-sentence--heading': isHeading,
	});
}

function getMarkClassName(role: PdfSourceMarkRole): string {
	return cn('nmo-pdf-source-mark', `nmo-pdf-source-mark--${role}`);
}
