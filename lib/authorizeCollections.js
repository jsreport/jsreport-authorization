module.exports = (reporter, findPermissionFilteringListeners) => {
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

    var entity = update.$set

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

  function beforeFind (col, query, req) {
    if (col.name === 'users' || col.entitySet.shared) {
      return
    }

    if (req && req.context.user && req.context.user._id && !req.context.user.isAdmin &&
            req.skipAuthorization !== true && req.skipAuthorizationForQuery !== query) {
      return findPermissionFilteringListeners.fire(this, query, req)
    }
  }

  for (const key in reporter.documentStore.collections) {
    const col = reporter.documentStore.collections[key]
    if (col.entitySet.shared) {
      continue
    }

    col.beforeUpdateListeners.add('auth-perm', col, beforeUpdate)
    col.beforeInsertListeners.add('auth-perm', col, beforeCreate)
    col.beforeFindListeners.add('auth-perm', col, (query, req) => beforeFind(col, query, req))
  }
}
