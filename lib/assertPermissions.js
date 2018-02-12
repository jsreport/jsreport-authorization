function checkPermissions (entity, req) {
  return (entity.editPermissions || []).find((p) => p === req.context.user._id.toString()) != null
}

async function authorizeUpdate (query, update, collection, req) {
  const items = await collection.find(query)
  let result = true
  items.forEach((entity) => {
    if (collection.name === 'users' && (entity._id && entity._id !== req.context.user._id.toString())) {
      result = false
    }

    if (collection.name === 'users' && (entity._id && entity._id === req.context.user._id.toString())) {
      result = true
    } else {
      if (result) {
        result = checkPermissions(entity, req)
      }
    }
  })

  return result
}

async function authorizeRemove (query, collection, req) {
  req.context.skipAuthorization = true
  const items = await collection.find(query)
  req.context.skipAuthorization = false
  let result = true
  items.forEach((entity) => {
    if (result) {
      result = checkPermissions(entity, req)
    }
  })

  return result
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

  return null
}

module.exports = (col, logger) => {
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
        logger.warn('User ' + req.context.user.username + ' not authorized for ' + collection.entitySet)
      }

      const e = new Error('Unauthorized for ' + collection.entitySet)
      e.unauthorized = true
      throw e
    }
  }

  col.beforeUpdateListeners.add('authorization', col, (query, update, opts, req) => {
    if (!req || req.context.skipAuthorizationForUpdate === query) {
      return
    }

    return check(col, req, () => authorizeUpdate(query, update, col, req))
  })

  col.beforeRemoveListeners.add('authorization', col, (query, req) => {
    return check(col, req, () => authorizeRemove(query, col, req))
  })

  col.beforeInsertListeners.add('authorization', col, (doc, req) => {
    if (!req || req.context.skipAuthorizationForInsert === doc) {
      return
    }
    return check(col, req, () => true)
  })
}
