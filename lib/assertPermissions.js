const extend = require('node.extend.without.arrays')

function checkPermissions (entity, req) {
  return (entity.editPermissions || []).some((p) => p === req.context.user._id.toString()) ||
         (entity.inheritedEditPermissions || []).some((p) => p === req.context.user._id.toString())
}

async function findWithoutPermissions (collection, query, req) {
  const q = extend(true, {}, query)
  req.context.skipAuthorization = true

  // the query can already contain permissions filter, because it was used
  // for some other validations before without deep clone
  // that is likely wrong usage, but to be safe we rather filter permissions
  // manually
  if (q.$or) {
    q.$or = q.$or.filter(e =>
      !e.readPermissions &&
      !e.editPermissions &&
      !e.inheritedReadPermissions &&
      !e.inheritedEditPermissions &&
      !e.visibilityPermissions)

    if (q.$or.length === 0) {
      delete q.$or
    }
  }
  if (q.$and) {
    q.$and = q.$and.filter(e => !e.$or || !e.$or.some(ee => ee.editPermissions || ee.readPermissions))
    if (q.$and.length === 0) {
      delete q.$and
    }
  }

  const items = await collection.find(q, req)
  req.context.skipAuthorization = false
  return items
}

async function authorizeUpdate (query, update, collection, req) {
  const items = await findWithoutPermissions(collection, query, req)

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
  const items = await findWithoutPermissions(collection, query, req)

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
