import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';
import { accountDescription } from './resources/account';
import { depotDescription } from './resources/depot';
import { documentDescription } from './resources/document';
import { getAccounts } from './listSearch/getAccounts';
import { getDepots } from './listSearch/getDepots';
import { COMDIRECT_BASE_URL } from './shared/transport';

export class Comdirect implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'comdirect',
		name: 'comdirect',
		icon: 'file:../../icons/comdirect.svg',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read accounts, depots and PostBox documents from comdirect',
		defaults: { name: 'comdirect' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'comdirectApi', required: true }],
		requestDefaults: {
			baseURL: COMDIRECT_BASE_URL,
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Account', value: 'account' },
					{ name: 'Depot', value: 'depot' },
					{ name: 'Document', value: 'document' },
				],
				default: 'account',
			},
			...accountDescription,
			...depotDescription,
			...documentDescription,
		],
	};

	methods = {
		listSearch: {
			getAccounts,
			getDepots,
		},
	};
}
