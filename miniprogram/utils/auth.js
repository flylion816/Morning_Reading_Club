const ADMIN_ROLES = ['platform_superadmin', 'superadmin', 'tenant_admin', 'admin', 'operator', 'super_admin'];

function isAdminUser(user = {}) {
  return ADMIN_ROLES.includes(user.role) || ADMIN_ROLES.includes(user.adminRole);
}

module.exports = { ADMIN_ROLES, isAdminUser };
