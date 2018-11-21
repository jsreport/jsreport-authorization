function mergeArrays (arrayA = [], arrayB = []) {
  return [...new Set([...arrayA, ...arrayB])]
}

function isRequestEligibleForAuth (req) {
  return req && req.context && req.context.user && !req.context.user.isAdmin
}

function beforeCreate (entity, req) {
  if (!isRequestEligibleForAuth(req)) {
    return
  }

  entity.readPermissions = mergeArrays(entity.readPermissions, [req.context.user._id.toString()])
  entity.editPermissions = mergeArrays(entity.editPermissions, [req.context.user._id.toString()])
}

function beforeFind (col, findPermissionFilteringListeners, query, projection, req) {
  if (col.entitySet.shared) {
    return
  }

  if (req && req.context.user && req.context.user._id && !req.context.user.isAdmin && !req.context.user.readAllPermissions &&
        req.context.skipAuthorization !== true && req.context.skipAuthorizationForQuery !== query) {
    return findPermissionFilteringListeners.fire(col, query, req)
  }
}

module.exports = (col, findPermissionFilteringListeners) => {
  col.beforeInsertListeners.add('auth-perm', col, beforeCreate)
  col.beforeFindListeners.add('auth-perm', col, (...args) => beforeFind(col, findPermissionFilteringListeners, ...args))
}
