import { useEffect } from 'react';
import { fetchViaBackground, parseHtml } from '../../utils';
import {ISourceKey} from '../../types';

export interface IVariantModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: ISearchResult[];
}

interface ISearchResult {
	readonly source: ISourceKey;
	readonly title: string;
	readonly url: string;
}

const INIT_STATE: IVariantModel = { loading: false, error: null, data: [] };

interface IVariantLoaderProps {
	readonly text: string | null;
	readonly onChange: (state: IVariantModel) => void;
}

const VariantLoader = ({ text, onChange }: IVariantLoaderProps) => {

	useEffect(() => {
		const query = (text ?? '').trim();
		if (!query) return onChange({...INIT_STATE});

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
			if (fcRes && !fcRes.error && fcRes.text) results.push(...parseForcareUrls(fcRes.text));

			// rosmed всё оки доки
			if (rosRes && !rosRes.error && rosRes.text) results.push(...parseRosmedUrls(rosRes.text));

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


function parseForcareUrls(html: string): ISearchResult[] {
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

function parseRosmedUrls(html: string): ISearchResult[] {
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