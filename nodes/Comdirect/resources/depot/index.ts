import type { INodeProperties } from 'n8n-workflow';
import { depotSelect } from '../../shared/descriptions';
import { depotTransactionsDescription } from './getTransactions';
import { depotPositionDescription } from './getPosition';

const showOnlyForDepot = { resource: ['depot'] };

export const depotDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForDepot },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get all depots',
				description: 'List all depots linked to your customer profile',
				routing: {
					request: {
						method: 'GET',
						url: '/api/brokerage/clients/user/v3/depots',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'values' } },
						],
					},
				},
			},
			{
				name: 'Get Many Positions',
				value: 'getPositions',
				action: 'Get positions for a depot',
				description: 'Get all positions held in a depot',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/brokerage/v3/depots/{{$parameter.depotId.value || $parameter.depotId}}/positions',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'values' } },
						],
					},
				},
			},
			{
				name: 'Get Position',
				value: 'getPosition',
				action: 'Get a single position',
				description: 'Get a single position by depot and position ID',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/brokerage/v3/depots/{{$parameter.depotId.value || $parameter.depotId}}/positions/{{$parameter.positionId}}',
					},
				},
			},
			{
				name: 'Get Many Transactions',
				value: 'getTransactions',
				action: 'Get transactions for a depot',
				description: 'Get transactions (Depotumsätze) for a single depot',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/brokerage/v3/depots/{{$parameter.depotId.value || $parameter.depotId}}/transactions',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'values' } },
						],
					},
				},
			},
		],
		default: 'getMany',
	},
	{
		...depotSelect,
		displayOptions: {
			show: {
				...showOnlyForDepot,
				operation: ['getPositions', 'getPosition', 'getTransactions'],
			},
		},
	},
	...depotPositionDescription,
	...depotTransactionsDescription,
];
