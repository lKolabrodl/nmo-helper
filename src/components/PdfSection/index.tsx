import React, {useCallback, useRef, useState} from 'react';
import './styles.scss';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {usePdfScore} from '../../contexts/PdfScoreContext';
import {Status} from '../../types';
import {IconFile, IconClose, IconWarn} from '../icons';
import InlineToast, {type IToast} from '../ui/InlineToast';
import ThinkingStrip from '../ui/ThinkingStrip';
import PdfLoader, {type IPdfLoaderState} from '../Loader/PdfLoader';

const PdfSection: React.FC = (): React.JSX.Element => {
	// context
	const {status, setStatus} = usePanelStatus();
	const {topic, question, variants} = useQuestionFinder();
	const {clearPdfScore} = usePdfScore();
	// state
	const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);
	const [processing, setProcessing] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const _updateLoader = useCallback((state: IPdfLoaderState) => setProcessing(state.processing), []);

	const _handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.name.toLowerCase().endsWith('.pdf')) {
			setStatus({title: 'выберите PDF-файл', status: Status.ERR});
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			setPdfData((reader.result as ArrayBuffer).slice(0));
			setFileName(file.name);
			setStatus({title: 'PDF загружен', status: Status.OK});
		};
		reader.onerror = () => setStatus({title: 'не удалось прочитать файл', status: Status.ERR});
		reader.readAsArrayBuffer(file);
	};

	const _clearPdf = (): void => {
		clearPdfScore(topic, question, variants);
		setPdfData(null);
		setFileName(null);
		setProcessing(false);
		if (fileRef.current) fileRef.current.value = '';
		setStatus({title: '', status: Status.IDLE});
	};

	const isLoading = status.status === Status.LOADING;
	const isWarning = status.status === Status.WARN;
	const isError = status.status === Status.ERR;
	const isOk = status.status === Status.OK;

	return (
		<div className="nmo-section">
			<PdfLoader pdfData={pdfData} onChange={_updateLoader}/>

			<div className="nmo-section-inner">
				<div className="nmo-auto-hero nmo-fade-up">
					<div className="nmo-auto-hero-icon nmo-pdf-icon"><IconFile size={16}/></div>
					<div className="nmo-auto-hero-body">
						<div className="nmo-auto-hero-title">Клинические рекомендации</div>
						<div className="nmo-auto-hero-sub">
							Загрузите PDF с клиническими рекомендациями — ответы найдутся автоматически
						</div>
					</div>
				</div>

				{!fileName && <div className="nmo-pdf-accuracy nmo-fade-up">
					<div className="nmo-pdf-accuracy-icon"><IconWarn size={13}/></div>
					<div className="nmo-pdf-accuracy-text">
						PDF-режим экспериментальный: примерно 56-80% ответов могут быть правильными.
					</div>
				</div>}

				<div className="nmo-pdf-upload nmo-fade-up">
					{!fileName &&
						<label className="nmo-pdf-dropzone">
							<input ref={fileRef} type="file" accept=".pdf" className="nmo-pdf-file-input" onChange={_handleFile}/>
							<IconFile size={20}/>
							<span>Выбрать PDF-файл</span>
						</label>
					}
					{ !!fileName &&
						<div className="nmo-pdf-loaded">
							<IconFile size={14}/>
							<span className="nmo-pdf-name" title={fileName}>{fileName}</span>
							<button type="button" className="nmo-icon-btn" disabled={processing} onClick={_clearPdf}>
								<IconClose size={12}/>
							</button>
						</div>
					}
				</div>
			</div>

			{isLoading && <ThinkingStrip title="Анализирую PDF..." steps={['Извлекаю текст...', 'Индексирую...', 'Ищу ответ...']}/>}

			{(isWarning || isError || isOk) && !isLoading && status.title && (<InlineToast toast={statusToToast(status.title, status.status)}/>)}
		</div>
	);
};

export default PdfSection;

function statusToToast(title: string, s: typeof Status[keyof typeof Status]): IToast {
	if (s === Status.OK)  return {kind: 'success', title};
	if (s === Status.ERR) return {kind: 'danger',  title};
	return {kind: 'warning', title};
}
