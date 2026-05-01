import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import './styles.scss';
import {AI_MODELS} from '../../utils/constants';
import type {IAiModel} from '../../types';
import {IconChevronDown, IconStar} from '../icons';

interface IProps {
	readonly model: string;
	readonly setModel: (v: string) => void;
	readonly disabled?: boolean;
}

interface IPos {
	readonly left: number;
	readonly top: number;
	readonly width: number;
}

const ZERO: IPos = {left: 0, top: 0, width: 0};

const ModelDropdown: React.FC<IProps> = ({model, setModel, disabled}) => {
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState<IPos>(ZERO);
	const wrapRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const current = AI_MODELS.find(m => m.id === model);

	const recalc = () => {
		if (!wrapRef.current) return;
		const rect = wrapRef.current.getBoundingClientRect();
		setPos({left: rect.left, top: rect.bottom + 4, width: rect.width});
	};

	const toggle = () => {
		if (disabled) return;
		if (!open) recalc();
		setOpen(o => !o);
	};

	// клик вне закрывает; resize пересчитывает позицию
	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent) => {
			const t = e.target as Node;
			if (wrapRef.current?.contains(t)) return;
			if (listRef.current?.contains(t)) return;
			setOpen(false);
		};
		// откладываем подписку, чтобы тот же click, который открыл список, не закрыл его
		const id = setTimeout(() => document.addEventListener('mousedown', close), 0);
		window.addEventListener('resize', recalc);
		return () => {
			clearTimeout(id);
			document.removeEventListener('mousedown', close);
			window.removeEventListener('resize', recalc);
		};
	}, [open]);

	const handleSelect = (m: IAiModel) => {
		setModel(m.id);
		setOpen(false);
	};

	const list = open ? (
		<div className="nmo-md-list nmo-fade-up"
			ref={listRef}
			style={{left: pos.left, top: pos.top, width: pos.width}}>
			{AI_MODELS.map(m => (
				<button key={m.id} type="button"
					className={`nmo-md-item ${m.id === model ? 'selected' : ''}`}
					onClick={() => handleSelect(m)}>
					<span className="nmo-md-item-name">
						<span>{m.name}</span>
						{m.tag === 'rec' && <IconStar size={9} className="nmo-md-rec"/>}
						{m.tag === 'pricey' && <span className="nmo-md-pricey">$$$</span>}
					</span>
					<Tier tier={m.tier}/>
				</button>
			))}
		</div>
	) : null;

	return (
		<div className={`nmo-md ${open ? 'open' : ''}`} ref={wrapRef}>
			<button type="button"
				className="nmo-md-selected"
				disabled={disabled}
				onClick={toggle}>
				<span className="nmo-md-name">
					<span>{current?.name ?? model}</span>
					{current?.tag === 'rec' && <IconStar size={10} className="nmo-md-rec"/>}
					{current?.tag === 'pricey' && <span className="nmo-md-pricey">$$$</span>}
				</span>
				<span className="nmo-md-meta">
					{current && <Tier tier={current.tier}/>}
					<IconChevronDown size={14} className="nmo-md-chev"/>
				</span>
			</button>

			{list && createPortal(list, document.body)}
		</div>
	);
};

export default ModelDropdown;

const TIER_LABEL: Record<string, string> = {
	low:    'LOW',
	medium: 'MED',
	high:   'HIGH',
	ultra:  'ULTRA',
};

const Tier: React.FC<{tier: IAiModel['tier']}> = ({tier}) => (
	<span className={`nmo-tier ${tier}`}>{TIER_LABEL[tier] ?? tier.toUpperCase()}</span>
);
