import { useEffect } from 'react';
import { fetchViaBackground, parseHtml } from '../../utils';
import { detectSource } from '../../utils/parsers';

export interface IAnswerModel {
	readonly loading: boolean;
	readonly error: string | null;
	readonly data: HTMLElement | null;
}

const INIT_STATE: IAnswerModel = { loading: false, error: null, data: null };

interface IAnswerLoader2Props {
	readonly url: string;
	readonly onChange: (state: IAnswerModel) => void;
}

const AnswerLoader2 = ({ url, onChange }: IAnswerLoader2Props) => {

	useEffect(() => {
		const trimmed = url.trim();
		if (!trimmed) return onChange({...INIT_STATE});

		let valid: URL;
		try {
			valid = new URL(trimmed);
		} catch {
			onChange({ loading: false, error: 'некорректный URL', data: null });
			return;
		}

		const sourceKey = detectSource(valid.href);
		if (!sourceKey) return onChange({loading: false, error: 'URL не от rosmed или 24forcare', data: null});

		onChange({ loading: true, error: null, data: null });

		let cancelled = false;

		async function load() {
			try {
				const res = await fetchViaBackground(valid.href);
				if (cancelled) return;

				if (res.error) return onChange({loading: false, error: 'ошибка сети — проверь URL', data: null});

				if (res.status < 200 || res.status >= 400) {
					return onChange({ loading: false, error: `ошибка ${res.status}: сервер отклонил запрос`, data: null });
				}

				if (!res.text || res.text.length < 100) {
					return onChange({ loading: false, error: 'пустой ответ от сервера', data: null });
				}

				onChange({ loading: false, error: null, data: parseHtml(res.text, true) });

			} catch (error) {
				if (cancelled) return;
				onChange({loading: false, error: `ошибка парсинга: ${(error as Error).message}`, data: null});
			}
		}

		load();

		return () => { cancelled = true; };

	}, [url]);

	return null;
};

export default AnswerLoader2;
