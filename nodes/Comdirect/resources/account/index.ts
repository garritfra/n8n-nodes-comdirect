import type { INodeProperties } from 'n8n-workflow';
import { accountSelect } from '../../shared/descriptions';
import { accountTransactionsDescription } from './getTransactions';

const showOnlyForAccount = { resource: ['account'] };

export const accountDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForAccount },
		options: [
			{
				name: 'Get Balance',
				value: 'getBalance',
				action: 'Get balance for one account',
				description: 'Get the balance for a single account by account ID',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/banking/v2/accounts/{{$parameter.accountId.value || $parameter.accountId}}/balances',
					},
				},
			},
			{
				name: 'Get Many Balances',
				value: 'getBalances',
				action: 'Get balances for all accounts',
				description: 'Get balances for all accounts linked to your customer profile',
				routing: {
					request: {
						method: 'GET',
						url: '/api/banking/clients/user/v2/accounts/balances',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'values' } },
						],
					},
				},
			},
			{
				name: 'Get Many Transactions',
				value: 'getTransactions',
				action: 'Get transactions for one account',
				description: 'Get transactions (Kontoumsätze) for a single account',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/banking/v1/accounts/{{$parameter.accountId.value || $parameter.accountId}}/transactions',
					},
					output: {
						postReceive: [
							{ type: 'rootProperty', properties: { property: 'values' } },
						],
					},
				},
			},
		],
		default: 'getBalances',
	},
	{
		...accountSelect,
		displayOptions: {
			show: { ...showOnlyForAccount, operation: ['getBalance', 'getTransactions'] },
		},
	},
	...accountTransactionsDescription,
];
