function checkPermissions (entity, req) {
  return (entity.editPermissions || []).find((p) => p === req.context.user._id.toString()) != null
}

async function checkPermissionWithFolders (reporter, entity, req) {
  if (!entity.folder) {
    return checkPermissions(entity, req)
  }

  const parentFolder = await reporter.documentStore.collection('folders').findOne({ shortid: entity.folder.shortid }, req)

  if (!parentFolder) {
    return false
  }

  if (checkPermissions(parentFolder, req)) {
    return true
  }

  return checkPermissionWithFolders(reporter, parentFolder, req)
}

async function authorizeUpdate (reporter, query, update, collection, req) {
  const items = await collection.find(query, req)

  if (items.length === 0) {
    return false
  }

  let result = true

  for (const entity of items) {
    if (collection.name === 'users' && (entity._id && entity._id !== req.context.user._id.toString())) {
      result = false
    }

    if (collection.name === 'users' && (entity._id && entity._id === req.context.user._id.toString())) {
      result = true
    } else {
      if (result) {
        result = await checkPermissionWithFolders(reporter, entity, req)
      }
    }
  }

  return result
}

async function authorizeRemove (reporter, query, collection, req) {
  const items = await collection.find(query, req)

  if (items.length === 0) {
    return false
  }

  let result = true

  for (const entity of items) {
    if (result) {
      result = checkPermissionWithFolders(reporter, entity, req)
    }
  }

  return result
}

async function authorizeInsert (reporter, doc, collection, req) {
  if (!doc.folder) {
    return true
  }

  const folder = await reporter.documentStore.collection('folders').findOne({ shortid: doc.folder.shortid }, req)
  return folder != null
}

function defaultAuth (collection, req) {
  if (collection.name === 'settings') {
    return true
  }

  if (req.context.skipAuthorization) {
    return true
  }

  if (!req) { // background jobs
    return true
  }

  if (!req.context.user) {
    return false
  }

  if (req.context.user.isAdmin) {
    return true
  }

  if (req.context.user.editAllPermissions) {
    return true
  }

  return null
}

module.exports = (col, reporter) => {
  const check = async (collection, req, authAction) => {
    const fn = () => {
      if (!req) {
        return true
      }

      const defaultAuthResult = defaultAuth(collection, req)
      if (defaultAuthResult === true) {
        return true
      }
      if (defaultAuthResult === false) {
        return false
      }

      return authAction()
    }

    const res = await fn()

    if (res !== true) {
      if (req.context.user) {
        reporter.logger.warn(`User ${req.context.user.username} not authorized for ${collection.entitySet}`)
      }

      throw reporter.createError(`Unauthorized for ${collection.entitySet}`, {
        code: 'UNAUTHORIZED'
      })
    }
  }

  col.beforeUpdateListeners.add('authorization', col, (query, update, opts, req) => {
    if (!req || req.context.skipAuthorizationForUpdate === query) {
      return
    }

    return check(col, req, () => authorizeUpdate(reporter, query, update, col, req))
  })

  col.beforeRemoveListeners.add('authorization', col, (query, req) => {
    return check(col, req, () => authorizeRemove(reporter, query, col, req))
  })

  col.beforeInsertListeners.add('authorization', col, (doc, req) => {
    if (!req || req.context.skipAuthorizationForInsert === doc) {
      return
    }
    return check(col, req, () => authorizeInsert(reporter, doc, col, req))
  })
}
