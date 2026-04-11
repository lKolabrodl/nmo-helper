import React, { useState, useEffect, useRef } from 'react';
import './styles.scss';
import { AI_MODELS } from '../../utils/constants';
import type { IAiModel } from '../../types';

const ModelDropdown = ({ model, setModel }: { model: string; setModel: (v: string) => void }) => {
	const [open, setOpen] = useState(false);
	const selectedRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const current = AI_MODELS.find(m => m.id === model);

	useEffect(() => {
		const close = () => setOpen(false);
		document.addEventListener('click', close);
		return () => document.removeEventListener('click', close);
	}, []);

	useEffect(() => {
		if (open && selectedRef.current && listRef.current) {
			const rect = selectedRef.current.getBoundingClientRect();
			listRef.current.style.left = rect.left + 'px';
			listRef.current.style.top = rect.bottom + 'px';
			listRef.current.style.width = rect.width + 'px';
		}
	}, [open]);

	const handleToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		setOpen(!open);
	};

	const handleSelect = (m: IAiModel) => {
		setModel(m.id);
		setOpen(false);
	};

	return (
		<div className={`nmo-dropdown ${open ? 'open' : ''}`}>
			<div className="nmo-dropdown-selected" ref={selectedRef} onClick={handleToggle}>
				{current && (
					<>
						<span className="nmo-model-name">{current.name}</span>
						<SelectedTag tag={current.tag} />
						<span className={`nmo-tier nmo-tier-${current.tier}`}>{current.tier}</span>
					</>
				)}
			</div>
			<div className="nmo-dropdown-list" ref={listRef}>
				{AI_MODELS.map(m => (
					<div
						key={m.id}
						className="nmo-dropdown-item"
						data-tag={m.tag || undefined}
						onClick={() => handleSelect(m)}>
						<span className="nmo-di-name">{m.name}</span>
						<ModelTag tag={m.tag} />
						<span className={`nmo-di-tier nmo-di-tier-${m.tier}`}>{m.tier}</span>
					</div>
				))}
			</div>
		</div>
	);
};

export default ModelDropdown;


const ModelTag = ({ tag }: { tag?: string }) => {
	if (tag === 'rec') return <span className="nmo-di-tag nmo-di-tag-rec">{'\u2605'}</span>;
	if (tag === 'pricey') return <span className="nmo-di-tag nmo-di-tag-pricey">$$$</span>;
	return null;
};

const SelectedTag = ({ tag }: { tag?: string }) => {
	if (tag === 'rec') return <span className="nmo-tag nmo-tag-rec">{'\u2605'}</span>;
	if (tag === 'pricey') return <span className="nmo-tag nmo-tag-pricey">$$$</span>;
	return null;
};