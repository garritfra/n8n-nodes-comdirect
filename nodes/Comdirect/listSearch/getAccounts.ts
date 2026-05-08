import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';
import { comdirectApiRequest } from '../shared/transport';

type AccountBalance = {
	account: {
		accountId: string;
		accountDisplayId?: string;
		accountType?: { text?: string };
		iban?: string;
	};
};

type Response = {
	values: AccountBalance[];
};

export async function getAccounts(this: ILoadOptionsFunctions): Promise<INodeListSearchResult> {
	const response = (await comdirectApiRequest.call(
		this,
		'GET',
		'/api/banking/clients/user/v2/accounts/balances',
	)) as Response;

	const results: INodeListSearchItems[] = (response.values ?? []).map((entry) => {
		const a = entry.account;
		const labelParts = [a.accountType?.text, a.accountDisplayId ?? a.iban].filter(
			(p): p is string => Boolean(p),
		);
		return {
			name: labelParts.length > 0 ? labelParts.join(' · ') : a.accountId,
			value: a.accountId,
		};
	});

	return { results };
}
