export const reconcileReport = (previous, draftId, canonical) => [
  { ...canonical, _isLocalPending: false },
  ...previous.filter(item => item.id !== draftId && item.id !== canonical.id),
];

export const reconcileSnapshot = (previous, remote) => [
  ...remote,
  ...previous.filter(item => item._isLocalPending && !remote.some(current => current.id === item.id)),
];
