function checkPermissions (entity, req) {
  return (entity.editPermissions || []).some((p) => p === req.context.user._id.toString()) ||
         (entity.inheritedEditPermissions || []).some((p) => p === req.context.user._id.toString())
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
  const items = await collection.find(query, req)
  req.context.skipAuthorization = false
  let result = true
  items.forEach((entity) => {
    if (result) {
      result = checkPermissions(entity, req)
    }
  })

  return result
}

async function authorizeInsert (doc, collection, req) {
  return (doc.inheritedEditPermissions || []).some((p) => p === req.context.user._id.toString())
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

async function check (reporter, collection, req, authAction) {
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

module.exports = (reporter) => ({
  assertInsert (col, doc, req) {
    if (!req || req.context.skipAuthorizationForInsert === doc) {
      return
    }
    return check(reporter, col, req, () => authorizeInsert(doc, col, req))
  },

  assertUpdate (col, q, u, opts, req) {
    if (!req || req.context.skipAuthorizationForUpdate === q) {
      return
    }

    return check(reporter, col, req, () => authorizeUpdate(q, u, col, req))
  },

  assertRemove (col, q, req) {
    return check(reporter, col, req, () => authorizeRemove(q, col, req))
  }
})
