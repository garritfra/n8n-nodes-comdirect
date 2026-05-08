import type { INodeProperties } from 'n8n-workflow';

export const accountSelect: INodeProperties = {
	displayName: 'Account',
	name: 'accountId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select an account...',
			typeOptions: {
				searchListMethod: 'getAccounts',
				searchable: false,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 0a1b2c3d-…',
		},
	],
	description: 'The comdirect account UUID',
};

export const depotSelect: INodeProperties = {
	displayName: 'Depot',
	name: 'depotId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			placeholder: 'Select a depot...',
			typeOptions: {
				searchListMethod: 'getDepots',
				searchable: false,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 0a1b2c3d-…',
		},
	],
	description: 'The comdirect depot UUID',
};
