import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {usePdfScore} from '../../contexts/PdfScoreContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {IconFile} from '../icons';
import PdfSourceDialog from './PdfSourceDialog';
import {ensurePdfSourceHost, removePdfSourceHost} from './dom';
import {getRelevantSourcePages} from './source-text';
import './styles.scss';

const PdfSourceViewer: React.FC = () => {
	const {mode} = usePanelUi();
	const {topic, question, variants} = useQuestionFinder();
	const {getPdfScore} = usePdfScore();
	const model = mode === 'pdf' ? getPdfScore(topic, question, variants) : null;
	const sources = model?.sources ?? null;
	const pages = useMemo(() => sources ? getRelevantSourcePages(sources) : [], [sources]);
	const [host, setHost] = useState<HTMLElement | null>(null);
	const [open, setOpen] = useState(false);
	const close = useCallback(() => setOpen(false), []);
	const enabled = mode === 'pdf' && pages.length > 0;

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

	useEffect(() => {
		setOpen(false);
	}, [mode, model?.id, model?.updatedAt]);

	const title = pages.length === 1
		? `Показать источник в PDF, страница ${pages[0].page}`
		: 'Показать источники в PDF';

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

			{open && sources && createPortal(
				<PdfSourceDialog
					key={`${model?.id ?? 'pdf-source'}-${model?.updatedAt ?? 0}`}
					sources={sources}
					onClose={close}/>,
				document.body
			)}
		</>
	);
};

export default PdfSourceViewer;

function setHostIfChanged(
	setHost: React.Dispatch<React.SetStateAction<HTMLElement | null>>,
	nextHost: HTMLElement | null,
): void {
	setHost(currentHost => currentHost === nextHost ? currentHost : nextHost);
}
