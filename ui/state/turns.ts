import { createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import type { TurnRecord } from "@shared/session/turns";
import type { RootState } from "./store";

const SLICE_NAME = "turns";

const adapter = createEntityAdapter<TurnRecord>({
  sortComparer: (a, b) => b.order - a.order,
});

interface InitialState {}

export const turnsSlice = createSlice({
  name: SLICE_NAME,
  initialState: adapter.getInitialState({} as InitialState),
  reducers: {
    addManyTurns: adapter.addMany,
    addOneTurn: adapter.addOne,
    removeAllTurns: adapter.removeAll,
    removeManyTurns: adapter.removeMany,
    removeOneTurn: adapter.removeOne,
    setAllTurns: adapter.setAll,
    setManyTurns: adapter.setMany,
    setOneTurn: adapter.setOne,
    updateManyTurns: adapter.updateMany,
    updateOneTurn: adapter.updateOne,
    upsertManyTurns: adapter.upsertMany,
    upsertOneTurn: adapter.upsertOne,
  },

  extraReducers: (builder) => {},
});

/****************************************************
 Selectors
****************************************************/
function getSlice(state: RootState) {
  return state[SLICE_NAME];
}

export const {
  selectAll: selectAllTurns,
  selectById: selectTurnById,
  selectIds: selectTurnIds,
  selectEntities: selectTurnEntities,
  selectTotal: selectTurnTotal,
} = adapter.getSelectors(getSlice);

export function getCallTurns(state: RootState, callSid: string) {
  return selectAllTurns(state).filter((turn) => turn.callSid === callSid);
}

export function getCallTurnIds(state: RootState, callSid: string) {
  const entities = selectTurnEntities(state);
  return selectTurnIds(state).filter((id) => entities[id].callSid === callSid);
}

/****************************************************
 Actions
****************************************************/
export const {
  addManyTurns,
  addOneTurn,
  removeAllTurns,
  removeManyTurns,
  removeOneTurn,
  setAllTurns,
  setManyTurns,
  setOneTurn,
  updateManyTurns,
  updateOneTurn,
  upsertManyTurns,
  upsertOneTurn,
} = turnsSlice.actions;
