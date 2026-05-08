import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { comdirectApiRequest } from '../shared/transport';

type Depot = {
	depotId: string;
	depotDisplayId?: string;
	depotType?: string;
};

type Response = {
	values: Depot[];
};

export async function getDepots(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	const response = (await comdirectApiRequest.call(
		this,
		'GET',
		'/api/brokerage/clients/user/v3/depots',
	)) as Response;

	const results: INodeListSearchItems[] = (response.values ?? []).map((d) => ({
		name: d.depotDisplayId ?? d.depotId,
		value: d.depotId,
	}));

	return { results };
}
