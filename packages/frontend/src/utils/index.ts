// Trajectory computation utilities
export {
  computeCentroid,
  buildNodePositionsMap,
  createTrajectoryPoints,
  interpolateTrajectoryPosition,
  positionToTokenIndex,
  tokenIndexToPosition,
  calculatePathLength,
  getMaxActivation,
  getTopActivations,
} from './trajectoryComputation';

// Steering computation utilities
export {
  computeSteeringVector,
  isSteeringVectorEmpty,
  calculateVectorMagnitude,
  mergeSteeringVectors,
} from './steeringComputation';

// Conflict detection utilities
export {
  detectConflicts,
  checkDialPairConflict,
  getAffectedFeatures,
  filterConflictsBySeverity,
} from './conflictDetection';

// Serialization utilities
export {
  serializeSteeringState,
  serializeSteeringStateToBase64,
  deserializeSteeringState,
  deserializeSteeringStateFromBase64,
  applySerializedState,
  saveSteeringStateToStorage,
  loadSteeringStateFromStorage,
  clearSteeringStateFromStorage,
  SteeringDeserializationError,
} from './steeringSerialization';
