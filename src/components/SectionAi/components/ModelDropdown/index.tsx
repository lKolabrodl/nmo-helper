import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import cn from 'classnames';
import './styles.scss';
import type {IAiModel} from '../../../../types';
import {formatQuestionCost} from '../../../../utils/ai-model-cost';
import {IconChevronDown, IconStar} from '../../../icons';

interface IModelDropdownProps {
	readonly models: readonly IAiModel[];
	readonly model: string;
	readonly setModel: (v: string) => void;
	readonly disabled?: boolean;
	readonly loading?: boolean;
}

interface IPos {
	readonly left: number;
	readonly top: number;
	readonly width: number;
}

const ZERO: IPos = {left: 0, top: 0, width: 0};

const ModelDropdown: React.FC<IModelDropdownProps> = ({models, model, setModel, disabled, loading}) => {

	const [open, setOpen] = useState<boolean>(false);
	const [pos, setPos] = useState<IPos>(ZERO);
	const [search, setSearch] = useState('');

	const wrapRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const current = models.find(m => m.id === model);
	const query = search.trim().toLocaleLowerCase('ru');
	const filteredModels = models.filter(m => `${m.name} ${m.id} ${m.vendor}`.toLocaleLowerCase('ru').includes(query));

	const recalc = () => {
		if (!buttonRef.current) return;
		const rect = buttonRef.current.getBoundingClientRect();
		setPos({left: rect.left, top: rect.bottom, width: rect.width});
	};

	const toggle = () => {
		if (disabled) return;
		if (!open) {
			recalc();
			setSearch('');
		}
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
		const keydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
				buttonRef.current?.focus();
			}
		};
		document.addEventListener('keydown', keydown);
		window.addEventListener('resize', recalc);
		return () => {
			clearTimeout(id);
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', keydown);
			window.removeEventListener('resize', recalc);
		};
	}, [open]);

	useEffect(() => {
		if (disabled) setOpen(false);
	}, [disabled]);

	const handleSelect = (m: IAiModel) => {
		setModel(m.id);
		setOpen(false);
		buttonRef.current?.focus();
	};

	const list = (
		<div ref={listRef} className="nmo-md-list nmo-fade-up" style={{left: pos.left, top: pos.top, width: pos.width}}>
			<div className="nmo-md-search">
				<input className="nmo-input" type="search" aria-label="Поиск модели" placeholder="Поиск модели…" value={search} onChange={event => setSearch(event.target.value)} autoFocus/>
				<div className="nmo-md-caption">Примерная цена одного вопроса</div>
			</div>
			<div className="nmo-md-options" id="nmo-ai-proxy-model-list" role="listbox" aria-label="Модели ProxyAPI">
				{filteredModels.map(m => (
					<button key={m.id} type="button" role="option" aria-selected={m.id === model}
						className={cn('nmo-md-item', {selected: m.id === model})}
						title={modelTitle(m)} onClick={() => handleSelect(m)}>
						<span className="nmo-md-item-info">
							<span className="nmo-md-item-name">
								<span className="nmo-md-model-label">{m.name}</span>
								<ModelBadge model={m}/>
							</span>
							<span className="nmo-md-price">{m.vendor} · {formatQuestionCost(m)}</span>
						</span>
						{m.tier && <Tier tier={m.tier}/>}
					</button>
				))}
				{!filteredModels.length && <div className="nmo-md-empty" role="status">Модели не найдены</div>}
			</div>
		</div>
	);

	return (
		<div className={cn('nmo-md', {open})} ref={wrapRef}>
			<button type="button"
				id="nmo-ai-proxy-model" ref={buttonRef} role="combobox"
				aria-expanded={open} aria-controls="nmo-ai-proxy-model-list" aria-haspopup="listbox"
				className="nmo-md-selected"
				disabled={disabled}
				onClick={toggle}>
				<span className="nmo-md-name">
					<span className="nmo-md-model-label">{current?.name ?? (model || (loading ? 'загружаю модели…' : 'выберите модель'))}</span>
					{current && <ModelBadge model={current}/>}
				</span>
				<span className="nmo-md-meta">
					{current?.tier && <Tier tier={current.tier}/>}
					<IconChevronDown size={14} className="nmo-md-chev"/>
				</span>
			</button>
			{current && <div className="nmo-md-current-price" title={modelTitle(current)}>
				{formatQuestionCost(current)}
				<div className="nmo-md-price-note">{current.reasoning
					? 'Ориентир с запасом на рассуждения. Итоговая цена может отличаться.'
					: 'Ориентир для типового вопроса. Цена зависит от его длины.'}</div>
			</div>}

			{open && createPortal(list, document.body)}
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

const Tier: React.FC<{tier: NonNullable<IAiModel['tier']>}> = ({tier}) => (
	<span className={cn('nmo-tier', tier)} title="Уровень стоимости относительно других моделей">{TIER_LABEL[tier]}</span>
);

const ModelBadge: React.FC<{model: IAiModel}> = ({model}) => (
	<>
		{model.tag === 'rec' && <span className="nmo-md-rec" title="Рекомендована по цене и возможностям" aria-label="Рекомендованная"><IconStar size={10}/></span>}
		{model.tag === 'pricey' && <span className="nmo-md-pricey" title="Примерная цена вопроса более чем в 3 раза выше медианы списка">$$$</span>}
	</>
);

function modelTitle(model: IAiModel): string {
	return `${model.id}\n${formatQuestionCost(model)}`;
}
