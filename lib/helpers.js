function checkPermissions (entity, req) {
  return entity.editPermissions.find((p) => p === req.context.user._id.toString()) != null
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
  req.skipAuthorization = true
  const items = await collection.find(query)
  req.skipAuthorization = false
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

  if (req.skipAuthorization) {
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

module.exports.authorizeUpdate = authorizeUpdate
module.exports.authorizeRemove = authorizeRemove
module.exports.defaultAuth = defaultAuth
