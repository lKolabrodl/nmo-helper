import { useEffect } from 'react';
import { fetchViaBackground, parseHtml } from '../../utils';
import type { ISearchResult } from '../../types';

export interface IVariantLoaderState {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

const IDLE: IVariantLoaderState = { loading: false, error: null, data: [] };

interface IVariantLoaderProps {
	readonly text: string;
	readonly onChange: (state: IVariantLoaderState) => void;
}

const VariantLoader = ({ text, onChange }: IVariantLoaderProps) => {

	useEffect(() => {
		const query = text.trim();
		if (!query) return onChange({...IDLE});

		onChange({ loading: true, error: null, data: [] });

		let cancelled = false;

		async function search() {
			const encoded = encodeURIComponent(query);

			const [fcRes, rosRes] = await Promise.all([
				fetchViaBackground('https://24forcare.com/search/?query=' + encoded).catch(() => null),
				fetchViaBackground('https://rosmedicinfo.ru/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: 'do=search&subaction=search&story=' + encoded,
				}).catch(() => null),
			]);

			if (cancelled) return;

			const results: ISearchResult[] = [];

			// 24forcare всё оки
			if (fcRes && !fcRes.error && fcRes.text) results.push(...parseForcare(fcRes.text));

			// rosmed всё оки доки
			if (rosRes && !rosRes.error && rosRes.text) results.push(...parseRosmed(rosRes.text));

			// не судьба
			if (results.length === 0) return onChange({loading: false, error: 'ничего не найдено', data: []});

			onChange({ loading: false, error: null, data: results });
		}

		search();

		return () => { cancelled = true; };
	}, [text]);

	return null;
};

export default VariantLoader;


function parseForcare(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('a.item-name'));
	links.forEach(a => {
		const href = a.getAttribute('href') || '';
		const title = (a.textContent || '').trim();
		if (!href || !title) return;
		const url = href.startsWith('http') ? href : 'https://24forcare.com/' + href.replace(/^\//, '');
		results.push({ source: '24forcare', title, url });
	});
	return results;
}

function parseRosmed(html: string): ISearchResult[] {
	const results: ISearchResult[] = [];
	const links = Array.from(parseHtml(html).querySelectorAll('.short__title a'));
	links.forEach(a => {
		const href = a.getAttribute('href') || '';
		const title = (a.textContent || '').trim();
		if (!href || !title) return;
		results.push({ source: 'rosmedicinfo', title, url: href });
	});
	return results;
}