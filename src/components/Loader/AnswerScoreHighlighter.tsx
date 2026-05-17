import {useEffect} from 'react';
import {usePanelUi} from '../../contexts/PanelUiContext';
import {usePdfScore} from '../../contexts/PdfScoreContext';
import {answerCache} from '../../utils/answer-cache';
import {cleanTopic, getQuestionText, getTopicElement, getVariantElements} from '../../utils';
import {HIGHLIGHT_COLOR} from '../../utils/constants';

const STYLE_ID = 'nmo-pdf-score-style';
const BADGE_CLASS = 'nmo-pdf-score-badge';
const SCORE_WARN_COLOR = '#c88719';
const SCORE_DANGER_COLOR = '#d64545';
const BADGE_GAP = -5;
const VIEWPORT_SAFE_LEFT = 4;

const SCORE_ORIGINAL_COLOR_ATTR = 'nmoPdfScoreOriginalColor';
const SCORE_APPLIED_COLOR_ATTR = 'nmoPdfScoreAppliedColor';
const ROOT_POSITION_TOUCHED_ATTR = 'nmoPdfScorePositionTouched';
const ROOT_ORIGINAL_POSITION_ATTR = 'nmoPdfScoreOriginalPosition';

const AnswerScoreHighlighter = () => {
	const {mode} = usePanelUi();
	const {getPdfScore} = usePdfScore();

	useEffect(() => {
		ensureScoreStyle();

		const timer = setInterval(() => {
			if (mode !== 'pdf') {
				cleanupPdfScores();
				return;
			}

			const question = getQuestionText();
			if (!question) {
				cleanupPdfScores();
				return;
			}

			const elements = getVariantElements();
			const variants = elements.map(el => el.innerText.trim());
			if (!variants.length) {
				cleanupPdfScores();
				return;
			}

			const topicEl = getTopicElement();
			const topic = cleanTopic(topicEl?.innerText?.trim() ?? null) ?? '';
			const model = getPdfScore(topic, question, variants);
			if (!model) {
				cleanupPdfScores();
				return;
			}

			const cached = answerCache.get(topic, question, variants);
			const selectedIndexes = new Set(cached?.idx ?? []);
			applyPdfScores(elements, variants, model.scores, selectedIndexes);
		}, 300);

		return () => {
			clearInterval(timer);
			if (mode !== 'pdf') cleanupPdfScores();
		};
	}, [mode, getPdfScore]);

	useEffect(() => {
		if (mode !== 'pdf') cleanupPdfScores();
	}, [mode]);

	return null;
};

export default AnswerScoreHighlighter;

type IScore = {
	readonly title: string;
	readonly score: number;
	readonly selected?: boolean;
}

function applyPdfScores(elements: HTMLElement[], variants: string[], scores: IScore[], selectedIndexes: Set<number>): void {
	const scoreByTitle = new Map(scores.map(score => [norm(score.title), score]));

	elements.forEach((el, index) => {
		const score = getScoreForVariant(scores, scoreByTitle, variants[index], index);
		if (!score) {
			clearScoreElement(el);
			return;
		}

		const badge = ensureScoreBadge(el);
		badge.textContent = formatScore(score.score);
		positionScoreBadge(badge, el);

		const isSelected = selectedIndexes.has(index) || score.selected === true;
		if (isSelected) {
			clearPdfScoreColor(el);
			badge.style.color = HIGHLIGHT_COLOR;
			return;
		}

		const color = getLowScoreColor(score.score);
		if (!color) {
			clearPdfScoreColor(el);
			badge.style.color = '';
			return;
		}

		applyPdfScoreColor(el, color);
		badge.style.color = color;
	});
}

function getScoreForVariant(	scores: IScore[],	scoreByTitle: Map<string, IScore>,	variant: string,	index: number): IScore | undefined {
	const indexed = scores[index];
	if (indexed && norm(indexed.title) === norm(variant)) return indexed;
	return scoreByTitle.get(norm(variant)) ?? indexed;
}

function ensureScoreStyle(): void {
	if (document.getElementById(STYLE_ID)) return;

	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
	.${BADGE_CLASS} {
		position: absolute;
		min-width: 40px;
		padding: 1px 5px;
		border-radius: 5px;
		border: 1px solid rgba(0, 0, 0, 0.12);
		background: #fff;
		font-size: 11px;
		font-style: normal;
		font-weight: 700;
		line-height: 1.35;
		text-align: center;
		vertical-align: 1px;
		pointer-events: none;
		z-index: 1;
	}`;

	document.head.appendChild(style);
}

function cleanupPdfScores(root: ParentNode = document): void {
	const roots = new Set<HTMLElement>();
	root.querySelectorAll<HTMLElement>(`.${BADGE_CLASS}`).forEach(badge => {
		if (badge.parentElement) roots.add(badge.parentElement);
		badge.remove();
	});
	roots.forEach(restoreScoreRootPosition);
	root.querySelectorAll<HTMLElement>('[data-nmo-pdf-score]').forEach(el => delete el.dataset.nmoPdfScore);
	getVariantElements().forEach(clearScoreElement);
}

function clearScoreElement(el: HTMLElement): void {
	delete el.dataset.nmoPdfScore;
	clearPdfScoreColor(el);
}

function ensureScoreBadge(textEl: HTMLElement): HTMLElement {
	const field = textEl.closest('.mdc-form-field') as HTMLElement | null;
	const root = field ?? textEl.parentElement ?? textEl;
	const existing = Array.from(root.children)
		.find((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains(BADGE_CLASS));
	if (existing) return existing;

	const badge = document.createElement('i');
	badge.className = BADGE_CLASS;
	badge.setAttribute('aria-hidden', 'true');
	ensureScoreRootPosition(root);
	root.appendChild(badge);
	return badge;
}

function positionScoreBadge(badge: HTMLElement, textEl: HTMLElement): void {
	const root = badge.parentElement as HTMLElement | null;
	if (!root) return;
	const control = findChoiceControl(root, textEl);
	const target = control ?? textEl;
	const rootRect = root.getBoundingClientRect();
	const targetRect = target.getBoundingClientRect();
	const badgeRect = badge.getBoundingClientRect();
	const desiredLeft = targetRect.left - rootRect.left - badgeRect.width - BADGE_GAP;
	const safeLeft = VIEWPORT_SAFE_LEFT - rootRect.left;
	const left = Math.max(desiredLeft, safeLeft);
	const top = targetRect.top - rootRect.top + (targetRect.height - badgeRect.height) / 2;

	badge.style.left = `${Math.round(left)}px`;
	badge.style.top = `${Math.round(top)}px`;
}

function findChoiceControl(root: HTMLElement, textEl: HTMLElement): HTMLElement | null {
	const controls = Array.from(root.querySelectorAll<HTMLElement>('.mdc-radio, .mdc-checkbox, input[type="radio"], input[type="checkbox"]'));
	return controls.find(control => control !== textEl && !textEl.contains(control)) ?? null;
}

function ensureScoreRootPosition(root: HTMLElement): void {
	if (getComputedStyle(root).position !== 'static') return;
	if (root.dataset[ROOT_POSITION_TOUCHED_ATTR]) return;

	root.dataset[ROOT_ORIGINAL_POSITION_ATTR] = root.style.position;
	root.dataset[ROOT_POSITION_TOUCHED_ATTR] = 'true';
	root.style.position = 'relative';
}

function restoreScoreRootPosition(root: HTMLElement): void {
	if (root.dataset[ROOT_POSITION_TOUCHED_ATTR] !== 'true') return;

	root.style.position = root.dataset[ROOT_ORIGINAL_POSITION_ATTR] ?? '';
	delete root.dataset[ROOT_ORIGINAL_POSITION_ATTR];
	delete root.dataset[ROOT_POSITION_TOUCHED_ATTR];
}

function applyPdfScoreColor(el: HTMLElement, color: string): void {
	if (typeof el.dataset[SCORE_ORIGINAL_COLOR_ATTR] === 'undefined') {
		el.dataset[SCORE_ORIGINAL_COLOR_ATTR] = el.style.color;
	}

	el.style.color = color;
	el.dataset[SCORE_APPLIED_COLOR_ATTR] = el.style.color;
}

function clearPdfScoreColor(el: HTMLElement): void {
	const appliedColor = el.dataset[SCORE_APPLIED_COLOR_ATTR];
	if (appliedColor && el.style.color === appliedColor) {
		el.style.color = el.dataset[SCORE_ORIGINAL_COLOR_ATTR] ?? '';
	}

	delete el.dataset[SCORE_ORIGINAL_COLOR_ATTR];
	delete el.dataset[SCORE_APPLIED_COLOR_ATTR];
}

function getLowScoreColor(score: number): string | null {
	if (score < 0.4) return SCORE_DANGER_COLOR;
	if (score < 0.65) return SCORE_WARN_COLOR;
	return null;
}

function formatScore(score: number): string {
	return `${Math.round(score * 100)}%`;
}

const norm = (value: string): string => value.trim().toLowerCase();
