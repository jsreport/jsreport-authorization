/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Extension for authorizing requests and data access. It is dependent on Authentication extension.
 *
 * Adds property readPermissions and editPermissions to every object as array od user ids identifying which
 * user can work on which object.
 */
const Promise = require('bluebird')
const { authorizeUpdate, authorizeRemove, defaultAuth } = require('./helpers.js')

function Authorization (reporter, definition) {
  this.reporter = reporter
  this.definition = definition

  this.findPermissionFilteringListeners = reporter.createListenerCollection()
  this.requestAuthorizationListeners = reporter.createListenerCollection()
  this.operationAuthorizationListeners = reporter.createListenerCollection()
  reporter.initializeListeners.add(definition.name, Authorization.prototype._initialize.bind(this))

  this.findPermissionFilteringListeners.add(definition.name, (collection, query, req) => {
    query.readPermissions = req.context.user._id.toString()
  })
}

Authorization.prototype.authorizeRequest = async function (req, res) {
  const authRes = await this.requestAuthorizationListeners.fireAndJoinResults(req, res)
  if (authRes === null) {
    return req.context.user !== null && req.context.user !== undefined
  }

  return authRes
}

Authorization.authorizationResult = {
  notDefined: 'notDefined',
  reject: 'reject',
  filterOut: 'filterOut',
  ok: 'ok'
}

Authorization.prototype._registerAuthorizationListeners = function () {
  for (const key in this.reporter.documentStore.collections) {
    const col = this.reporter.documentStore.collections[key]

    if (col.entitySet.shared) {
      continue
    }

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
          this.reporter.logger.warn('User ' + req.context.user.username + ' not authorized for ' + collection.entitySet)
        }

        const e = new Error('Unauthorized for ' + collection.entitySet)
        e.unauthorized = true
        throw e
      }
    }

    col.beforeUpdateListeners.add('authorization', col, (query, update, req) => {
      if (!req || req.skipAuthorizationForUpdate === query) {
        return
      }

      return check(col, req, () => authorizeUpdate(query, update, col, req))
    })

    col.beforeRemoveListeners.add('authorization', col, (query, req) => {
      return check(col, req, () => authorizeRemove(query, col, req))
    })

    col.beforeInsertListeners.add('authorization', col, (doc, req) => {
      if (!req || req.skipAuthorizationForInsert === doc) {
        return
      }
      return check(col, req, () => {
        return Promise.resolve(true)
      })
    })
  }
}

Authorization.prototype._handlePermissionsInEntities = function () {
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

  for (const key in this.reporter.documentStore.collections) {
    const col = this.reporter.documentStore.collections[key]
    if (col.entitySet.shared) {
      continue
    }

    col.beforeUpdateListeners.add('auth-perm', col, beforeUpdate)
    col.beforeInsertListeners.add('auth-perm', col, beforeCreate)
    col.beforeFindListeners.add('auth-perm', col, (query, req) => {
      if (col.name === 'users' || col.entitySet.shared) {
        return
      }

      if (req && req.context.user && req.context.user._id && !req.context.user.isAdmin &&
          req.skipAuthorization !== true && req.skipAuthorizationForQuery !== query) {
        return this.findPermissionFilteringListeners.fire(this, query, req)
      }
    })
  }
}

Authorization.prototype._extendEntitiesWithPermissions = function () {
  this.reporter.documentStore.on('before-init', (documentStore) => {
    for (const key in documentStore.model.entitySets) {
      const entitySet = documentStore.model.entitySets[key]
      if (entitySet.shared) {
        continue
      }

      const entityType = documentStore.model.entityTypes[entitySet.entityType.replace(documentStore.model.namespace + '.', '')]

      entityType.readPermissions = {type: 'Collection(Edm.String)'}
      entityType.editPermissions = {type: 'Collection(Edm.String)'}
    }
  })
}

Authorization.prototype._initialize = function () {
  this._registerAuthorizationListeners()
  this._handlePermissionsInEntities()
}

module.exports = function (reporter, definition) {
  if (!reporter.authentication) {
    definition.options.enabled = false
    return
  }

  reporter.authorization = new Authorization(reporter, definition)
  reporter.authorization._extendEntitiesWithPermissions()
}
