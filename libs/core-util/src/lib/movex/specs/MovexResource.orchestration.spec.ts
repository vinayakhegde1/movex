import { MovexResource } from '../MovexResource';
import { computeCheckedState, createMovexReducerMap } from '../util';
import { BlackMove, Submission, WhiteMove } from './types';
import { createMasterEnv } from './util';

describe('Master-Client Orchestration', () => {
  type ActionsMap = {
    changeCount: number;
    submitMoves:
      | {
          color: 'white';
          moves: WhiteMove[];
        }
      | {
          color: 'black';
          moves: BlackMove[];
        };
    setSubmissionStatusToReady: 'white' | 'black';
  };

  type State = {
    count: number;
    submission: Submission;
  };

  const initialState: State = {
    count: 0,
    submission: {
      status: 'none',
      white: {
        canDraw: true,
        moves: [],
      },
      black: {
        canDraw: true,
        moves: [],
      },
    },
  };

  const reducer = createMovexReducerMap<ActionsMap, State>(initialState)({
    changeCount: (prev, { payload }) => ({
      ...prev,
      count: payload,
    }),
    submitMoves: (prev, { payload: { color, moves } }) => {
      if (prev.submission.status === 'partial') {
        return {
          ...prev,
          submission: {
            ...prev.submission,
            [color]: {
              canDraw: false,
              moves,
            },
          },
        };
      }

      if (
        !(
          prev.submission.status === 'none' ||
          prev.submission.status === 'preparing'
        )
      ) {
        return prev;
      }

      return {
        ...prev,
        submission: {
          status: 'partial',
          ...(color === 'black'
            ? {
                white: {
                  canDraw: true,
                  moves: [],
                },
                black: {
                  canDraw: false,
                  moves,
                },
              }
            : {
                white: {
                  canDraw: false,
                  moves,
                },
                black: {
                  canDraw: true,
                  moves: [],
                },
              }),
        },
      };
    },
    setSubmissionStatusToReady: (prev, { payload: color }) => {
      if (prev.submission.status === 'partial') {
        return {
          ...prev,
          submission: {
            ...prev.submission,
            [color]: {
              canDraw: false,
              moves: [],
            },
          },
        };
      }

      if (
        prev.submission.status === 'none' ||
        prev.submission.status === 'preparing'
      ) {
        return {
          ...prev,
          submission: {
            status: 'partial',
            ...(color === 'black'
              ? {
                  white: prev.submission.white,
                  black: {
                    canDraw: false,
                    moves: [],
                  },
                }
              : {
                  black: prev.submission.black,
                  white: {
                    canDraw: false,
                    moves: [],
                  },
                }),
          },
        };
      }

      return prev;
    },
  });

  describe('master env', () => {
    test('gets an ack checksum after action emited', async () => {
      const masterEnv = createMasterEnv<State, ActionsMap>({
        genesisState: initialState,
        reducerMap: reducer,
        clientCountorIds: ['a', 'b', 'c'],
      });

      const [a, b, c] = masterEnv.clients;

      const initialCheckedState = masterEnv.getPublic();
      expect(initialCheckedState).toEqual(computeCheckedState(initialState));

      const actualChecksum = await a.emitAction({
        type: 'changeCount',
        payload: 2,
      });

      expect(actualChecksum).toBeDefined();
      expect(actualChecksum).not.toEqual(initialCheckedState[1]);
    });

    test('the peers get the action forwarded', async () => {
      const masterEnv = createMasterEnv<State, ActionsMap>({
        genesisState: initialState,
        reducerMap: reducer,
        clientCountorIds: ['a', 'b', 'c'],
      });

      const [a, b, c] = masterEnv.clients;

      const aSpy = jest.fn();
      const bSpy = jest.fn();
      const cSpy = jest.fn();

      a.onFwdAction(aSpy);
      b.onFwdAction(bSpy);
      c.onFwdAction(cSpy);

      const actualChecksum = await a.emitAction({
        type: 'changeCount',
        payload: 2,
      });

      expect(bSpy).toHaveBeenCalledWith({
        action: {
          type: 'changeCount',
          payload: 2,
        },
        nextChecksum: actualChecksum,
      });

      expect(cSpy).toHaveBeenCalledWith({
        action: {
          type: 'changeCount',
          payload: 2,
        },
        nextChecksum: actualChecksum,
      });

      expect(aSpy).not.toHaveBeenCalled();
    });

    test('the peers get the state updated', async () => {
      const masterEnv = createMasterEnv<State, ActionsMap>({
        genesisState: initialState,
        reducerMap: reducer,
        clientCountorIds: ['a', 'b', 'c'],
      });

      const [a, b, c] = masterEnv.clients;

      const aSpy = jest.fn();
      const bSpy = jest.fn();
      const cSpy = jest.fn();

      a.subscribeToNetworkExpensiveMasterUpdates(aSpy);
      b.subscribeToNetworkExpensiveMasterUpdates(bSpy);
      c.subscribeToNetworkExpensiveMasterUpdates(cSpy);

      const actualChecksum = await a.emitAction({
        type: 'changeCount',
        payload: 2,
      });

      const expectedState: State = {
        ...initialState,
        count: 2,
      };

      expect(bSpy).toHaveBeenCalledWith(computeCheckedState(expectedState));
      expect(cSpy).toHaveBeenCalledWith(computeCheckedState(expectedState));
      expect(aSpy).not.toHaveBeenCalled();
    });
  });

  test('Punlic Actions with 2 clients', () => {
    // This cannot be updated
    // const genesisCheckedState = computeCheckedState(initialState);

    const masterEnv = createMasterEnv<State, ActionsMap>({
      genesisState: initialState,
      reducerMap: reducer,
      clientCountorIds: ['white', 'black'],
    });

    const [whiteClient, blackClient] = masterEnv.clients;

    // whiteClient.

    // whiteClient.subscribeToNetworkExpensiveMasterUpdates()

    // const masterXResource = new MovexResource<State, ActionsMap>(
    //   reducer,
    //   genesisCheckedState
    // );

    // const whiteClientXResource = new MovexResource<State, ActionsMap>(
    //   reducer,
    //   genesisCheckedState
    // );

    // const blackClientXResource = new MovexResource<State, ActionsMap>(
    //   reducer,
    //   genesisCheckedState
    // );

    // masterXResource.onUpdate((nextCheckedState) => {
    //   whiteClientXResource.update(nextCheckedState);
    //   blackClientXResource.update(nextCheckedState);
    // });
  });

  test('with private', () => {
    // with the current public implementatino wwe have the issue of not getting private states
    // so need a way to get that, the simpler the betetr
  });
});