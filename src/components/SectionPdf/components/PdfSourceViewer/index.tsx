import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePdfScore} from '../../../../contexts/PdfScoreContext';
import {useQuestionFinder} from '../../../../contexts/QuestionFinderContext';
import {IconFile} from '../../../icons';
import ModalWindow, {type IModalWindowSettings} from '../../../ModalWindow';
import PdfSourceDialog from './PdfSourceDialog';
import {ensurePdfSourceHost, removePdfSourceHost} from './dom';
import {getRelevantSourcePages} from './source-text';
import './styles.scss';

export const PDF_SOURCE_DIALOG_STORAGE_KEY = 'nmo-helper:pdf-source-dialog-layout:v1';
export const PDF_SOURCE_DIALOG_SETTINGS = {
	width: 920,
	height: 720,
	minWidth: 400,
	minHeight: 300,
	verticalOverflowRatio: 0.5,
} satisfies IModalWindowSettings;

const PdfSourceViewer: React.FC = () => {
	//context
	const {topic, question, variants} = useQuestionFinder();
	const {getPdfScore} = usePdfScore();
	// state
	const [host, setHost] = useState<HTMLElement | null>(null);
	const [open, setOpen] = useState(false);

	const model = getPdfScore(topic, question, variants);
	const sources = model?.sources ?? null;

	const pages = useMemo(() => sources ? getRelevantSourcePages(sources) : [], [sources]);
	const enabled = pages.length > 0;

	// закрываем принудительно
	useEffect(() => setOpen(false), [model?.id, model?.updatedAt]);

	useEffect(() => {
		if (!enabled) {
			removePdfSourceHost();
			setHost(null);
			return;
		}

		let disposed = false;
		const syncHost = (): void => {
			if (disposed) return;
			setHostIfChanged(setHost, ensurePdfSourceHost());
		};

		syncHost();
		const observer = new MutationObserver(syncHost);
		observer.observe(document.body, {childList: true, subtree: true});

		return () => {
			disposed = true;
			observer.disconnect();
			removePdfSourceHost();
		};
	}, [enabled]);



	const title = pages.length === 1
		? `Показать источник в PDF, страница ${pages[0].page}`
		: 'Показать источники в PDF';

	const _onClose = useCallback(() => setOpen(false), []);

	return (
		<>
			{host && enabled && createPortal(
				<button
					type="button"
					className="nmo-pdf-source-trigger"
					title={title}
					aria-label={title}
					onClick={() => setOpen(true)}>
					<IconFile size={14}/>
				</button>,
				host
			)}

			{open && sources && (
				<ModalWindow
					key={`${model?.id ?? 'pdf-source'}-${model?.updatedAt ?? 0}`}
					storageKey={PDF_SOURCE_DIALOG_STORAGE_KEY}
					settings={PDF_SOURCE_DIALOG_SETTINGS}
					className="nmo-pdf-source-dialog"
					ariaLabelledBy="nmo-pdf-source-title"
					onClose={_onClose}>
					<PdfSourceDialog sources={sources} onClose={_onClose}/>
				</ModalWindow>
			)}
		</>
	);
};

export default PdfSourceViewer;

function setHostIfChanged(setHost: React.Dispatch<React.SetStateAction<HTMLElement | null>>,nextHost: HTMLElement | null): void {
	setHost(currentHost => currentHost === nextHost ? currentHost : nextHost);
}
