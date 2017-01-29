/*!
 * Copyright(c) 2014 Jan Blaha
 *
 * Extension for authorizing requests and data access. It is dependent on Authentication extension.
 *
 * Adds property readPermissions and editPermissions to every object as array od user ids identifying which
 * user can work on which object.
 */
var Promise = require('bluebird')
var _ = require('underscore')

function Authorization (reporter, definition) {
  this.reporter = reporter
  this.definition = definition

  this.findPermissionFilteringListeners = reporter.createListenerCollection()
  this.requestAuthorizationListeners = reporter.createListenerCollection()
  this.operationAuthorizationListeners = reporter.createListenerCollection()
  reporter.initializeListeners.add(definition.name, Authorization.prototype._initialize.bind(this))

  this.findPermissionFilteringListeners.add(definition.name, function (collection, query, req) {
    query.readPermissions = req.user._id.toString()
  })
}

Authorization.prototype.authorizeRequest = function (req, res) {
  return this.requestAuthorizationListeners.fireAndJoinResults(req, res).then(function (res) {
    if (res === null) {
      return req.user !== null && req.user !== undefined
    }

    return res
  })
}

Authorization.authorizationResult = {
  notDefined: 'notDefined',
  reject: 'reject',
  filterOut: 'filterOut',
  ok: 'ok'
}

Authorization.prototype.checkPermissions = function (entity, req) {
  var permissions = entity.editPermissions
  var permission = _.find(permissions, function (p) {
    return p === req.user._id.toString()
  })

  if (!permission) {
    return false
  }

  return true
}

Authorization.prototype.authorizeUpdate = function (query, update, collection, req) {
  var self = this

  return collection.find(query).then(function (items) {
    var result = true
    items.forEach(function (entity) {
      if (collection.name === 'users' && (entity._id && entity._id !== req.user._id.toString())) {
        result = false
      }

      if (collection.name === 'users' && (entity._id && entity._id === req.user._id.toString())) {
        result = true
      } else {
        if (result) {
          result = self.checkPermissions(entity, req)
        }
      }
    })

    return result
  })
}

Authorization.prototype.authorizeRemove = function (query, collection, req) {
  var self = this
  req.skipAuthorization = true
  return collection.find(query).then(function (items) {
    req.skipAuthorization = false
    var result = true
    items.forEach(function (entity) {
      if (result) {
        result = self.checkPermissions(entity, req)
      }
    })
    return result
  })
}

Authorization.prototype.defaultAuth = function (collection, req) {
  if (collection.name === 'settings') {
    return true
  }

  if (req.skipAuthorization) {
    return true
  }

  if (!req) { // background jobs
    return true
  }

  if (!req.user) {
    return false
  }

  if (req.user.isAdmin) {
    return true
  }

  return null
}

Authorization.prototype._registerAuthorizationListeners = function () {
  var self = this

  for (var key in this.reporter.documentStore.collections) {
    var col = self.reporter.documentStore.collections[key]

    if (col.entitySet.shared) {
      continue
    }

    var check = function (collection, req, authAction) {
      function fn () {
        if (!req) {
          return Promise.resolve(true)
        }

        var defaultAuth = self.defaultAuth(collection, req)
        if (defaultAuth === true) {
          return Promise.resolve(true)
        }
        if (defaultAuth === false) {
          return Promise.resolve(false)
        }

        return authAction()
      }

      return fn().then(function (res) {
        if (res !== true) {
          if (req.user) {
            self.reporter.logger.warn('User ' + req.user.username + ' not authorized for ' + collection.name)
          }

          var e = new Error('Unauthorized for ' + collection.name)
          e.unauthorized = true
          throw e
        }
      })
    }

    col['beforeUpdateListeners'].add('authorization', col, function (query, update, req) {
      var col = this
      if (!req || req.skipAuthorizationForUpdate === query) {
        return
      }

      return check(col, req, function () {
        return self.authorizeUpdate(query, update, col, req)
      })
    })

    col['beforeRemoveListeners'].add('authorization', col, function (query, req) {
      var col = this
      return check(col, req, function () {
        return self.authorizeRemove(query, col, req)
      })
    })

    col['beforeInsertListeners'].add('authorization', col, function (doc, req) {
      var col = this
      if (!req || req.skipAuthorizationForInsert === doc) {
        return
      }
      return check(col, req, function () {
        return Promise.resolve(true)
      })
    })
  }
}

Authorization.prototype._handlePermissionsInEntities = function () {
  var self = this

  function isRequestEligibleForAuth (req) {
    return req && req.user && !req.user.isAdmin
  }

  function beforeCreate (entity, req) {
    if (!isRequestEligibleForAuth(req)) {
      return
    }

    entity.readPermissions = entity.readPermissions || []
    entity.editPermissions = entity.editPermissions || []
    entity.readPermissions.push(req.user._id.toString())
    entity.editPermissions.push(req.user._id.toString())
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

    if (entity.editPermissions.indexOf(req.user._id.toString()) === -1) {
      entity.editPermissions.push(req.user._id.toString())
    }

    entity.editPermissions.forEach(function (wp) {
      if (entity.readPermissions.indexOf(wp) === -1) {
        entity.readPermissions.push(wp)
      }
    })
  }

  for (var key in self.reporter.documentStore.collections) {
    var col = self.reporter.documentStore.collections[key]
    if (col.entitySet.shared) {
      continue
    }

    col.beforeUpdateListeners.add('auth-perm', col, beforeUpdate)
    col.beforeInsertListeners.add('auth-perm', col, beforeCreate)
    col.beforeFindListeners.add('auth-perm', col, function (query, req) {
      if (this.name === 'users' || this.entitySet.shared) {
        return
      }

      if (req && req.user && req.user._id && !req.user.isAdmin &&
          req.skipAuthorization !== true && req.skipAuthorizationForQuery !== query) {
        return self.findPermissionFilteringListeners.fire(this, query, req)
      }
    })
  }
}

Authorization.prototype._extendEntitiesWithPermissions = function () {
  this.reporter.documentStore.on('before-init', function (documentStore) {
    for (var key in documentStore.model.entitySets) {
      var entitySet = documentStore.model.entitySets[key]
      if (entitySet.shared) {
        continue
      }

      var entityType = documentStore.model.entityTypes[entitySet.entityType.replace(documentStore.model.namespace + '.', '')]

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
