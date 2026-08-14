export const USER_ROLES = ['admin', 'pro-user', 'light-user'];

export const USER_ROLE_LABELS = {
  admin: 'Admin',
  'pro-user': 'Pro-User',
  'light-user': 'Light-User'
};

export function normalizeUserRole(role) {
  return USER_ROLES.includes(role) ? role : 'light-user';
}

export function isAdmin(session) {
  return normalizeUserRole(session?.role) === 'admin' && !session?.isBlocked;
}

export function canCreateStories(session) {
  return ['admin', 'pro-user'].includes(normalizeUserRole(session?.role)) && !session?.isBlocked;
}
