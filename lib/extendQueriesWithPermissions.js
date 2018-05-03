function isRequestEligibleForAuth (req) {
  return req && req.context && req.context.user && !req.context.user.isAdmin
}

function beforeCreate (entity, req) {
  if (!isRequestEligibleForAuth(req)) {
    return
  }

  entity.readPermissions = entity.readPermissions || []
  entity.editPermissions = entity.editPermissions || []
  entity.readPermissions.push(req.context.user._id.toString())
  entity.editPermissions.push(req.context.user._id.toString())
}

function beforeUpdate (query, update, req) {
  if (!isRequestEligibleForAuth(req)) {
    return
  }

  const entity = update.$set

  if (!entity || (!entity.readPermissions && !entity.editPermissions)) {
    return
  }

  entity.editPermissions = entity.editPermissions || []
  entity.readPermissions = entity.readPermissions || []

  if (entity.editPermissions.indexOf(req.context.user._id.toString()) === -1) {
    entity.editPermissions.push(req.context.user._id.toString())
  }

  entity.editPermissions.forEach(function (wp) {
    if (entity.readPermissions.indexOf(wp) === -1) {
      entity.readPermissions.push(wp)
    }
  })
}

function beforeFind (col, findPermissionFilteringListeners, query, projection, req) {
  if (col.name === 'users' || col.entitySet.shared) {
    return
  }

  if (req && req.context.user && req.context.user._id && !req.context.user.isAdmin && !req.context.user.readAllPermissions &&
        req.context.skipAuthorization !== true && req.context.skipAuthorizationForQuery !== query) {
    return findPermissionFilteringListeners.fire(col, query, req)
  }
}

module.exports = (col, findPermissionFilteringListeners) => {
  col.beforeUpdateListeners.add('auth-perm', col, beforeUpdate)
  col.beforeInsertListeners.add('auth-perm', col, beforeCreate)
  col.beforeFindListeners.add('auth-perm', col, (...args) => beforeFind(col, findPermissionFilteringListeners, ...args))
}
