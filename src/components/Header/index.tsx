import React, {useLayoutEffect, useRef, useState} from 'react';
import './styles.scss';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {usePanelStatus} from '../../contexts/PanelStatusContext';
import {useQuestionFinder} from '../../contexts/QuestionFinderContext';
import {IconBug, IconClose, IconMinimize, IconWarn} from '../icons';
import VersionCheck from '../VersionCheck';
import BugReportButton from '../BugReportButton';
import type {IVersionInfo} from '../../api/version-check';

const Header: React.FC = () => {
	const {setCollapsed} = usePanelUi();
	const {topic, question, variants} = useQuestionFinder();
	const {status} = usePanelStatus();

	const [update, setUpdate] = useState<IVersionInfo | null>(null);
	const [bugOpen, setBugOpen] = useState(false);

	const canReport = !!question && variants.length > 0;

	return (
		<>
			<div className="nmo-titlebar">
				<div className="nmo-brand">
					<span className={`nmo-brand-dot ${status.status}`}/>
					<span className="nmo-brand-name">NMO Helper</span>
					<VersionCheck onOutdated={setUpdate}/>
				</div>
				<div className="nmo-titlebar-ctrl">
					{canReport && (
						<button type="button"
							className={`nmo-icon-btn nmo-titlebar-bug ${status.status}`}
							title="Сообщить о проблеме"
							onClick={() => setBugOpen(o => !o)}>
							<IconBug size={14}/>
						</button>
					)}
					<button type="button"
						className="nmo-icon-btn"
						title="Свернуть"
						onClick={() => setCollapsed(true)}>
						<IconMinimize size={14}/>
					</button>
				</div>
			</div>

			{update &&
				<UpdateBanner info={update} onClose={() => setUpdate(null)}/>
			}

			{canReport && (
				<BugReportButton hideTrigger isOpen={bugOpen} onClose={() => setBugOpen(false)}/>
			)}

			<TopicBlock topic={topic}/>
		</>
	);
};

export default Header;


const TopicBlock: React.FC<{topic: string | null}> = ({topic}) => {
	const titleRef = useRef<HTMLDivElement>(null);
	const [expanded, setExpanded] = useState(false);
	const [overflow, setOverflow] = useState(false);

	// при смене темы — заново скрываем и пересчитываем overflow
	useLayoutEffect(() => {
		setExpanded(false);
	}, [topic]);

	useLayoutEffect(() => {
		const el = titleRef.current;
		if (!el || expanded) return;
		setOverflow(el.scrollHeight > el.clientHeight + 1);
	}, [topic, expanded]);

	if (!topic) {
		return (
			<div className="nmo-topic">
				<div className="nmo-topic-overline nmo-topic-overline-muted">
					<span className="nmo-topic-overline-dot"/>
					Тест не определён
				</div>
				<div className="nmo-topic-hint">Откройте страницу с вопросами НМО</div>
			</div>
		);
	}

	return (
		<div className="nmo-topic">
			<div className="nmo-topic-overline">
				<span className="nmo-topic-overline-dot"/>
				Определён тест
			</div>
			<div ref={titleRef}
				className={`nmo-topic-title ${expanded ? 'expanded' : ''}`}
				onClick={() => overflow && setExpanded(!expanded)}
				title={overflow ? topic : undefined}>
				{topic}
			</div>
			{overflow && (
				<button type="button"
					className="nmo-topic-toggle"
					onClick={() => setExpanded(!expanded)}>
					{expanded ? 'свернуть ←' : 'показать полностью →'}
				</button>
			)}
		</div>
	);
};


const UpdateBanner: React.FC<{info: IVersionInfo; onClose: () => void}> = ({info, onClose}) => (
	<div className="nmo-update-banner nmo-fade-up">
		<div className="nmo-update-icon">
			<IconWarn size={11}/>
		</div>
		<div className="nmo-update-body">
			<div className="nmo-update-title">Доступна v{info.latest}</div>
			<div className="nmo-update-sub">у вас v{info.current} — обновите расширение</div>
		</div>
		<button type="button" className="nmo-icon-btn nmo-update-close" onClick={onClose}>
			<IconClose size={12}/>
		</button>
	</div>
);
