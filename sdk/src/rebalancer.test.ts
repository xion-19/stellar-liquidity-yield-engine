import { RebalancerClient } from './rebalancer';
import { Account, Address, nativeToScVal } from 'stellar-sdk';
import { RebalanceError } from './types';

describe('RebalancerClient', () => {
  const mockNetworkConfig = {
    network: 'testnet' as const,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
    contracts: {
      yieldEngine: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      rewardDistributor: 'DAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      rebalanceEngine: 'CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE',
      strategyRegistry: 'FAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    },
  };

  let client: RebalancerClient;
  let mockServer: any;

  beforeEach(() => {
    client = new RebalancerClient(mockNetworkConfig);
    mockServer = {
      getAccount: jest.fn().mockResolvedValue(
        new Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '1'),
      ),
      simulateTransaction: jest.fn(),
      sendTransaction: jest.fn(),
    };
    (client as any).server = mockServer;
  });

  describe('isApyFresh', () => {
    it('returns true when pool APY is fresh', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          status: 'SUCCESS',
          returnValue: nativeToScVal(true),
        },
      });

      const poolId = new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      const result = await client.isApyFresh(poolId);

      expect(result).toBe(true);
      expect(mockServer.simulateTransaction).toHaveBeenCalled();
    });

    it('returns false when pool APY is stale', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          status: 'SUCCESS',
          returnValue: nativeToScVal(false),
        },
      });

      const poolId = new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      const result = await client.isApyFresh(poolId);

      expect(result).toBe(false);
    });

    it('throws RebalanceError when simulation fails', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          status: 'ERROR',
          errorResult: 'Simulation failed',
        },
      });

      const poolId = new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

      await expect(client.isApyFresh(poolId)).rejects.toThrow(RebalanceError);
      await expect(client.isApyFresh(poolId)).rejects.toThrow('Failed to check APY freshness');
    });

    it('throws RebalanceError with FRESHNESS_CHECK_ERROR code on failure', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          status: 'ERROR',
          errorResult: 'Simulation failed',
        },
      });

      const poolId = new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

      try {
        await client.isApyFresh(poolId);
        fail('Expected RebalanceError to be thrown');
      } catch (error: any) {
        expect(error).toBeInstanceOf(RebalanceError);
        expect(error.code).toBe('FRESHNESS_CHECK_ERROR');
      }
    });

    it('handles network errors gracefully', async () => {
      mockServer.simulateTransaction.mockRejectedValue(new Error('Network error'));

      const poolId = new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');

      await expect(client.isApyFresh(poolId)).rejects.toThrow(RebalanceError);
      await expect(client.isApyFresh(poolId)).rejects.toThrow('Freshness check failed');
    });

    it('calls the correct contract method with pool ID', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          status: 'SUCCESS',
          returnValue: nativeToScVal(true),
        },
      });

      const poolId = new Address('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF');
      await client.isApyFresh(poolId);

      const tx = mockServer.simulateTransaction.mock.calls[0][0];
      expect(tx.operations[0].func.invokeContract().functionName().toString()).toBe('is_apy_fresh');
    });
  });
});
