import rankerPairwiseData from '../../node_modules/nmo-pdf/models/ranker_pairwise.json';
import rankerData from '../../node_modules/nmo-pdf/models/ranker.json';

const MODELS = {
	'models/ranker_pairwise.json': JSON.stringify(rankerPairwiseData),
	'models/ranker.json': JSON.stringify(rankerData),
};

export function readFileSync(path, _encoding) {
	return MODELS[path] ?? '{}';
}
export function existsSync(path) {
	return path in MODELS;
}
export function readdirSync() { return []; }
export function statSync() { return {}; }
export function writeFileSync() {}
export function mkdirSync() {}
